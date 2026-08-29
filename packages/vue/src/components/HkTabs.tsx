import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance, type PropType } from "vue";

import "./HkTabs.scss";
import HkScrollContainer from "./HkScrollContainer";
import HkHoverRevealAction from "./HkHoverRevealAction";
import HkIconButton from "./HkIconButton";
import { iconByName } from "../composables/iconRegistry";
import { useI18n } from "../i18n/context";

export interface TabItem {
  key: string;
  label: string;
  /** Optional icon vnode rendered before the label (the `icon-${key}`
   *  slot wins when provided). */
  icon?: unknown;
  disabled?: boolean;
}

/** A protruding icon button at one inline end of the strip (the former
 *  addable "+" generalized to both ends). Rendered by the shared
 *  HkHoverRevealAction surface OUTSIDE the scroll viewport, so it never
 *  scrolls away; hover-revealed on pointer devices, tap-revealed with a
 *  linger on touch. */
export interface TabsEndAction {
  /** Icon vnode — defaults to the Plus glyph (the common add-tab case). */
  icon?: unknown;
  /** Accessible label / tooltip (falls back to the shared "Add tab"
   *  string). */
  label?: string;
}

/** Structural stand-in for HkScrollContainer's exposed surface —
 *  imperative expose() types don't flow through render-function
 *  setups, so declare just the method we consume. */
interface ScrollerExpose {
  getScrollElement?: () => HTMLElement | undefined;
}

/** Track geometry constants, kept in sync with HkTabs.scss: the track
 *  padding (TRACK_PAD) and the inter-trigger gap (TRACK_GAP — 0 in the
 *  unified chrome). */
const TRACK_GAP = 0;
const TRACK_PAD = 2;

/**
 * HTabs — THE button-group / tab-strip primitive. ONE look (the centered
 * pill strip used by the page-level top/bottom bars) is shared by every
 * button group, radio group and tab strip; variants only switch the
 * working mode and layout behaviors, never the visual language:
 *
 * Variants (working mode):
 * - `pill` (default) — tab strip: `tablist`/`tab`/`aria-selected`
 *   semantics, optional tab panels below;
 * - `segmented` — mutually exclusive option picker: `radiogroup`/
 *   `radio`/`aria-checked` semantics, no panels, plus the form-row
 *   layout extra `block` (fill the row).
 *
 * Capabilities (all variants unless noted):
 * - `scrollable` (default ON) + `scrollbar` + edge fades
 *   (HkScrollContainer): the strip stays centered / row-filling while it
 *   fits and automatically carries the bars' overflow behavior once the
 *   width runs short — edge fades hint at hidden options, swipe/scroll
 *   reaches them, and the active tab is scrolled into view on change;
 * - `startAction` / `endAction` + the `action` emit: optional protruding
 *   icon buttons at EITHER inline end of the strip (outside the scroll
 *   viewport), hover/tap-revealed — the page bars' trailing "+" is
 *   simply `endAction`;
 * - `overlayFrom` + the `#overlay` slot: a measured info layer covering
 *   the track to the right of tab[overlayFrom] — e.g. the theme
 *   toggle's solar-altitude strip replacing the manual halves while
 *   "auto" is active (options "locked" by disabling their tabs);
 * - full arrow-key navigation (arrows/Home/End, wrapping, disabled tabs
 *   skipped, selection follows focus) and roving tabindex.
 */
