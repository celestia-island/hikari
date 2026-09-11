import {
  computed,
  defineComponent,
  ref,
  useId,
  watch,
  type PropType,
} from "vue";

import { Check, ChevronDown, Plus, Search } from "lucide-vue-next";

import { useI18n } from "../i18n/context";

import HkInput from "./HkInput";
import HkSelectPanel from "./HkSelectPanel";
import HkTag from "./HkTag";
import "./HkTagInput.scss";

/** One entry of the tag catalog the field picks from. */
export interface HkTagOption {
  /** Stable identity — the value emitted back to the host. */
  key: string;
  /** Primary row AND tag text. */
  label: string;
  /** Secondary muted text (code suffix, hint). */
  meta?: string;
  /** Optional leading glyph (flag emoji or any short symbol). */
  flag?: string;
  /** Extra haystack for the search filter (aliases, codes, digits). */
  keywords?: string;
  /** Cannot be toggled on (still renders its check when it is set). */
  disabled?: boolean;
}

/** True when every character of `query` appears in `text` in the same
 *  order — gaps allowed ("中国" finds 中华人民共和国). Callers lowercase
 *  both sides first, matching the substring pass. Local copy of the
 *  helper HkAffixPicker uses (its internals are not exported; the rule
 *  is shared, the code deliberately is not). */
function isSubsequence(query: string, text: string): boolean {
  let i = 0;
  for (const ch of text) {
    if (ch === query[i]) i++;
    if (i === query.length) return true;
  }
  return false;
}

/** East-Asian wide glyphs occupy two `ch` units — approximating them
 *  keeps an auto-grown inline input from clipping CJK queries. */
const WIDE_GLYPH =
  /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/;

/**
 * HkTagInput — the tag editor field: selected tags live IN the field as
 * closable chips, and one searchable panel toggles catalog membership.
 *
 *   - the FIELD is a bordered, focus-ringed box in HkInput's visual
 *     language: tags left to right in host order, then a bare
 *     auto-growing input for typing, then the chevron that opens the
 *     panel. Chips wrap onto as many lines as they need and the box
 *     grows with them;
 *   - the PANEL (chevron, any click inside the field, ArrowDown) is the
 *     shared HkSelectPanel surface — same popup-manager stacking, mobile
 *     bottom sheet, outside-click/Escape closing and ONE SCROLLBAR PER
 *     WINDOW contract as every other picker. It deliberately mounts no
 *     scroll region of its own: the window surface scrolls the search
 *     field and the rows as one;
 *   - ALL options are listed, each with a check glyph when selected —
 *     unlike HkAffixPicker's multi mode, which hides the selected keys,
 *     "is this tag used or not" must stay visible and togglable in one
 *     pass. Toggling never closes the panel (batch editing);
 *   - ORDER IS HOST STATE: a newly added key is APPENDED to the end of
 *     `modelValue` ("first tag = primary" for hosts that care), an
 *     existing key is removed in place, and the emitted array is always
 *     a copy of the host's order with that one edit applied;
 *   - a key in `modelValue` that the catalog does not carry (a custom
 *     tag, or an option deleted since) degrades to its raw key as the
 *     tag label — the same rule as HkAffixPicker.tagEntries;
 *   - removal is IMMEDIATE: a tag's × emits `remove` + `update:modelValue`
 *     with no confirm dialog. This is a deliberate divergence from
 *     HkAffixPicker's `confirmRemove` two-step — a tag field is edited
 *     in bulk, and a modal per chip would dominate the flow;
 *   - with `allowCustom` the trimmed query that matches no option key or
 *     label offers a trailing "Use “<query>”" row, so the search box can
 *     also CREATE a value (the CORS-origin/admin-keyword case).
 *
 * The field is a combobox-style control: the inline input carries
 * `role="combobox"`, `aria-expanded`, `aria-controls` (the listbox id)
 * and `aria-autocomplete="list"`; rows are `role="option"` with
 * `aria-selected`.
 */
