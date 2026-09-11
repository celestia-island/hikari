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

/** One keyboard stop of the panel: a visible catalog row, or the
 *  trailing custom row when `allowCustom` offers one (always last). */
type HkTagStop =
  | { id: string; kind: "option"; option: HkTagOption }
  | { id: string; kind: "custom" };

/**
 * HkTagInput — the tag editor field: selected tags live IN the field as
 * closable chips, and one searchable panel toggles catalog membership.
 *
 *   - the FIELD is a bordered, focus-ringed box in HkInput's visual
 *     language: tags left to right in host order, then a bare
 *     auto-growing input for typing, then the chevron that opens the
 *     panel. Chips wrap onto as many lines as they need and the box
 *     grows with them. At `maxTags` that input is NOT unmounted — it
 *     stays in place and goes `readOnly`, so the field keeps its focus,
 *     its caret and its accessible name while every ADD affordance is
 *     inert; the browser shows the placeholder (or the surviving query)
 *     as the field's text. Only `disabled` removes the element — a
 *     disabled control must not be focusable — and the placeholder text
 *     stands in for it;
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
 *   - with `allowCustom` a NON-EMPTY trimmed query offers a trailing
 *     "Use “<query>”" row, so the search box can also CREATE a value (the
 *     CORS-origin/admin-keyword case) — but only while that query names
 *     nothing the field already carries. An exact, case-folded match on
 *     an option key, on an option label, or on an ALREADY-SELECTED key
 *     suppresses the row: in all three cases there is nothing left to add.
 *
 * The field is a combobox-style control: the inline input carries
 * `role="combobox"`, `aria-expanded`, `aria-controls` (the listbox id)
 * and `aria-autocomplete="list"`; rows are `role="option"` with
 * `aria-selected`. ArrowDown / ArrowUp walk an ACTIVE row through the
 * visible rows — the custom row, when offered, is the LAST stop and both
 * ends wrap — and publish it as `aria-activedescendant` on the inline
 * input and on the panel's search field. That is the activedescendant
 * pattern: focus never moves to a row, the row is only highlighted, and
 * Enter activates the active row (falling back to today's first
 * togglable row / custom row when nothing is active). Every open and
 * every query edit starts again with no active row.
 *
 * CONTROLLED: the component owns no selected state — `add` / `remove`
 * fire with the key and `update:modelValue` with the full next array, and
 * the host writes the prop back. Two synthetic clicks dispatched in the
 * SAME tick therefore both resolve against the same stale prop and
 * collapse to the last emitted state — a real pair of user clicks cannot
 * hit this, because the second lands after the host has re-rendered the
 * first — so a host must not write back asynchronously expecting both
 * edits to land.
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
     *  inline input stays mounted but `readOnly` (focus and the field's
     *  accessible name survive) and the panel's add affordances go
     *  disabled (the tags' × still removes). */
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
    /** The keyboard cursor: an index into the stops list, -1 for "nothing
     *  active" — the state every open and every query edit starts from. */
    const activeIndex = ref(-1);
    const fieldRef = ref<HTMLElement | null>(null);
    const inputRef = ref<HTMLInputElement | null>(null);

    // Field identity for the label association, plus the listbox id the
    // inline input points at with aria-controls.
    const generatedId = useId();
    const listboxId = `${generatedId}-listbox`;

    /** A fresh close drops the filter — a reopened panel starts calm
     *  (the HkAffixPicker convention) — and the cursor is cleared on BOTH
     *  edges: a reopened panel must not remember a row. */
    watch(open, (v) => {
      if (!v) query.value = "";
      activeIndex.value = -1;
      emit("update:open", v);
    });

    /** Any query edit re-filters the list under the cursor, so the cursor
     *  goes with it — synchronously, so a key pressed in the same tick as
     *  the input event can never address a row that is already gone. */
    watch(
      query,
      () => {
        activeIndex.value = -1;
      },
      { flush: "sync" },
    );

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

    /** DOM id of one stop: the single spelling the ROW renders and
     *  `aria-activedescendant` publishes, so the two can never drift. */
    function stopId(kind: "option" | "custom", index = 0): string {
      return kind === "custom" ? `${generatedId}-custom` : `${generatedId}-option-${index}`;
    }

    /** The stops ArrowDown / ArrowUp walk, in the panel's reading order:
     *  the visible rows, then the custom row as the LAST stop.
     *
     *  Indexed by position, not by key — the filter rebuilds the list on
     *  every query edit (which clears the cursor) and an index can never
     *  collide the way a host-supplied key could inside a DOM id. */
    const stops = computed<readonly HkTagStop[]>(() => {
      const list: HkTagStop[] = filteredRows.value.map((option, index) => ({
        id: stopId("option", index),
        kind: "option" as const,
        option,
      }));
      if (customVisible.value) list.push({ id: stopId("custom"), kind: "custom" });
      return list;
    });

    /** The active stop, or null when nothing is active — also when the
     *  list shrank under a stale index (a cursor past the end is no
     *  cursor, never a neighbouring row). */
    const activeStop = computed<HkTagStop | null>(
      () => stops.value[activeIndex.value] ?? null,
    );

    /** Walk the cursor one stop. From "nothing active" ArrowDown lands on
     *  the FIRST stop and ArrowUp on the last; from either end it wraps
     *  around. An empty list leaves nothing active. */
    function moveActive(delta: 1 | -1): void {
      const count = stops.value.length;
      if (count === 0) {
        activeIndex.value = -1;
        return;
      }
      const from = activeIndex.value;
      if (from < 0 || from >= count) activeIndex.value = delta > 0 ? 0 : count - 1;
      else activeIndex.value = (from + delta + count) % count;
    }

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

    /** Enter resolves the typed query. With an active row that row wins —
     *  the keyboard cursor must be able to reach a row other than the top
     *  one. With nothing active it stays the HkAffixPicker order: the
     *  first togglable row, otherwise the custom row (an inert top row
     *  falls through instead of swallowing the key).
     *  An empty query is a no-op: Enter on a blank field must not pick
     *  the top of the catalog. */
    function commitQuery(): void {
      const stop = activeStop.value;
      if (stop) {
        if (stop.kind === "custom") addCustom();
        else toggleRow(stop.option);
        return;
      }
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
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        // Closed: the arrow only opens the panel — the canonical combobox
        // step, and opening starts with nothing active. Open: it walks
        // the cursor; focus stays where it is (activedescendant).
        if (!open.value) openPanel();
        else moveActive(e.key === "ArrowDown" ? 1 : -1);
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
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        open.value = false;
      }
    }

    /** Arrows pressed on the panel SURFACE itself (a row keeps focus
     *  after a click, since rows carry tabindex="-1") walk the cursor
     *  too. Keydowns that bubbled out of a field are that field's own
     *  business — handled once, never twice. */
    function onPanelKeydown(e: KeyboardEvent): void {
      if (e.isComposing) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(e.key === "ArrowDown" ? 1 : -1);
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
      // The inline input is unmounted ONLY while disabled — a disabled
      // control must not be focusable, and the placeholder text keeps the
      // field readable. At capacity it stays mounted and goes readOnly:
      // the field keeps its focus, its caret and its accessible name, the
      // browser shows the placeholder (or the surviving query) as the
      // field's text, and every add affordance is inert anyway.
      const inputRendered = !props.disabled;
      const activeId = activeStop.value?.id;
      return (
        <div class="hk-tag-input-wrapper">
          {props.label && (
            <label
              class="hk-tag-input-label"
              // A `for` must name an element that exists. While disabled
              // there is no input to point at, and the box carries the
              // caption itself (role="group" + aria-label).
              for={inputRendered ? generatedId : undefined}
            >
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
            role={inputRendered ? undefined : "group"}
            aria-label={inputRendered ? undefined : title.value}
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
            {inputRendered ? (
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
                aria-activedescendant={activeId}
                aria-label={props.label ? undefined : title.value}
                // At the cap the field stays focusable and readable, but
                // takes no text; nothing could be added with it anyway.
                // (Lowercase `readonly`: Vue's JSX types spell the DOM
                // ATTRIBUTE, and the runtime sets the boolean attribute.)
                // Backspace on the empty readOnly field still removes the
                // last tag — the very code path an editable field uses,
                // and at the cap the keyboard way to free a slot, exactly
                // like the chip's ×.
                readonly={atMax.value || undefined}
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
            onKeydown={onPanelKeydown}
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
                      // The search field is the second combobox surface:
                      // arrows pressed here move the SAME cursor, and the
                      // row is published the same way.
                      aria-activedescendant={activeId}
                      autocomplete="off"
                      onKeydown={onSearchKeydown}
                    >
                      {{
                        prefixIcon: () => <Search size={13} aria-hidden="true" />,
                      }}
                    </HkInput>
                  </div>
                  {/* The listbox element exists for as long as the panel is
                    * open — including when the filter matches nothing — so
                    * the input's `aria-controls` always resolves; the empty
                    * state is its only child in that case. */}
                  <div
                    id={listboxId}
                    class="hk-tag-input-list"
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label={title.value}
                  >
                    {rows.map((option, index) => {
                      const selected = selectedKeys.value.includes(option.key);
                      const inert = rowInert(option);
                      const stop = stops.value[index];
                      return (
                        <div
                          key={option.key}
                          id={stop.id}
                          role="option"
                          tabindex={-1}
                          class="hk-tag-input-row"
                          aria-selected={selected}
                          aria-disabled={inert || undefined}
                          data-selected={selected || undefined}
                          data-disabled={inert || undefined}
                          data-active={activeId === stop.id || undefined}
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
                        id={stopId("custom")}
                        role="option"
                        tabindex={-1}
                        class="hk-tag-input-row"
                        aria-selected={false}
                        // The custom row is inert on exactly the same flag
                        // as the option rows — the whole list (custom row
                        // included) freezes when the field is disabled or
                        // full, and reads inert to AT while it does.
                        aria-disabled={rowsDisabled.value || undefined}
                        data-custom="true"
                        data-disabled={rowsDisabled.value || undefined}
                        data-active={activeId === stopId("custom") || undefined}
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
                  {/* The empty message lives OUTSIDE the listbox: a listbox
                    * may only own options/groups (aria-required-children),
                    * and the element it hangs off must still exist while the
                    * panel is open for `aria-controls` to resolve. */}
                  {rows.length === 0 && !customVisible.value && (
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
