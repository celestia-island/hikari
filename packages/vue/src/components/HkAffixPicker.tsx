import { computed, defineComponent, ref, watch, type PropType, type SlotsType } from "vue";

import { ChevronDown, Plus, Search, X } from "lucide-vue-next";

import { useI18n } from "../i18n/context";

import HkInput from "./HkInput";
import HkListTransition from "./HkListTransition";
import HkMenu from "./HkMenu";
import "./HkAffixPicker.scss";

/** One pickable entry of the affix picker's searchable list. */
export interface HkAffixOption {
  /** Stable identity — the value emitted back to the host. */
  key: string;
  /** Primary row/tag text (country name, platform, autonym…). */
  label: string;
  /** Secondary muted text (dial code, locale code, domain…). */
  meta?: string;
  /** Optional leading glyph (flag emoji or any short symbol). */
  flag?: string;
  /** Extra haystack for the search filter (aliases, codes, digits). */
  keywords?: string;
  disabled?: boolean;
}

/**
 * HkAffixPicker — the standardized "affix chip + searchable popup list"
 * control. A chip rides the prefix (left) or suffix (right) slot of a
 * host field (compose it inside an `HkInput` affix slot); clicking it
 * opens one canonical popup:
 *
 *   - a SEARCH FIELD on top (live filter over label / meta / keywords);
 *   - in `multi` mode, a TAG LIST of the currently selected keys with
 *     the shared arm-delete guard: the row's × arms on the first tap
 *     (danger tint) and erases on the second — desktop hover IS the
 *     preview, so a single click erases there; the popup stays open so
 *     several tags can be managed in one pass;
 *   - the option rows themselves: single mode shows every option and
 *     closes on pick; multi mode lists the NOT-yet-selected options and
 *     stays open for batch adds;
 *   - with `allowCustom`, a trailing "Use <query>" row appears whenever
 *     the typed query is not an exact label match — free-text entries
 *     without leaving the keyboard flow (Enter picks the first row, or
 *     the custom row when nothing matches).
 *
 * The picker owns ZERO field semantics: selection state lives with the
 * host (`selected` key(s) in, events out), and the chip visuals come
 * from the host through the scoped `chip` slot — the same component
 * therefore serves dial codes, translation languages, git platform
 * prefixes or any future "constrained value behind a chip" field.
 */
