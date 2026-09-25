import { defineComponent, ref, type PropType } from "vue";
import { SlidersHorizontal } from "lucide-vue-next";

import HkBadge from "./HkBadge";
import HkButton from "./HkButton";
import HkPopover, { type PopupPlacement } from "./HkPopover";
import { useI18n } from "../i18n/context";
import "./HkFilterBar.scss";

/**
 * HkFilterBar — the standard filter strip for list/table pages.
 *
 * Two standardized shapes (a page picks one; hand-rolled rows of inputs
 * are retired in favor of this):
 *
 * - `inline` (default) — the bare row, standardized: one card surface,
 *   aligned fields, and a trailing actions column carrying the active-
 *   filter count and the reset button. For pages where the filters ARE
 *   the primary interaction (dense ledgers).
 * - `popover` — the collapsed shape: one trigger button (icon + label +
 *   active-count badge) anchoring a popover panel that holds the same
 *   fields plus an Apply/Reset footer. The default posture for filters —
 *   they should not permanently occupy a band of the page.
 *
 * Fields are the consumer's own controls in the default slot; the bar
 * owns only the chrome, the count and the apply/reset verbs.
 *
 * ```tsx
 * <HkFilterBar mode="popover" activeCount={n} onApply={search} onReset={clearFilters}>
 *   <HkSelect … /> <HkInput … />
 * </HkFilterBar>
 * ```
 */
export default defineComponent({
  name: "HkFilterBar",
  props: {
    mode: { type: String as PropType<"inline" | "popover">, default: "inline" },
    /** How many filters are currently active (drives the count badge). */
    activeCount: { type: Number, default: 0 },
    /** Accessible name / trigger text. Defaults to the localized "Filters". */
    label: { type: String, default: undefined },
    /** popover mode: render the Apply/Reset footer. Keep it off only when
     *  the fields commit live on their own. */
    showFooter: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    placement: { type: String as PropType<PopupPlacement>, default: "bottom-start" },
  },
  emits: {
    /** popover mode: the Apply button in the footer. */
    apply: () => true,
    /** The reset button (inline actions column / popover footer). */
    reset: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const open = ref(false);
    const anchorRef = ref<HTMLElement | null>(null);

    const resetButton = () => (
      <HkButton
        variant="ghost"
        size="sm"
        disabled={props.disabled || props.activeCount === 0}
        onClick={() => emit("reset")}
      >
        {t("hikari::filterBar.reset", "Reset")}
      </HkButton>
    );

    return () => {
      const label = props.label ?? t("hikari::filterBar.trigger", "Filters");

      if (props.mode === "popover") {
        return (
          <div
            ref={anchorRef}
            class="hk-filter-bar hk-filter-bar-popover"
          >
            <HkButton
              variant="secondary"
              size="sm"
              disabled={props.disabled}
              ariaLabel={label}
              aria-expanded={open.value ? "true" : "false"}
              aria-haspopup="dialog"
              onClick={() => (open.value = !open.value)}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span>{label}</span>
              {props.activeCount > 0 && (
                <HkBadge size="sm" variant="primary" class="hk-filter-bar-count">
                  {props.activeCount}
                </HkBadge>
              )}
            </HkButton>
            <HkPopover
              modelValue={open.value}
              onUpdate:modelValue={(v: boolean) => (open.value = v)}
              anchorRef={anchorRef.value}
              placement={props.placement}
              offset={6}
              title={label}
            >
              <div class="hk-filter-bar-panel" data-testid="hk-filter-bar-panel">
                {slots.default?.()}
                {props.showFooter && (
                  <div class="hk-filter-bar-footer">
                    {resetButton()}
                    <HkButton
                      variant="primary"
                      size="sm"
                      disabled={props.disabled}
                      onClick={() => {
                        open.value = false;
                        emit("apply");
                      }}
                    >
                      {t("hikari::filterBar.apply", "Apply")}
                    </HkButton>
                  </div>
                )}
              </div>
            </HkPopover>
          </div>
        );
      }

      return (
        <div class="hk-filter-bar" role="search" aria-label={label}>
          <div class="hk-filter-bar-fields">{slots.default?.()}</div>
          <div class="hk-filter-bar-actions">
            {props.activeCount > 0 && (
              <HkBadge size="sm" variant="primary" class="hk-filter-bar-count">
                {props.activeCount}
              </HkBadge>
            )}
            {resetButton()}
          </div>
        </div>
      );
    };
  },
});