export const HkTagInput = defineComponent({
  name: "HkTagInput",
  props: {
    /** Selected keys, IN HOST ORDER (order is meaningful to hosts). */
    modelValue: {
      type: Array as PropType<readonly string[]>,
      default: () => [] as readonly string[],
    },
    /** The catalog the panel lists. */
    options: {
      type: Array as PropType<readonly HkTagOption[]>,
      default: () => [] as readonly HkTagOption[],
    },
    /** Free-text tags typed into the field / search box. */
    allowCustom: { type: Boolean, default: false },
    /** Field caption; also names the panel and the control. */
    label: { type: String, default: undefined },
    /** Shown inside the field while no tag & query — the inline input's
     *  placeholder. */
    placeholder: { type: String, default: undefined },
    /** Muted helper line under the field. */
    hint: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    /** Capacity cap; 0 / undefined means unlimited. At the cap the
     *  inline input gives way to the placeholder text and the panel's
     *  add affordances go disabled (the tags' × still removes). */
    maxTags: { type: Number, default: undefined },
    /** Search field placeholder; defaulted from the i18n bundle. */
    searchPlaceholder: { type: String, default: undefined },
    /** "No matches" row text; defaulted from the i18n bundle. */
    emptyText: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_keys: string[]) => true,
    /** A key was toggled on (fires before `update:modelValue`). */
    add: (_key: string) => true,
    /** A key was toggled off — tag × or a selected row. */
    remove: (_key: string) => true,
    "update:open": (_open: boolean) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    const open = ref(false);
    const query = ref("");
    const fieldRef = ref<HTMLElement | null>(null);
    const inputRef = ref<HTMLInputElement | null>(null);

    // Field identity for the label association, plus the listbox id the
    // inline input points at with aria-controls.
    const generatedId = useId();
    const listboxId = `${generatedId}-listbox`;

    /** A fresh close drops the filter — a reopened panel starts calm
     *  (the HkAffixPicker convention). */
    watch(open, (v) => {
      if (!v) query.value = "";
      emit("update:open", v);
    });

    const selectedKeys = computed<readonly string[]>(() =>
      Array.isArray(props.modelValue) ? props.modelValue : [],
    );

    const atMax = computed(
      () => (props.maxTags ?? 0) > 0 && selectedKeys.value.length >= (props.maxTags ?? 0),
    );

    /** Tags in host order; a key the catalog does not carry renders the
     *  raw key as its label (custom tags survive edits of the catalog),
     *  and so does a catalog entry whose label is blank — an empty chip
     *  would be invisible and unnameable. */
    const tagEntries = computed<readonly HkTagOption[]>(() =>
      selectedKeys.value.map((key) => {
        const option = props.options.find((o) => o.key === key);
        if (option && option.label.trim()) return option;
        return { key, label: key };
      }),
    );

    /** Rows of the panel: EVERY option, filtered — never pruned by
     *  selection (that is what makes "used / not used" visible).
     *
     *  Filtering is TWO-PASS over a single field at a time (never across
     *  concatenated fields, which produces noise):
     *    1. an exact substring match for precision (label / meta / key /
     *       keywords, case-folded);
     *    2. an in-order character subsequence fallback (gaps allowed) —
     *       so a renamed or CJK-composed label like "中华人民共和国" is
     *       still found by its short form "中国".
     */
    const filteredRows = computed<readonly HkTagOption[]>(() => {
      const q = query.value.trim().toLowerCase();
      if (!q) return props.options;
      return props.options.filter((o) => {
        if (o.label.toLowerCase().includes(q)) return true;
        if (o.meta && o.meta.toLowerCase().includes(q)) return true;
        if (o.key.toLowerCase().includes(q)) return true;
        if (o.keywords && o.keywords.toLowerCase().includes(q)) return true;
        // Fuzzy fallback — per field, in-order subsequence, gaps allowed.
        if (isSubsequence(q, o.label.toLowerCase())) return true;
        if (o.meta && isSubsequence(q, o.meta.toLowerCase())) return true;
        if (isSubsequence(q, o.key.toLowerCase())) return true;
        return !!o.keywords && isSubsequence(q, o.keywords.toLowerCase());
      });
    });

    const customText = computed(() => query.value.trim());

    /** An exact key OR label match means the query is naming an entry the
     *  catalog already carries; a key already selected (a custom tag from
     *  an earlier edit) has nothing left to add either — in both cases no
     *  duplicate custom row is offered. */
    const exactMatch = computed(() => {
      const q = customText.value.toLowerCase();
      if (!q) return false;
      if (
        props.options.some(
          (o) => o.key.toLowerCase() === q || o.label.toLowerCase() === q,
        )
      ) {
        return true;
      }
      return selectedKeys.value.some((key) => key.toLowerCase() === q);
    });

    const customVisible = computed(
      () => props.allowCustom && !!customText.value && !exactMatch.value,
    );

    /** Rows and the custom row are inert while the field is disabled or
     *  already at capacity. */
    const rowsDisabled = computed(() => props.disabled || atMax.value);

    /** Rows that carry the raw key when the catalog's label is blank. */
    function labelOf(option: HkTagOption): string {
      return option.label.trim() ? option.label : option.key;
    }

    /** Is this row inert? The field being disabled or full freezes the
     *  whole list (there is nothing to add); `disabled` on an option only
     *  forbids toggling it ON, so an already-set disabled option stays
     *  removable — a catalog edit must never strand a tag forever. */
    function rowInert(option: HkTagOption): boolean {
      if (rowsDisabled.value) return true;
      return !!option.disabled && !selectedKeys.value.includes(option.key);
    }

    const title = computed(() => props.label ?? t("hikari::tagInput.title", "Tags"));
    const placeholder = computed(() => props.placeholder ?? "");

    const tagSize = computed<"sm" | "md">(() => (props.size === "sm" ? "sm" : "md"));

    /** The inline input grows with its content (plus one caret unit);
     *  the placeholder drives the width while the query is empty. */
    const inlineWidth = computed(() => {
      const text = query.value || placeholder.value;
      let units = 0;
      for (const ch of text) units += WIDE_GLYPH.test(ch) ? 2 : 1;
      return `${Math.max(2, units + 1)}ch`;
    });

    function interpolate(template: string, vars: Record<string, string>): string {
      return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.split(`{${k}}`).join(v),
        template,
      );
    }

    function openPanel(): void {
      if (props.disabled) return;
      open.value = true;
    }

    /** Commit one edit to the host's ordered key list. `add` / `remove`
     *  fire first (the key), `update:modelValue` second (the full new
     *  array) — the same "specific event, then the model" order the
     *  neighbours use. */
    function commit(next: string[], key: string, kind: "add" | "remove"): void {
      if (kind === "add") emit("add", key);
      else emit("remove", key);
      emit("update:modelValue", next);
    }

    /** Appends to the END of the host order — never re-sorts, so
     *  "first tag = primary" stays under the host's control. Returns
     *  whether the key was actually added. */
    function addKey(key: string): boolean {
      if (props.disabled || atMax.value) return false;
      if (selectedKeys.value.includes(key)) return false;
      commit([...selectedKeys.value, key], key, "add");
      return true;
    }

    function removeKey(key: string): void {
      if (props.disabled) return;
      const index = selectedKeys.value.indexOf(key);
      if (index < 0) return;
      const next = selectedKeys.value.slice();
      next.splice(index, 1);
      commit(next, key, "remove");
    }

    function toggle(key: string): void {
      if (props.disabled) return;
      if (selectedKeys.value.includes(key)) removeKey(key);
      else addKey(key);
    }

    function toggleRow(option: HkTagOption): void {
      if (rowInert(option)) return;
      toggle(option.key);
    }

    /** The "Use “<query>”" row — the raw typed text becomes the tag. The
     *  query is consumed only when the tag was really added, so a no-op
     *  can never look like an accepted edit. */
    function addCustom(): void {
      const q = customText.value;
      if (!q || rowsDisabled.value) return;
      if (!addKey(q)) return;
      query.value = "";
    }

    /** Enter resolves the typed query: the first togglable row when one
     *  matches, otherwise the custom row (the HkAffixPicker order — an
     *  inert top row falls through instead of swallowing the key).
     *  An empty query is a no-op: Enter on a blank field must not pick
     *  the top of the catalog. */
    function commitQuery(): void {
      const q = customText.value;
      if (!q) return;
      const rows = filteredRows.value;
      if (rows.length > 0 && !rowInert(rows[0])) {
        toggleRow(rows[0]);
        return;
      }
      if (customVisible.value) addCustom();
    }

    function onFieldClick(e: MouseEvent): void {
      if (props.disabled) return;
      const target = e.target as HTMLElement | null;
      // The chevron drives its own toggle, and a tag × must only remove:
      // an already-open panel is left as it is, but the press never
      // OPENS one behind the pointer.
      if (target?.closest?.(".hk-tag-input-chevron")) return;
      if (target?.closest?.(".hk-tag-close")) return;
      openPanel();
      inputRef.value?.focus();
    }

    function onInlineKeydown(e: KeyboardEvent): void {
      if (e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        commitQuery();
        return;
      }
      if (e.key === "Backspace" && !query.value) {
        const last = selectedKeys.value.at(-1);
        if (last !== undefined && !props.disabled) {
          e.preventDefault();
          removeKey(last);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        openPanel();
        return;
      }
      if (e.key === "Escape") {
        // First Escape folds the panel (and drops the query); a second
        // one has nothing left to clear — committed tags are never
        // discarded by a keystroke.
        if (open.value) {
          e.preventDefault();
          e.stopPropagation();
          open.value = false;
        }
        return;
      }
    }

    function onSearchKeydown(e: KeyboardEvent): void {
      if (e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        commitQuery();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        open.value = false;
      }
    }

    return () => {
      const rows = filteredRows.value;
      const searchPlaceholder =
        props.searchPlaceholder ?? t("hikari::tagInput.search", "Search");
      const emptyText = props.emptyText ?? t("hikari::tagInput.empty", "No matches");
      const removeLabel = t("hikari::tagInput.remove", "Remove");
      const customLabel = interpolate(
        t("hikari::tagInput.addCustom", "Use “{q}”"),
        { q: customText.value },
      );
      // The inline input is absent while disabled or at capacity; the
      // placeholder text keeps the field readable in its place.
      const typingEnabled = !props.disabled && !atMax.value;
      return (
        <div class="hk-tag-input-wrapper">
          {props.label && (
            <label class="hk-tag-input-label" for={generatedId}>
              {props.label}
            </label>
          )}
          <div
            ref={(el: unknown) => {
              fieldRef.value = (el as HTMLElement) ?? null;
            }}
            class={[
              "hk-tag-input-box",
              `hk-tag-input-box-${props.size}`,
              open.value ? "hk-tag-input-box-open" : "",
            ]}
            data-disabled={props.disabled || undefined}
            data-full={atMax.value || undefined}
            onClick={onFieldClick}
          >
            {tagEntries.value.map((entry) => (
              <HkTag
                key={entry.key}
                class="hk-tag-input-tag"
                size={tagSize.value}
                closable={!props.disabled}
                closeLabel={`${removeLabel} — ${entry.label}`}
                onClose={() => removeKey(entry.key)}
              >
                <span class="hk-tag-input-tag-text">{entry.label}</span>
              </HkTag>
            ))}
            {typingEnabled ? (
              <input
                ref={inputRef}
                id={generatedId}
                type="text"
                class="hk-tag-input-element"
                style={{ width: inlineWidth.value }}
                value={query.value}
                role="combobox"
                aria-expanded={open.value}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-label={props.label ? undefined : title.value}
                placeholder={placeholder.value}
                autocomplete="off"
                spellcheck={false}
                data-1p-ignore
                data-lpignore="true"
                onInput={(e: Event) => {
                  query.value = (e.target as HTMLInputElement).value;
                }}
                onKeydown={onInlineKeydown}
              />
            ) : placeholder.value ? (
              <span class="hk-tag-input-placeholder">{placeholder.value}</span>
            ) : null}
            <button
              type="button"
              class="hk-tag-input-chevron"
              disabled={props.disabled}
              aria-haspopup="listbox"
              aria-expanded={open.value}
              aria-label={title.value}
              title={title.value}
              // Keep the inline input's focus (and its caret) on the
              // chevron press — the panel opens without a blur flicker.
              onMousedown={(e: MouseEvent) => e.preventDefault()}
              onClick={(e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                if (props.disabled) return;
                open.value = !open.value;
              }}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
          {props.hint && <p class="hk-tag-input-hint">{props.hint}</p>}
          <HkSelectPanel
            open={open.value}
            anchorRef={fieldRef.value}
            title={title.value}
            placement="bottom-start"
            matchAnchorWidth
            onUpdate:open={(v: boolean) => {
              open.value = v;
            }}
          >
            {{
              default: () => (
                /* Width container only — the window surface (HkSelectPanel
                 * popout / sheet) owns THE single scrollbar and scrolls the
                 * search field with the rows; no inner max-height/overflow
                 * here, ever. */
                <div class="hk-tag-input-panel">
                  <div class="hk-tag-input-search" role="search">
                    <HkInput
                      modelValue={query.value}
                      onUpdate:modelValue={(v: string) => {
                        query.value = v;
                      }}
                      size="sm"
                      placeholder={searchPlaceholder}
                      aria-label={searchPlaceholder}
                      autocomplete="off"
                      onKeydown={onSearchKeydown}
                    >
                      {{
                        prefixIcon: () => <Search size={13} aria-hidden="true" />,
                      }}
                    </HkInput>
                  </div>
                  {rows.length > 0 || customVisible.value ? (
                    <div
                      id={listboxId}
                      class="hk-tag-input-list"
                      role="listbox"
                      aria-multiselectable="true"
                      aria-label={title.value}
                    >
                      {rows.map((option) => {
                        const selected = selectedKeys.value.includes(option.key);
                        const inert = rowInert(option);
                        return (
                          <div
                            key={option.key}
                            role="option"
                            tabindex={-1}
                            class="hk-tag-input-row"
                            aria-selected={selected}
                            aria-disabled={inert || undefined}
                            data-selected={selected || undefined}
                            data-disabled={inert || undefined}
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation();
                              toggleRow(option);
                            }}
                          >
                            <span class="hk-tag-input-check" aria-hidden="true">
                              {selected && <Check size={14} />}
                            </span>
                            {option.flag && (
                              <span class="hk-tag-input-row-flag" aria-hidden="true">
                                {option.flag}
                              </span>
                            )}
                            <span class="hk-tag-input-row-label">{labelOf(option)}</span>
                            {option.meta && (
                              <span class="hk-tag-input-row-meta">{option.meta}</span>
                            )}
                          </div>
                        );
                      })}
                      {customVisible.value && (
                        <div
                          role="option"
                          tabindex={-1}
                          class="hk-tag-input-row"
                          aria-selected={false}
                          aria-disabled={atMax.value || undefined}
                          data-custom="true"
                          data-disabled={atMax.value || undefined}
                          onClick={(e: MouseEvent) => {
                            e.stopPropagation();
                            addCustom();
                          }}
                        >
                          <span class="hk-tag-input-check" aria-hidden="true">
                            <Plus size={14} />
                          </span>
                          <span class="hk-tag-input-row-label">{customLabel}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div class="hk-tag-input-empty">{emptyText}</div>
                  )}
                </div>
              ),
            }}
          </HkSelectPanel>
        </div>
      );
    };
  },
});

export default HkTagInput;