export const HkAffixPicker = defineComponent({
  name: "HkAffixPicker",
  props: {
    /** The full catalog of pickable entries. */
    options: { type: Array as PropType<readonly HkAffixOption[]>, required: true },
    /** "single" closes on pick and shows a check on the active row;
     *  "multi" renders the tag list and keeps the popup open. */
    mode: { type: String as PropType<"single" | "multi">, default: "single" },
    /** Selected key(s). A string in single mode, an array in multi. */
    selected: {
      type: [String, Array] as PropType<string | readonly string[]>,
      default: "",
    },
    /** The entry currently being acted on (edited language, active
     *  platform) — marks its tag with the active dot. */
    activeKey: { type: String, default: undefined },
    /** Which affix edge the chip rides — only steers the popup anchor
     *  placement (bottom-start vs bottom-end). */
    side: { type: String as PropType<"prefix" | "suffix">, default: "prefix" },
    /** Show the filter field (default true). */
    searchable: { type: Boolean, default: true },
    /** Offer a "Use <query>" row for free-text entries. */
    allowCustom: { type: Boolean, default: false },
    /** Override the default close-on-pick (single: true, multi: false).
     *  E.g. a multi picker that should close after each add passes
     *  true; a single picker that should stay open passes false. */
    closeOnSelect: { type: Boolean, default: undefined },
    disabled: { type: Boolean, default: false },
    /** Popup / chip aria labels; defaulted from the i18n bundle. */
    title: { type: String, default: undefined },
    searchPlaceholder: { type: String, default: undefined },
    emptyText: { type: String, default: undefined },
    /** Extra class on the chip button (host field styling hooks). */
    chipClass: { type: String, default: undefined },
    /** Accessible name of the chip button (defaults to its content). */
    chipLabel: { type: String, default: undefined },
  },
  emits: {
    /** A row or tag body was picked (multi add / single choose). */
    select: (_key: string) => true,
    /** A tag's armed × confirmed — the host drops that key. */
    remove: (_key: string) => true,
    /** The "Use <query>" row fired with the typed text. */
    custom: (_query: string) => true,
    "update:open": (_open: boolean) => true,
  },
  slots: Object as SlotsType<{
    /** Chip inner content; scoped `open` mirrors the popup state. */
    chip?: (scope: { open: boolean }) => unknown;
  }>,
  setup(props, { emit, slots }) {
    const { t } = useI18n();

    const open = ref(false);
    const chipRef = ref<HTMLElement | null>(null);
    const query = ref("");
    /** Key of the tag whose delete is ARMED (× tapped once). */
    const armedKey = ref<string | null>(null);

    // A fresh open starts calm: empty filter, no armed tag.
    watch(open, (v) => {
      if (!v) {
        query.value = "";
        armedKey.value = null;
      }
      emit("update:open", v);
    });

    const selectedKeys = computed<readonly string[]>(() =>
      Array.isArray(props.selected) ? props.selected : props.selected ? [props.selected] : [],
    );

    const activeSet = computed<readonly string[]>(() =>
      props.mode === "single" ? selectedKeys.value : props.activeKey ? [props.activeKey] : [],
    );

    /** Rows of the pick list. Multi hides already-selected keys (they
     *  live in the tag list instead); single always shows everything. */
    const filteredRows = computed<readonly HkAffixOption[]>(() => {
      const base =
        props.mode === "multi"
          ? props.options.filter((o) => !selectedKeys.value.includes(o.key))
          : props.options;
      const q = query.value.trim().toLowerCase();
      if (!q) return base;
      return base.filter((o) => {
        if (o.label.toLowerCase().includes(q)) return true;
        if (o.meta && o.meta.toLowerCase().includes(q)) return true;
        if (o.key.toLowerCase().includes(q)) return true;
        return !!o.keywords && o.keywords.toLowerCase().includes(q);
      });
    });

    /** Exact label match suppresses the custom row while the user is
     *  simply re-typing an existing entry. */
    const exactMatch = computed(
      () =>
        !!query.value.trim() &&
        props.options.some(
          (o) => o.label.toLowerCase() === query.value.trim().toLowerCase(),
        ),
    );

    const customVisible = computed(
      () => props.allowCustom && !!query.value.trim() && !exactMatch.value,
    );

    const resolvedCloseOnSelect = computed(() =>
      props.closeOnSelect === undefined ? props.mode === "single" : props.closeOnSelect,
    );

    /** Tags of the multi picker: selected keys in host order; keys not
     *  present in the catalog degrade to their raw key as the label. */
    const tagEntries = computed<readonly HkAffixOption[]>(() =>
      selectedKeys.value.map(
        (key) => props.options.find((o) => o.key === key) ?? { key, label: key },
      ),
    );

    function toggle() {
      if (!props.disabled) open.value = !open.value;
    }

    function pick(option: HkAffixOption) {
      if (option.disabled) return;
      emit("select", option.key);
      if (resolvedCloseOnSelect.value) open.value = false;
    }

    function confirmRemove(key: string) {
      armedKey.value = null;
      emit("remove", key);
    }

    function toggleArm(key: string) {
      armedKey.value = armedKey.value === key ? null : key;
    }

    function useCustom() {
      const q = query.value.trim();
      if (!q) return;
      emit("custom", q);
      if (props.mode === "single") open.value = false;
      else query.value = "";
    }

    function onSearchEnter() {
      const rows = filteredRows.value;
      if (rows.length > 0 && !rows[0].disabled) {
        pick(rows[0]);
        return;
      }
      if (customVisible.value) useCustom();
    }

    function interpolate(template: string, vars: Record<string, string>): string {
      return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.split(`{${k}}`).join(v),
        template,
      );
    }

    return () => {
      const rows = filteredRows.value;
      const tags = props.mode === "multi" ? tagEntries.value : [];
      const title = props.title ?? t("hikari::affixPicker.title", "Options");
      const searchPlaceholder =
        props.searchPlaceholder ?? t("hikari::affixPicker.search", "Search");
      const emptyText = props.emptyText ?? t("hikari::affixPicker.empty", "No matches");
      const removeLabel = t("hikari::affixPicker.remove", "Remove");
      const confirmLabel = t("hikari::affixPicker.confirmDelete", "Confirm remove");
      const placement = props.side === "suffix" ? "bottom-end" : "bottom-start";
      return (
        <>
          <button
            ref={(el: unknown) => {
              chipRef.value = (el as HTMLElement) ?? null;
            }}
            type="button"
            class={["hk-affix-chip", props.chipClass]}
            disabled={props.disabled}
            aria-haspopup="menu"
            aria-expanded={open.value}
            aria-label={props.chipLabel}
            title={props.chipLabel}
            onMousedown={(e: MouseEvent) => e.preventDefault()}
            onClick={(e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              toggle();
            }}
          >
            {slots.chip
              ? slots.chip({ open: open.value })
              : (
                <>
                  <span class="hk-affix-chip-label">
                    {props.mode === "single"
                      ? (props.options.find((o) => o.key === props.selected)?.label ??
                        props.selected)
                      : t("hikari::affixPicker.selectedCount", "{count} selected")
                          .split("{count}")
                          .join(String(selectedKeys.value.length))}
                  </span>
                  <ChevronDown size={12} class="hk-affix-chip-caret" aria-hidden="true" />
                </>
              )}
          </button>
          <HkMenu
            variant="popup"
            items={[]}
            open={open.value}
            onUpdate:open={(v: boolean) => {
              open.value = v;
            }}
            anchorRef={chipRef.value}
            placement={placement}
            matchAnchorWidth={false}
            title={title}
          >
            {{
              header: () => (
                <div class="hk-affix-head">
                  {props.mode === "multi" && tags.length > 0 && (
                    <div
                      class="hk-affix-tags"
                      role="group"
                      aria-label={t("hikari::affixPicker.selected", "Selected")}
                    >
                      <HkListTransition
                        tag="div"
                        variant="reveal"
                        move
                        appear
                        class="hk-affix-tag-list"
                      >
                        {tags.map((tag) => {
                          const armed = armedKey.value === tag.key;
                          return (
                            <div
                              key={tag.key}
                              class="hk-affix-tag"
                              data-active={activeSet.value.includes(tag.key) || undefined}
                              data-armed={armed || undefined}
                            >
                              <button
                                type="button"
                                class="hk-affix-tag-body"
                                title={`${tag.label}${tag.meta ? ` (${tag.meta})` : ""}`}
                                aria-label={`${t("hikari::affixPicker.switchTo", "Switch to")} ${tag.label}`}
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation();
                                  if (armed) {
                                    armedKey.value = null;
                                    return;
                                  }
                                  pick(tag);
                                }}
                              >
                                {tag.flag && (
                                  <span class="hk-affix-tag-flag" aria-hidden="true">
                                    {tag.flag}
                                  </span>
                                )}
                                <span class="hk-affix-tag-text">{tag.label}</span>
                                {tag.meta && (
                                  <span class="hk-affix-tag-meta">{tag.meta}</span>
                                )}
                                {activeSet.value.includes(tag.key) && (
                                  <span class="hk-affix-tag-dot" aria-hidden="true" />
                                )}
                              </button>
                              <button
                                type="button"
                                class="hk-affix-tag-x"
                                aria-label={armed ? confirmLabel : `${removeLabel} — ${tag.label}`}
                                title={armed ? confirmLabel : `${removeLabel} — ${tag.label}`}
                                // The × arms on the first activation and
                                // confirms on the second (touch guard); on
                                // desktop the hover already previewed the
                                // intent, so the first click erases.
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation();
                                  if (armed) confirmRemove(tag.key);
                                  else toggleArm(tag.key);
                                }}
                                onMousedown={(e: MouseEvent) => e.preventDefault()}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          );
                        })}
                      </HkListTransition>
                    </div>
                  )}
                  {props.searchable && (
                    <div class="hk-affix-search" role="search">
                      <HkInput
                        modelValue={query.value}
                        onUpdate:modelValue={(v: string) => {
                          query.value = v;
                        }}
                        size="sm"
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        autocomplete="off"
                        onKeydown={(e: KeyboardEvent) => {
                          if (e.key === "Enter" && !e.isComposing) {
                            e.preventDefault();
                            onSearchEnter();
                          }
                        }}
                      >
                        {{
                          prefixIcon: () => <Search size={13} aria-hidden="true" />,
                        }}
                      </HkInput>
                    </div>
                  )}
                </div>
              ),
              default: () =>
                rows.length > 0 || customVisible.value ? (
                  <div class="hk-affix-list">
                    {rows.map((option) => {
                      const active =
                        props.mode === "single"
                          ? selectedKeys.value.includes(option.key)
                          : false;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          class="hk-affix-row"
                          data-active={active || undefined}
                          data-disabled={option.disabled || undefined}
                          onClick={(e: MouseEvent) => {
                            e.stopPropagation();
                            pick(option);
                          }}
                        >
                          {option.flag && (
                            <span class="hk-affix-row-flag" aria-hidden="true">
                              {option.flag}
                            </span>
                          )}
                          <span class="hk-affix-row-label">{option.label}</span>
                          {option.meta && (
                            <span class="hk-affix-row-meta">{option.meta}</span>
                          )}
                        </button>
                      );
                    })}
                    {customVisible.value && (
                      <button
                        type="button"
                        class="hk-affix-row"
                        data-custom="true"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          useCustom();
                        }}
                      >
                        <Plus size={13} class="hk-affix-row-flag" aria-hidden="true" />
                        <span class="hk-affix-row-label">
                          {interpolate(
                            t("hikari::affixPicker.useCustom", 'Use "{query}"'),
                            { query: query.value.trim() },
                          )}
                        </span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div class="hk-affix-empty">{emptyText}</div>
                ),
            }}
          </HkMenu>
        </>
      );
    };
  },
});

export default HkAffixPicker;
