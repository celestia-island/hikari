import { computed, defineComponent, nextTick, ref, type PropType } from "vue";
import { Search } from "lucide-vue-next";

import HkButton from "./HkButton";
import HkCornerBadge from "./HkCornerBadge";
import HkIconButton from "./HkIconButton";
import HkPopover, { type PopupPlacement } from "./HkPopover";
import HkSearchInput from "./HkSearchInput";
import { useBreakpoint } from "../runtime/useBreakpoint";
import { useI18n } from "../i18n/context";
import "./HkSearchTrigger.scss";

/**
 * HkSearchTrigger — the header SEARCH affordance, the exact chrome twin
 * of HkFilterTrigger: a ghost/28 icon button (Search glyph) anchoring
 * a keyword panel in a popover on desktop and a bottom sheet on
 * mobile. The dot marks an active keyword, mirroring the filter
 * trigger's active dot, so "this page is filtered" and "this page is
 * searched" read the same at a glance.
 *
 * Keyword semantics (the search-behavior half of the list scaffold):
 * - the draft inside the panel is LOCAL until committed — commits fire
 *   debounced while typing (default 300 ms) and immediately on Enter;
 * - an empty keyword is a clear: it commits "" exactly like text, so
 *   the host never needs a separate clear verb;
 * - `minLength` (default 1) swallows too-short drafts without clearing
 *   an active keyword — the panel edits are free until they reach a
 *   committable length (or empty out deliberately).
 *
 * What matches the keyword is the HOST's business (each page maps it
 * onto its own columns); this component owns only the interaction —
 * one trigger, one panel, one namespace.
 */
const HkSearchTrigger = defineComponent({
  name: "HkSearchTrigger",
  props: {
    /** The ACTIVE keyword ("" = none). The panel drafts locally and
     * commits debounced — this prop changes only on commit. */
    modelValue: { type: String, default: "" },
    /** Input placeholder; defaults to the localized "Search…". */
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    /** Accessible name / sheet title. Defaults to the localized
     * "Search" — the same word the icon says. */
    label: { type: String, default: undefined },
    /** Commit debounce while typing, in ms (default 300). Enter always
     * commits immediately. */
    debounce: { type: Number, default: 300 },
    /** Drafts shorter than this do not commit (default 1). Empty
     * always commits — clearing is a first-class verb. */
    minLength: { type: Number, default: 1 },
    placement: { type: String as PropType<PopupPlacement>, default: "bottom-end" },
  },
  emits: {
    "update:modelValue": (_keyword: string) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const { isMobile } = useBreakpoint();
    const open = ref(false);
    const anchorRef = ref<HTMLElement | null>(null);
    const inputWrapRef = ref<HTMLElement | null>(null);
    const draft = ref(props.modelValue);

    const active = computed(() => props.modelValue !== "");

    function commit(value: string): void {
      if (props.disabled) return;
      if (value !== "" && value.length < Math.max(1, props.minLength)) return;
      if (value === props.modelValue) return;
      emit("update:modelValue", value);
    }

    function onPanelOpen(openNow: boolean): void {
      open.value = openNow;
      if (openNow) {
        draft.value = props.modelValue;
        void nextTick(() => {
          inputWrapRef.value?.querySelector<HTMLInputElement>("input")?.focus();
        });
      } else {
        // The popover tears its content down on close, which kills the
        // input's in-flight debounce — flush the draft here so a
        // just-typed keyword still commits (the dot never disagrees
        // with what the user last saw).
        commit(draft.value);
      }
    }

    return () => {
      const label = props.label ?? t("hikari::search.trigger", "Search");
      return (
        <span ref={anchorRef} class="hk-search-trigger">
          {/* The active-keyword marker rides the generic corner badge —
           * the same green bottom-right dot the filter trigger wears
           * (2026-10-15: was a hand-rolled primary dot, top-right). */}
          <HkCornerBadge dot={active.value} variant="success" corner="bottom-right" offset={1}>
          <HkIconButton
            size={28}
            variant="ghost"
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={open.value ? "true" : "false"}
            disabled={props.disabled}
            data-active={active.value || undefined}
            onClick={() => {
              onPanelOpen(!open.value);
            }}
          >
            {{ icon: () => <Search size={16} /> }}
          </HkIconButton>
          </HkCornerBadge>
          <HkPopover
            modelValue={open.value}
            onUpdate:modelValue={(v: boolean) => onPanelOpen(v)}
            anchorRef={anchorRef.value}
            placement={props.placement}
            offset={6}
            sheetOnMobile
            title={label}
          >
            <div class="hk-search-trigger-body" ref={inputWrapRef}>
              {/* The input owns the debounce (its `search` event fires
               * debounced while typing and immediately on Enter) — this
               * panel never builds a second timer beside it. */}
              <HkSearchInput
                modelValue={draft.value}
                placeholder={props.placeholder}
                disabled={props.disabled}
                debounce={props.debounce}
                clearAriaLabel={t("hikari::search.clear", "Clear search")}
                onUpdate:modelValue={(v: string) => {
                  draft.value = v;
                  // Clearing is immediate — a debounced clear feels
                  // broken (the dot lingers after the field empties).
                  if (v === "") commit("");
                }}
                onSearch={(v: string) => commit(v)}
              />
              {isMobile.value && (
                <div class="hk-search-trigger-footer">
                  {/* The sheet's ONE button: confirm = close (commits
                   * already rode the input's debounce). */}
                  <HkButton
                    variant="primary"
                    size="sm"
                    disabled={props.disabled}
                    onClick={() => {
                      onPanelOpen(false);
                    }}
                  >
                    {t("hikari::search.apply", "Apply")}
                  </HkButton>
                </div>
              )}
            </div>
          </HkPopover>
        </span>
      );
    };
  },
});

export default HkSearchTrigger;
