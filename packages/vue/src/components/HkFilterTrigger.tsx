import { computed, defineComponent, ref, type PropType } from "vue";
import { SlidersHorizontal } from "lucide-vue-next";

import HkButton from "./HkButton";
import HkFilterPanel, {
  type HkFilterCondition,
  type HkFilterFieldDef,
  type HkFilterState,
} from "./HkFilterPanel";
import HkIconButton from "./HkIconButton";
import HkPopover, { type PopupPlacement } from "./HkPopover";
import "./HkFilterTrigger.scss";
import { useBreakpoint } from "../runtime/useBreakpoint";
import { useI18n } from "../i18n/context";

/**
 * HkFilterTrigger — the header filter affordance: a ghost/28 icon button
 * (the same step as the theme toggle and the page refresh — the whole
 * top-right cluster reads as one row of chrome) anchoring the
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
 * A small dot on the button marks a panel with at least one non-empty
 * value, so a filtered page is recognizable with the panel closed.
 */
export default defineComponent({
  name: "HkFilterTrigger",
  props: {
    fields: { type: Array as PropType<HkFilterFieldDef[]>, required: true },
    modelValue: { type: Object as PropType<HkFilterState>, default: () => ({}) },
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
    const open = ref(false);
    const anchorRef = ref<HTMLElement | null>(null);

    const active = computed(() =>
      Object.values(props.modelValue as Record<string, HkFilterCondition>).some(
        (c) => c && c.value !== "",
      ),
    );

    return () => {
      const label = props.label ?? t("hikari::filterBar.trigger", "Filters");
      return (
        <span ref={anchorRef} class="hk-filter-trigger">
          <HkIconButton
            size={28}
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
            {{ icon: () => <SlidersHorizontal size={16} /> }}
          </HkIconButton>
          {active.value && <span class="hk-filter-trigger-dot" aria-hidden="true" />}
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
