/**
 * HkAdaptiveTabs — the header/footer button group with a built-in
 * mobile collapse (user direction 2026-11-15): ONE tab list, TWO
 * renderings. Wide viewports (≥768) render the canonical HkTabs strip
 * (variant passthrough, pill by default). Phone-width viewports
 * (<768, useBreakpoint().isMobile — the sheet family's threshold)
 * collapse the SAME list into a select-style trigger (active item's
 * icon + label + caret) whose popup is an HkSelectPanel with
 * `sheetOnMobile` — on phones the options rise as a bottom sheet,
 * which is the point: a top- or bottom-anchored strip that squeezes
 * into a scrolling sliver on a phone is space spent badly.
 *
 * The value contract never changes shape: `modelValue` +
 * `update:modelValue` drive both forms, so `?tab=` deep links and
 * store-bound values keep working across the breakpoint. The
 * `icon-${key}` slot vocabulary of HkTabs is honored in BOTH forms
 * (named slot wins, `TabItem.icon` vnode is the fallback), and
 * `TabItem.badge` rides HkCornerBadge in both — beside the strip
 * label on desktop, beside the sheet row label on mobile.
 *
 * Composition discipline (contract test pinned): the desktop arm IS
 * HkTabs and the mobile arm IS HkButton + HkSelectPanel — this
 * component owns only the branch and the option rows, never popup
 * chrome. Crossing the breakpoint while the picker is open unmounts
 * the branch (and with it the panel — its popup handle is released on
 * unmount), so the user reopens in the shape the new viewport calls
 * for; this mirrors HkPopover's own mid-flight breakpoint behavior.
 *
 * This is the DEFAULT form for page-chrome button groups anchored to
 * the header's center slot or the footer's center slot (user ruling
 * 2026-11-15); dynamic-list switchers with bespoke rows (the
 * platform switcher) keep their own composition.
 */
import { ChevronDown } from "lucide-vue-next";
import { computed, defineComponent, ref, type PropType, type VNodeChild } from "vue";

import { useBreakpoint } from "../runtime/useBreakpoint";
import HkButton from "./HkButton";
import HkCornerBadge from "./HkCornerBadge";
import HkSelectPanel, { type SelectPanelPlacement } from "./HkSelectPanel";
import HkTabs, { type TabItem } from "./HkTabs";
import "./HkAdaptiveTabs.scss";

export default defineComponent({
  name: "HkAdaptiveTabs",
  props: {
    modelValue: { type: String, required: true },
    tabs: { type: Array as PropType<TabItem[]>, required: true },
    /** Strip variant on the desktop arm (HkTabs passthrough). */
    variant: { type: String as PropType<"pill" | "segmented">, default: "pill" },
    /** Row-filling strip on the desktop arm (HkTabs passthrough). */
    block: { type: Boolean, default: false },
    /** This component renders triggers only — panel slots are not
     *  managed here, so the desktop arm defaults to `renderPanels:
     *  false` (pass true only if the host supplies panel slots). */
    renderPanels: { type: Boolean, default: false },
    /** Accessible name for the strip / the mobile trigger / the sheet
     *  header. Required in practice — a DEV warning fires without it. */
    ariaLabel: { type: String, default: undefined },
    /** Mobile popout placement relative to the trigger (auto-flips).
     *  Header-center groups keep the default (open downward); a
     *  footer-center group passes "top-center" like the platform
     *  switcher. */
    placement: {
      type: String as PropType<SelectPanelPlacement>,
      default: "bottom-start",
    },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
  },
  setup(props, { emit, slots }) {
    const { isMobile } = useBreakpoint();
    const open = ref(false);
    const wrapRef = ref<HTMLElement | null>(null);

    const active = computed(
      () => props.tabs.find((t) => t.key === props.modelValue) ?? props.tabs[0],
    );
    if (!props.ariaLabel) {
      // eslint-disable-next-line no-console
      console.warn("[hk-adaptive-tabs] ariaLabel is missing — the mobile trigger and sheet would be unnamed");
    }

    /** The HkTabs icon vocabulary, mirrored for the mobile rows: the
     *  named `icon-${key}` slot wins, `TabItem.icon` vnode falls back. */
    function rowIcon(tab: TabItem): VNodeChild {
      return slots[`icon-${tab.key}`]?.() ?? (tab.icon != null ? (tab.icon as VNodeChild) : null);
    }

    function renderMobileRows() {
      return (
        <div class="hk-adaptive-tabs-options">
          {props.tabs.map((tab) => {
            // The badge anchors the LABEL (the HkTabs contract — badge
            // hosts are trigger labels, never floating marks), so the
            // label span moves inside HkCornerBadge when one rides.
            const label = tab.badge ? (
              <HkCornerBadge
                variant={tab.badge.variant ?? "primary"}
                count={tab.badge.count}
                max={tab.badge.max}
                label={tab.badge.label}
                placement={tab.badge.placement ?? "right"}
                offset={tab.badge.offset}
              >
                <span class="hk-menu-label">{tab.label}</span>
              </HkCornerBadge>
            ) : (
              <span class="hk-menu-label">{tab.label}</span>
            );
            return (
              <button
                key={tab.key}
                type="button"
                class="hk-select-option hk-adaptive-tabs-option"
                data-checked={tab.key === props.modelValue || undefined}
                data-disabled={tab.disabled ? "" : undefined}
                onClick={() => {
                  open.value = false;
                  if (!tab.disabled && tab.key !== props.modelValue) {
                    emit("update:modelValue", tab.key);
                  }
                }}
              >
                <span class="hk-menu-item-icon" aria-hidden="true">
                  {rowIcon(tab)}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      );
    }

    return () => {
      if (!isMobile.value) {
        return (
          <HkTabs
            modelValue={props.modelValue}
            onUpdate:modelValue={(v: string) => emit("update:modelValue", v)}
            tabs={props.tabs}
            variant={props.variant}
            block={props.block}
            renderPanels={props.renderPanels}
            ariaLabel={props.ariaLabel}
          >
            {{ ...slots }}
          </HkTabs>
        );
      }
      const ActiveIcon = active.value ? rowIcon(active.value) : null;
      return (
        <span class="hk-adaptive-tabs" ref={wrapRef}>
          <HkSelectPanel
            open={open.value}
            onUpdate:open={(v: boolean) => (open.value = v)}
            anchorRef={wrapRef.value ?? null}
            title={props.ariaLabel ?? ""}
            placement={props.placement}
            matchAnchorWidth={false}
            offset={6}
            /* The WHOLE point of the collapse: phones pick from a rising
               bottom sheet (HkSelectPanel's default, pinned explicitly
               so the contract test can hold the line). */
            sheetOnMobile={true}
          >
            {renderMobileRows()}
          </HkSelectPanel>
          <HkButton
            variant="ghost"
            size="sm"
            ariaLabel={props.ariaLabel}
            aria-haspopup="listbox"
            aria-expanded={open.value ? "true" : "false"}
            data-active={open.value || undefined}
            onClick={() => {
              open.value = !open.value;
            }}
          >
            {ActiveIcon ? <span class="hk-adaptive-tabs-trigger-icon" aria-hidden="true">{ActiveIcon}</span> : null}
            <span class="hk-adaptive-tabs-trigger-label">{active.value?.label ?? props.modelValue}</span>
            <ChevronDown size={12} class="hk-adaptive-tabs-caret" aria-hidden="true" />
          </HkButton>
        </span>
      );
    };
  },
});