export default defineComponent({
  name: "HkTabs",
  props: {
    modelValue: { type: String, required: true },
    tabs: { type: Array as PropType<TabItem[]>, required: true },
    /** Working mode: pill = tab strip (tablist), segmented = mutually
     *  exclusive option picker (radiogroup). Both share the one unified
     *  pill chrome. */
    variant: { type: String as PropType<"pill" | "segmented">, default: "pill" },
    /** Grow to fill the container width (segmented). */
    block: { type: Boolean, default: false },
    /** Disable the whole strip (every trigger). */
    disabled: { type: Boolean, default: false },
    /** Render tab panel slots below the strip. Segmented mode pickers
     *  have no panels — panels are skipped for that variant. */
    renderPanels: { type: Boolean, default: true },
    /** Wrap the tab list in a horizontal HkScrollContainer (default ON —
     *  every strip carries the page bars' overflow behavior). The list
     *  stays centered (or row-filling with block) while it fits and
     *  becomes swipe/scroll-driven once it overflows (safe centering —
     *  the overflowing start is never clipped), with edge fades hinting
     *  at hidden tabs and the active tab scrolled into view on change.
     *  Pass false only for a strip that must never scroll. */
    scrollable: { type: Boolean, default: true },
    /** Show the scroller's auto-hiding overlay scrollbar for the tab
     *  axis (scrollable only). Off by default — the edge fades alone
     *  hint at hidden tabs; opt in where a drag affordance helps
     *  pointer users (dense strips, embedded toolbars). */
    scrollbar: { type: Boolean, default: false },
    /** Optional protruding icon button at the strip's inline-start end
     *  (outside the scroll viewport, hover/tap-revealed). Pressing it
     *  emits `action` with "start". */
    startAction: { type: Object as PropType<TabsEndAction | null>, default: null },
    /** Optional protruding icon button at the strip's inline-end end —
     *  the page bars' trailing "+" (outside the scroll viewport,
     *  hover/tap-revealed). Pressing it emits `action` with "end". */
    endAction: { type: Object as PropType<TabsEndAction | null>, default: null },
    /** When ≥ 0 and the `#overlay` slot is provided, render the overlay
     *  layer covering the track to the right of tab[overlayFrom]
     *  (measured geometry; the covered tabs are usually disabled —
     *  "option locking"). -1 disables the layer. */
    overlayFrom: { type: Number, default: -1 },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    /** A protruding end button was pressed. */
    action: (_side: "start" | "end") => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const triggerRefs = ref<Map<number, HTMLElement>>(new Map());
    const indicatorStyle = ref<Record<string, string>>({});
    const overlayStyle = ref<Record<string, string> | undefined>(undefined);
    const scrollerRef = ref<ScrollerExpose | null>(null);
    const listRef = ref<HTMLElement | null>(null);

    const isSegmented = computed(() => props.variant === "segmented");
    const isBlock = computed(() => isSegmented.value && props.block);
    // No active tab (modelValue matches nothing / active disabled): keep
    // the first enabled trigger tabbable so the group stays reachable —
    // otherwise every trigger would be tabindex=-1.
    const fallbackTabbableIdx = computed(() => {
      const hasActive = props.tabs.some(
        (tb) => tb.key === props.modelValue && !tb.disabled,
      );
      if (hasActive) return -1;
      return props.tabs.findIndex((tb) => !tb.disabled);
    });
    const hasOverlay = computed(
      () => props.overlayFrom >= 0 && props.overlayFrom < props.tabs.length - 1 && slots.overlay != null,
    );

    function resolvedActionLabel(action: TabsEndAction): string {
      return action.label || t("hikari::tabs.add", "Add tab");
    }

    function setTriggerRef(el: Element | ComponentPublicInstance | null, idx: number) {
      if (el instanceof HTMLElement) {
        triggerRefs.value.set(idx, el);
      } else {
        triggerRefs.value.delete(idx);
      }
    }

    function updateIndicator() {
      const idx = props.tabs.findIndex((tb) => tb.key === props.modelValue);
      const el = triggerRefs.value.get(idx >= 0 ? idx : 0);
      if (!el) return;
      const left = `${el.offsetLeft}px`;
      const width = `${el.offsetWidth}px`;
      if (indicatorStyle.value.left === left && indicatorStyle.value.width === width) return;
      indicatorStyle.value = { left, width };
    }

    function updateOverlay() {
      if (!hasOverlay.value) {
        overlayStyle.value = undefined;
        return;
      }
      const el = triggerRefs.value.get(props.overlayFrom);
      const list = listRef.value;
      if (!el || !list) return;
      const leftPx = el.offsetLeft + el.offsetWidth + TRACK_GAP;
      const listWidth = list.clientWidth;
      if (el.offsetWidth > 0 && listWidth > leftPx + TRACK_PAD) {
        overlayStyle.value = {
          left: `${leftPx}px`,
          width: `${listWidth - leftPx - TRACK_PAD}px`,
        };
        return;
      }
      // Pre-measurement fallback (SSR / hidden / layout-less): cover the
      // tail by equal-share estimate, like the indicator's zero-geometry
      // phase — the measured style takes over once real layout exists.
      const share = (props.overlayFrom + 1) / props.tabs.length;
      overlayStyle.value = { left: `${(share * 100).toFixed(4)}%` };
    }

    /** Nudge the scroller so the active trigger is fully visible with
     *  a small breathing margin on either side. Manual scroll math (not
     *  scrollIntoView) so only the scroller's own axis moves — the
     *  surrounding page never scrolls. */
    function scrollActiveIntoView() {
      const vp = scrollerRef.value?.getScrollElement?.();
      if (!vp) return;
      const idx = props.tabs.findIndex((tb) => tb.key === props.modelValue);
      const el = triggerRefs.value.get(idx >= 0 ? idx : 0);
      if (!el) return;
      const left = el.offsetLeft;
      const right = left + el.offsetWidth;
      const pad = 24;
      if (left - pad < vp.scrollLeft) {
        vp.scrollLeft = Math.max(0, left - pad);
      } else if (right + pad > vp.scrollLeft + vp.clientWidth) {
        vp.scrollLeft = right + pad - vp.clientWidth;
      }
    }

    function refreshGeometry() {
      updateIndicator();
      updateOverlay();
      if (props.scrollable) scrollActiveIntoView();
    }

    let resizeObserver: ResizeObserver | null = null;
    let scrollerResizeObserver: ResizeObserver | null = null;

    onMounted(() => {
      nextTick(refreshGeometry);
      resizeObserver = new ResizeObserver(() => refreshGeometry());
      const firstEl = triggerRefs.value.get(0);
      if (firstEl?.parentElement) {
        resizeObserver.observe(firstEl.parentElement);
      }
      if (props.scrollable) {
        // The indicator observer watches the content-sized list, so a
        // viewport-only resize (container narrowing) never re-runs the
        // active-tab nudge — observe the scroller viewport itself.
        nextTick(() => {
          const vp = scrollerRef.value?.getScrollElement?.();
          if (!vp) return;
          scrollerResizeObserver = new ResizeObserver(() => scrollActiveIntoView());
          scrollerResizeObserver.observe(vp);
        });
      }
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      scrollerResizeObserver?.disconnect();
      scrollerResizeObserver = null;
    });

    watch(() => props.modelValue, () => nextTick(refreshGeometry));

    watch(() => props.tabs, () => {
      triggerRefs.value.clear();
      nextTick(refreshGeometry);
    }, { deep: true });

    watch(() => props.overlayFrom, () => nextTick(refreshGeometry));

    // ── Keyboard navigation ─────────────────────────────────────────
    // role=tab/radio buttons have no native arrow behavior — the strip
    // owns it. Selection follows focus; disabled tabs are skipped;
    // Home/End jump to the first/last enabled tab.
    function focusTrigger(idx: number) {
      void nextTick(() => triggerRefs.value.get(idx)?.focus());
    }
    function selectIndex(idx: number) {
      const tb = props.tabs[idx];
      if (!tb || tb.disabled || tb.key === props.modelValue) return;
      emit("update:modelValue", tb.key);
      focusTrigger(idx);
    }
    function moveSelection(from: number, delta: number) {
      const n = props.tabs.length;
      if (n === 0) return;
      let idx = from;
      for (let step = 0; step < n; step += 1) {
        idx = (idx + delta + n) % n;
        if (!props.tabs[idx].disabled) {
          selectIndex(idx);
          return;
        }
      }
    }
    function onKeydown(e: KeyboardEvent) {
      // Only drive strip navigation from triggers — interactive overlay
      // content (inputs, sliders inside the #overlay slot) keeps its keys.
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest(".hk-tabs-trigger")) return;
      const current = Math.max(0, props.tabs.findIndex((tb) => tb.key === props.modelValue));
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          moveSelection(current, 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          moveSelection(current, -1);
          break;
        case "Home": {
          const first = props.tabs.findIndex((tb) => !tb.disabled);
          if (first >= 0) selectIndex(first);
          break;
        }
        case "End": {
          for (let i = props.tabs.length - 1; i >= 0; i -= 1) {
            if (!props.tabs[i].disabled) {
              selectIndex(i);
              break;
            }
          }
          break;
        }
        default:
          return;
      }
      e.preventDefault();
    }

    return () => {
      const list = (
        <div
          class="hk-tabs-list"
          ref={listRef}
          data-variant={props.variant}
          data-block={isBlock.value ? "true" : undefined}
          role={isSegmented.value ? "radiogroup" : "tablist"}
          onKeydown={onKeydown}
        >
          <div class="hk-tabs-indicator" style={indicatorStyle.value} />
          {props.tabs.map((tab, idx) => {
            const active = tab.key === props.modelValue;
            const disabled = tab.disabled;
            const icon = slots[`icon-${tab.key}`]?.() ?? (tab.icon != null ? <span class="hk-tabs-trigger-icon">{tab.icon as any}</span> : null);
            return (
              <button
                key={tab.key}
                ref={(el) => setTriggerRef(el, idx)}
                type="button"
                role={isSegmented.value ? "radio" : "tab"}
                aria-checked={isSegmented.value ? active : undefined}
                aria-selected={isSegmented.value ? undefined : active}
                aria-disabled={disabled || undefined}
                class="hk-tabs-trigger"
                data-active={active || undefined}
                data-disabled={props.disabled || disabled || undefined}
                // Roving tabindex: the active trigger joins the page tab
                // sequence, the others stay arrow-reachable.
                tabindex={active || idx === fallbackTabbableIdx.value ? undefined : -1}
                disabled={props.disabled || disabled}
                onClick={() => {
                  if (!props.disabled && !disabled && tab.key !== props.modelValue) emit("update:modelValue", tab.key);
                }}
              >
                {icon}
                {tab.label && <span>{tab.label}</span>}
              </button>
            );
          })}
          {hasOverlay.value && (
            <div class="hk-tabs-overlay" style={overlayStyle.value}>
              {slots.overlay?.()}
            </div>
          )}
        </div>
      );

      // Named const, NOT a mutable `strip` binding: the slot closures
      // below execute during HkHoverRevealAction's render — a closure
      // over a variable that already holds the wrapper vnode itself
      // would recurse forever.
      const actionsAttr = props.startAction && props.endAction ? "both"
        : props.startAction ? "start"
        : props.endAction ? "end"
        : undefined;
      const stripInner = (
        <div class="hk-tabs" data-variant={props.variant} data-scrollable={props.scrollable || undefined} data-actions={actionsAttr}>
          {props.scrollable ? (
            <HkScrollContainer
              ref={scrollerRef}
              class="hk-tabs-scroller"
              axis="horizontal"
              scrollbar={props.scrollbar}
              // A block (row-filling) strip never needs safe centering —
              // it stretches to the row while it fits; centering is for
              // inline strips only.
              align={isBlock.value ? "start" : "center"}
              fade
            >
              {list}
            </HkScrollContainer>
          ) : list}

          {props.renderPanels && !isSegmented.value && props.tabs.map((tab) => (
            <div
              key={tab.key}
              role="tabpanel"
              class="hk-tabs-panel"
              data-active={(tab.key === props.modelValue) || undefined}
            >
              {tab.key === props.modelValue && slots[tab.key]?.()}
            </div>
          ))}
        </div>
      );

      // Optional protruding icon buttons at either inline end ride the
      // shared hover-reveal surface: the strip is the reveal host and the
      // button is its extension, protruding outside the scroll viewport
      // and appearing on hover / touch-tap only. With BOTH ends present
      // the two hosts nest (start outer / end inner) — each closure
      // captures a DIFFERENT named const (stripInner / withEnd), so no
      // slot ever re-renders the wrapper that owns it.
      const actionButton = (side: "start" | "end") => {
        const action = side === "start" ? props.startAction : props.endAction;
        if (!action) return null;
        const label = resolvedActionLabel(action);
        const PlusIcon = iconByName("Plus") as any;
        const icon = action.icon != null ? action.icon : (PlusIcon ? h(PlusIcon, { size: 14 }) : null);
        return (
          <HkIconButton
            variant="ghost"
            size={24}
            aria-label={label}
            {...{ title: label }}
            onClick={() => emit("action", side)}
          >
            {{ icon: () => icon }}
          </HkIconButton>
        );
      };

      const withEnd = props.endAction ? (
        <HkHoverRevealAction
          as="span"
          class="hk-tabs-addwrap"
        >
          {{
            default: () => stripInner,
            extension: () => actionButton("end"),
          }}
        </HkHoverRevealAction>
      ) : stripInner;

      if (!props.startAction) return withEnd;
      return (
        <HkHoverRevealAction
          as="span"
          class="hk-tabs-addwrap"
          placement="left"
        >
          {{
            default: () => withEnd,
            extension: () => actionButton("start"),
          }}
        </HkHoverRevealAction>
      );
    };
  },
});
