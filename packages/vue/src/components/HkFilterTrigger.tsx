import { computed, defineComponent, ref, type PropType } from "vue";
import { Filter } from "lucide-vue-next";

import HkButton from "./HkButton";
import HkCornerBadge from "./HkCornerBadge";
import HkFilterPanel, {
  type HkFilterCondition,
  type HkFilterFieldDef,
  type HkFilterState,
} from "./HkFilterPanel";
import HkIconButton from "./HkIconButton";
import HkPopover, { type PopupPlacement } from "./HkPopover";
import "./HkFilterTrigger.scss";
import { useBreakpoint } from "../runtime/useBreakpoint";
import { useChromeActionSize } from "../composables/useChromeActionSize";
import { useI18n } from "../i18n/context";

/**
 * HkFilterTrigger — the header filter affordance: a ghost icon button on
 * the chrome action ladder (useChromeActionSize: ghost/32 wide, ghost/28
 * narrow — the same step as the global search and settings buttons, so
 * the whole top-right cluster reads as one row of chrome) anchoring the
 * HkFilterPanel in a popover on desktop and a bottom sheet on mobile
 * (HkPopover sheetOnMobile).
 *
 * Apply semantics (user direction 2026-09-29):
 * - desktop: NO confirm button — edits commit live and the panel is
 *   dismissed by clicking out;
 * - mobile: ONE confirm button ("应用") that closes the sheet — there is
 *   deliberately no cancel; clearing a condition is done by re-opening
 *   the panel and emptying the value, never by a header reset verb.
 *
 * While any condition carries a value, a GREEN dot sits at the button's
 * bottom-right corner (user direction 2026-10-15 — it was a primary
 * dot at the top-right before): the generic HkCornerBadge in its dot
 * form, so this mark is the same component every other corner
 * indicator in the family uses.
 */
export default defineComponent({
  name: "HkFilterTrigger",
  props: {
    fields: { type: Array as PropType<HkFilterFieldDef[]>, required: true },
    modelValue: { type: Array as PropType<HkFilterState>, default: () => [] },
    disabled: { type: Boolean, default: false },
    /** Accessible name / sheet title. Defaults to the localized "Filters". */
    label: { type: String, default: undefined },
    placement: { type: String as PropType<PopupPlacement>, default: "bottom-end" },
  },
  emits: {
    "update:modelValue": (_state: HkFilterState) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const { isMobile } = useBreakpoint();
    // The chrome ladder (2026-10-24 ruling, one source): wide screens
    // wear ghost/32 like the header's search and settings buttons — a
    // flat 28 here read as a different button family from its own
    // neighbors on desktop (2026-10-27 report).
    const chromeSize = useChromeActionSize();
    const open = ref(false);
    const anchorRef = ref<HTMLElement | null>(null);

    const active = computed(() =>
      (props.modelValue as HkFilterCondition[]).some((c) => c && c.value !== ""),
    );

    return () => {
      const label = props.label ?? t("hikari::filterBar.trigger", "Filters");
      return (
        <span ref={anchorRef} class="hk-filter-trigger">
          <HkCornerBadge dot={active.value} variant="success" corner="bottom-right" offset={1}>
            <HkIconButton
              size={chromeSize.value}
              variant="ghost"
              aria-label={label}
              aria-haspopup="dialog"
              aria-expanded={open.value ? "true" : "false"}
              disabled={props.disabled}
              data-active={active.value || undefined}
              onClick={() => {
                open.value = !open.value;
              }}
            >
              {{ icon: () => <Filter size={16} /> }}
            </HkIconButton>
          </HkCornerBadge>
          <HkPopover
            modelValue={open.value}
            onUpdate:modelValue={(v: boolean) => (open.value = v)}
            anchorRef={anchorRef.value}
            placement={props.placement}
            offset={6}
            sheetOnMobile
            title={label}
          >
            <div class="hk-filter-trigger-body">
              <HkFilterPanel
                fields={props.fields}
                modelValue={props.modelValue}
                disabled={props.disabled}
                label={label}
                onUpdate:modelValue={(state: HkFilterState) => emit("update:modelValue", state)}
              />
              {isMobile.value && (
                <div class="hk-filter-trigger-footer">
                  {/* The sheet's ONE button: confirm = close (edits are
                   * already live). No cancel — clearing rides inside the
                   * panel (empty the value). */}
                  <HkButton
                    variant="primary"
                    size="sm"
                    disabled={props.disabled}
                    onClick={() => {
                      open.value = false;
                    }}
                  >
                    {t("hikari::filterBar.apply", "Apply")}
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
