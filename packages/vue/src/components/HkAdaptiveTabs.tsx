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
 * label on desktop, beside the sheet row label on mobile, with the
 * same placement-aware offset default and `showZero` presence
 * semantics as the strip (HkTabs contract).
 *
 * Composition discipline (contract test pinned): the desktop arm IS
 * HkTabs and the mobile arm IS HkButton + HkSelectPanel — this
 * component owns only the branch and the option rows, never popup
 * chrome. Crossing the breakpoint while the picker is open RESETS the
 * open flag here (R2 finding, PR #1323): the branch swap unmounts the
 * HkSelectPanel in the same flush, so the panel's own isMobile-watcher
 * close is stopped before it runs — unlike HkPopover, whose watcher
 * survives because the popover stays mounted. Without the reset, the
 * next mobile mount would come up `open=true` and the sheet would
 * reopen itself unbidden (plus a spurious back-guard history entry).
 *
 * This is the DEFAULT form for page-chrome button groups anchored to
 * the header's center slot or the footer's center slot (user ruling
 * 2026-11-15); dynamic-list switchers with bespoke rows (the
 * platform switcher) keep their own composition.
 */
import { ChevronDown } from "lucide-vue-next";
import { computed, defineComponent, ref, watch, type PropType, type VNodeChild } from "vue";

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
     *  header. Required in practice — a DEV-only warning fires without
     *  it. */
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

    // Branch swap = panel unmount, and the panel's own isMobile close
    // watcher cannot survive its own unmount — see the header note.
    // This reset IS the cross-breakpoint safety; the behavioral test
    // pins it (widen-while-open → return to mobile → sheet stays shut).
    watch(isMobile, () => {
      open.value = false;
    });

    // Duplicate keys would render duplicate rows (and a Vue duplicate-key
    // warning on phones only) — HkTabs dedupes + warns; same here.
    const tabs = computed(() => {
      const seen = new Set<string>();
      const list = props.tabs.filter((t) => {
        if (seen.has(t.key)) return false;
        seen.add(t.key);
        return true;
      });
      if (import.meta.env.DEV && list.length !== props.tabs.length) {
        // eslint-disable-next-line no-console -- dev-only drift alarm
        console.warn(
          "[HkAdaptiveTabs] duplicate tab keys dropped:",
          props.tabs.map((t) => t.key).join(", "),
        );
      }
      return list;
    });

    const active = computed(
      () => tabs.value.find((t) => t.key === props.modelValue) ?? tabs.value[0],
    );
    if (import.meta.env.DEV && !props.ariaLabel) {
      // eslint-disable-next-line no-console -- dev-only a11y alarm
      console.warn("[HkAdaptiveTabs] ariaLabel is missing — the mobile trigger and sheet would be unnamed");
    }

    /** The HkTabs icon vocabulary, mirrored for the mobile rows: the
     *  named `icon-${key}` slot wins, `TabItem.icon` vnode falls back. */
    function rowIcon(tab: TabItem): VNodeChild {
      return slots[`icon-${tab.key}`]?.() ?? (tab.icon != null ? (tab.icon as VNodeChild) : null);
    }

    function renderMobileRows() {
      return (
        <div class="hk-adaptive-tabs-options">
          {tabs.value.map((tab) => {
            // Badge passthrough mirrors the HkTabs strip contract:
            // showZero (count 0 is PRESENCE information), the
            // placement-aware offset default (side marks are spaced by
            // the wrapper, corner marks keep their 4px clearance), and
            // the empty-label guard (a badge anchors a LABEL — no
            // label, no badge).
            const badgePlacement = tab.badge?.placement ?? "right";
            const badgeOffset =
              tab.badge?.offset ??
              (badgePlacement === "right" || badgePlacement === "left" ? 0 : 4);
            const label = tab.badge && tab.label ? (
              <HkCornerBadge
                variant={tab.badge.variant ?? "primary"}
                count={tab.badge.count}
                max={tab.badge.max}
                showZero
                label={tab.badge.label}
                placement={badgePlacement}
                offset={badgeOffset}
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
                disabled={tab.disabled || undefined}
                data-disabled={tab.disabled || undefined}
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
            tabs={tabs.value}
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
               bottom sheet (pinned explicitly so the behavioral test
               can hold the line — a sheetOnMobile={false} mutant must
               fail the .hk-select-sheet-panel assertion). */
            sheetOnMobile={true}
          >
            {renderMobileRows()}
          </HkSelectPanel>
          <HkButton
            variant="ghost"
            size="sm"
            ariaLabel={props.ariaLabel}
            aria-haspopup="dialog"
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
