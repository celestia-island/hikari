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

/** Structural stand-in for HkScrollContainer's exposed surface —
 *  imperative expose() types don't flow through render-function
 *  setups, so declare just the method we consume. */
interface ScrollerExpose {
  getScrollElement?: () => HTMLElement | undefined;
}

const SEG_GAP = 2;
const SEG_PAD = 2;

/**
 * HTabs — THE button-group / tab-strip primitive. One component carries
 * every extension capability so no parallel implementations can drift
 * apart again:
 *
 * Variants:
 * - `underline` — classic anchored text tabs;
 * - `pill` — the centered pill strip (hairline track, primary-tinted
 *   sliding indicator) used by page-level bars;
 * - `segmented` — the compact mode-picker form (solid sliding thumb on a
 *   muted track) for small mutually exclusive choices. Semantics switch
 *   with it: pill/underline expose `tablist`/`tab`/`aria-selected` while
 *   segmented exposes `radiogroup`/`radio`/`aria-checked`.
 *
 * Capabilities (all variants unless noted):
 * - `scrollable` + `scrollbar` + edge fades (HkScrollContainer) and the
 *   protruding hover-revealed trailing "+" (`addable`, emits `add`);
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
    variant: { type: String as PropType<"underline" | "pill" | "segmented">, default: "underline" },
    /** Visual size — sm matches form-control heights (segmented). */
    size: { type: String as PropType<"sm" | "md">, default: "md" },
    /** Grow to fill the container width (segmented). */
    block: { type: Boolean, default: false },
    /** Disable the whole strip (every trigger). */
    disabled: { type: Boolean, default: false },
    /** Render tab panel slots below the strip. Segmented mode pickers
     *  have no panels — panels are skipped for that variant. */
    renderPanels: { type: Boolean, default: true },
    /** Wrap the tab list in a horizontal HkScrollContainer. The list
     *  stays centered while it fits and becomes swipe/scroll-driven
     *  once it overflows (safe centering — the overflowing start is
     *  never clipped), with edge fades hinting at hidden tabs and the
     *  active tab scrolled into view on change. */
    scrollable: { type: Boolean, default: false },
    /** Show the scroller's auto-hiding overlay scrollbar for the tab
     *  axis (scrollable only). Off by default — the edge fades alone
     *  hint at hidden tabs; opt in where a drag affordance helps
     *  pointer users (dense strips, embedded toolbars). */
    scrollbar: { type: Boolean, default: false },
    /** Render a trailing "add" button protruding at the right edge of
     *  the strip — hover-revealed on pointer devices, tap-revealed with
     *  a linger on touch (the shared HkHoverRevealAction behavior). The
     *  button lives OUTSIDE the scroll viewport so it never scrolls
     *  away. Emits `add`. */
    addable: { type: Boolean, default: false },
    /** Accessible label / tooltip for the add button (falls back to the
     *  shared "Add tab" string). */
    addLabel: { type: String, default: "" },
    /** When ≥ 0 and the `#overlay` slot is provided, render the overlay
     *  layer covering the track to the right of tab[overlayFrom]
     *  (measured geometry; the covered tabs are usually disabled —
     *  "option locking"). -1 disables the layer. */
    overlayFrom: { type: Number, default: -1 },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    /** The add button was pressed (addable only). */
    add: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const triggerRefs = ref<Map<number, HTMLElement>>(new Map());
    const indicatorStyle = ref<Record<string, string>>({});
    const overlayStyle = ref<Record<string, string> | undefined>(undefined);
    const scrollerRef = ref<ScrollerExpose | null>(null);
    const listRef = ref<HTMLElement | null>(null);

    const isSegmented = computed(() => props.variant === "segmented");
    const hasIndicator = computed(() => props.variant !== "underline");
    const hasOverlay = computed(
      () => props.overlayFrom >= 0 && props.overlayFrom < props.tabs.length - 1 && slots.overlay != null,
    );

    const resolvedAddLabel = (): string =>
      props.addLabel || t("hikari::tabs.add", "Add tab");

    function setTriggerRef(el: Element | ComponentPublicInstance | null, idx: number) {
      if (el instanceof HTMLElement) {
        triggerRefs.value.set(idx, el);
      } else {
        triggerRefs.value.delete(idx);
      }
    }

    function updateIndicator() {
      if (!hasIndicator.value) return;
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
      const leftPx = el.offsetLeft + el.offsetWidth + SEG_GAP;
      const listWidth = list.clientWidth;
      if (el.offsetWidth > 0 && listWidth > leftPx + SEG_PAD) {
        overlayStyle.value = {
          left: `${leftPx}px`,
          width: `${listWidth - leftPx - SEG_PAD}px`,
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
      if (hasIndicator.value) {
        resizeObserver = new ResizeObserver(() => refreshGeometry());
        const firstEl = triggerRefs.value.get(0);
        if (firstEl?.parentElement) {
          resizeObserver.observe(firstEl.parentElement);
        }
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
          data-variant={props.variant === "underline" ? undefined : props.variant}
          data-size={isSegmented.value ? props.size : undefined}
          data-block={isSegmented.value && props.block ? "true" : undefined}
          role={isSegmented.value ? "radiogroup" : "tablist"}
          onKeydown={onKeydown}
        >
          {hasIndicator.value && (
            <div class="hk-tabs-indicator" style={indicatorStyle.value} />
          )}
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
                tabindex={active ? undefined : -1}
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

      // Named const, NOT a mutable `strip` binding: the slot closure below
      // executes during HkHoverRevealAction's render — a closure over a
      // variable that already holds the wrapper vnode itself would recurse
      // forever.
      const stripInner = (
        <div class="hk-tabs" data-variant={props.variant} data-scrollable={props.scrollable || undefined} data-addable={props.addable || undefined}>
          {props.scrollable ? (
            <HkScrollContainer
              ref={scrollerRef}
              class="hk-tabs-scroller"
              axis="horizontal"
              scrollbar={props.scrollbar}
              align="center"
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

      // The addable button rides the shared hover-reveal surface: the
      // whole strip is the reveal host and the "+" is its extension, so
      // it protrudes at the strip's right edge (outside the scroll
      // viewport) and appears on hover / touch-tap only.
      if (!props.addable) return stripInner;

      const PlusIcon = iconByName("Plus") as any;
      return (
        <HkHoverRevealAction
          as="span"
          class="hk-tabs-addwrap"
        >
          {{
            default: () => stripInner,
            extension: () => (
              <HkIconButton
                variant="ghost"
                size={24}
                aria-label={resolvedAddLabel()}
                {...{ title: resolvedAddLabel() }}
                onClick={() => emit("add")}
              >
                {{ icon: () => (PlusIcon ? h(PlusIcon, { size: 14 }) : null) }}
              </HkIconButton>
            ),
          }}
        </HkHoverRevealAction>
      );
    };
  },
});
