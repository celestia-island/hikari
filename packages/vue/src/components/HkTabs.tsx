import { computed, defineComponent, h, nextTick, onBeforeUnmount, onBeforeUpdate, onMounted, ref, watch, TransitionGroup, type ComponentPublicInstance, type PropType } from "vue";

import "./HkTabs.scss";
import HkScrollContainer from "./HkScrollContainer";
import HkHoverRevealAction from "./HkHoverRevealAction";
import HkIconButton from "./HkIconButton";
import { iconByName } from "../composables/iconRegistry";
import { useI18n } from "../i18n/context";
import { clearLeaveGeometry, pinLeaveGeometry, type LeaveBoxSnapshot } from "../utils/dom";

export interface TabItem {
  /** Unique option key. `$indicator` and `$merged` are reserved — they
   *  key the strip's internal indicator and the merged cell inside the
   *  swap TransitionGroup. */
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
 * - `mergeKeys` + the `#merged` slot: DYNAMIC MERGED-OPTION rendering —
 *   a contiguous run of options collapses into ONE combined cell (e.g.
 *   the theme toggle's solar-altitude strip replacing the manual halves
 *   while "auto" is active). The cell is a real flex child of the track
 *   (never an absolute cover), so it joins layout AND the animation
 *   context: options/cells fade-swap on merge changes, and the sliding
 *   indicator measures the cell when the active key is merged. Merged
 *   options are skipped by keyboard navigation;
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
    /** Keys of a contiguous run of options that currently collapse into
     *  ONE merged cell rendered by the `#merged` slot (dynamic
     *  merged-option rendering). Merged triggers are not rendered and
     *  are skipped by keyboard navigation; the cell takes the first
     *  merged option's place as a real flex child of the track, joining
     *  layout AND the animation context (swap transitions + the sliding
     *  indicator measures it when the active key is merged). Pass
     *  undefined/empty to disable. A single-key run is allowed — note
     *  the cell is role=presentation, so that option leaves the radio/
     *  keyboard surface while merged. The keys MUST be a contiguous
     *  run — non-contiguous keys degrade to plain triggers (no cell).
     *  Without the `#merged` slot the listed options render as ordinary
     *  triggers (graceful degradation). In pill mode the merged
     *  options' panels are not rendered while merged. */
    mergeKeys: { type: Array as PropType<string[]>, default: undefined },
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
    /** The indicator fades in once real geometry first lands (no pop-in
     *  on mount), then slides via its left/width transition. */
    const indicatorReady = ref(false);
    /** The merged cell element — measured by the indicator when the
     *  active key is one of the merged options. */
    const mergedCellRef = ref<HTMLElement | null>(null);
    const scrollerRef = ref<ScrollerExpose | null>(null);
    const listRef = ref<HTMLElement | null>(null);

    const isSegmented = computed(() => props.variant === "segmented");
    const isBlock = computed(() => isSegmented.value && props.block);
    const mergeSet = computed(() => new Set(props.mergeKeys ?? []));
    /** Merged keys actually present in `tabs`, in tab order. */
    const mergedRun = computed(() =>
      props.tabs.filter((tb) => mergeSet.value.has(tb.key)).map((tb) => tb.key),
    );
    /** The contract is ONE contiguous run; a scattered selection would
     *  silently swallow the middle options, so degrade to plain
     *  triggers instead. */
    const mergedContiguous = computed(() => {
      const idxs = props.tabs
        .map((tb, i) => (mergeSet.value.has(tb.key) ? i : -1))
        .filter((i) => i >= 0);
      return idxs.length <= 1 || idxs[idxs.length - 1] - idxs[0] === idxs.length - 1;
    });
    /** The merged cell only exists with BOTH keys present in `tabs` (as
     *  one contiguous run) AND the `#merged` slot provided — otherwise
     *  the listed options render as ordinary triggers (degradation
     *  path). */
    const hasMergedCell = computed(
      () => mergedRun.value.length > 0 && mergedContiguous.value && slots.merged != null,
    );
    function isMergedTab(tab: TabItem): boolean {
      return hasMergedCell.value && mergeSet.value.has(tab.key);
    }
    /** Navigable = rendered trigger: not disabled, not whole-strip
     *  disabled upstream, and not collapsed into the merged cell. */
    function isNavigable(tab: TabItem): boolean {
      return !tab.disabled && !isMergedTab(tab);
    }
    // No active tab (modelValue matches nothing / active disabled or
    // merged): keep the first enabled trigger tabbable so the group
    // stays reachable — otherwise every trigger would be tabindex=-1.
    const fallbackTabbableIdx = computed(() => {
      const hasActive = props.tabs.some(
        (tb) => tb.key === props.modelValue && isNavigable(tb),
      );
      if (hasActive) return -1;
      return props.tabs.findIndex((tb) => isNavigable(tb));
    });

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

    function setMergedCellRef(el: Element | ComponentPublicInstance | null) {
      mergedCellRef.value = el instanceof HTMLElement ? el : null;
    }

    /** The element the indicator should frame: the merged cell when the
     *  active option is collapsed into it, otherwise the active trigger
     *  (falling back to the first option's render — trigger OR cell —
     *  while no geometry exists). */
    function activeFrameEl(): HTMLElement | undefined {
      const idx = props.tabs.findIndex((tb) => tb.key === props.modelValue);
      const i = idx >= 0 ? idx : 0;
      const tab = props.tabs[i];
      if (tab && isMergedTab(tab)) {
        return mergedCellRef.value ?? undefined;
      }
      return triggerRefs.value.get(i);
    }

    function updateIndicator() {
      const el = activeFrameEl();
      if (!el) return;
      const left = `${el.offsetLeft}px`;
      const width = `${el.offsetWidth}px`;
      if (indicatorStyle.value.left !== left || indicatorStyle.value.width !== width) {
        indicatorStyle.value = { left, width };
      }
      indicatorReady.value = true;
    }

    /** Nudge the scroller so the active trigger is fully visible with
     *  a small breathing margin on either side. Manual scroll math (not
     *  scrollIntoView) so only the scroller's own axis moves — the
     *  surrounding page never scrolls. */
    function scrollActiveIntoView() {
      const vp = scrollerRef.value?.getScrollElement?.();
      if (!vp) return;
      const el = activeFrameEl();
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
      if (props.scrollable) scrollActiveIntoView();
    }

    let resizeObserver: ResizeObserver | null = null;
    let scrollerResizeObserver: ResizeObserver | null = null;

    onMounted(() => {
      nextTick(refreshGeometry);
      resizeObserver = new ResizeObserver(() => refreshGeometry());
      // Observe the track itself (tab[0] may be merged away, so a
      // trigger-derived parent is not a reliable anchor anymore).
      if (listRef.value) {
        resizeObserver.observe(listRef.value);
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

    watch(() => props.mergeKeys, () => nextTick(refreshGeometry));

    /** Pre-patch geometry of every track child, refreshed on every
     *  update (the DOM is still the pre-patch tree at onBeforeUpdate).
     *  During a multi-option leave (e.g. Light+Dark collapsing into the
     *  merged cell), Vue's patch lifts the first leaving sibling to
     *  position:absolute SYNCHRONOUSLY before the next sibling's
     *  beforeLeave hook runs — a live offset read there would freeze
     *  the already-reflowed position and overlap the ghosts. */
    const preSwapBoxes = new WeakMap<Element, LeaveBoxSnapshot>();
    onBeforeUpdate(() => {
      const list = listRef.value;
      if (!list) return;
      for (const child of Array.from(list.children)) {
        const e = child as HTMLElement;
        preSwapBoxes.set(e, {
          top: e.offsetTop,
          left: e.offsetLeft,
          width: e.offsetWidth,
          height: e.offsetHeight,
        });
      }
    });

    /** Leaving options/cells are pinned at their in-flow geometry by
     *  the shared leave-pin util (left-anchored: the track's
     *  inline-start edge stays put while a middle/tail removal
     *  collapses the right side) so the absolute leave ghost fades in
     *  place; a cancelled leave drops the pins again. */
    function pinLeaving(el: Element) {
      pinLeaveGeometry(el, { anchorX: "left", box: preSwapBoxes.get(el) });
    }

    // ── Keyboard navigation ─────────────────────────────────────────
    // role=tab/radio buttons have no native arrow behavior — the strip
    // owns it. Selection follows focus; disabled and merged-away options
    // are skipped; Home/End jump to the first/last navigable option.
    function focusTrigger(idx: number) {
      void nextTick(() => triggerRefs.value.get(idx)?.focus());
    }
    function selectIndex(idx: number) {
      const tb = props.tabs[idx];
      if (!tb || !isNavigable(tb) || props.disabled || tb.key === props.modelValue) return;
      emit("update:modelValue", tb.key);
      focusTrigger(idx);
    }
    function moveSelection(from: number, delta: number) {
      const n = props.tabs.length;
      if (n === 0) return;
      let idx = from;
      for (let step = 0; step < n; step += 1) {
        idx = (idx + delta + n) % n;
        if (isNavigable(props.tabs[idx])) {
          selectIndex(idx);
          return;
        }
      }
    }
    function onKeydown(e: KeyboardEvent) {
      // Only drive strip navigation from triggers — interactive merged
      // cell content (buttons, inputs inside the #merged slot) keeps
      // its keys.
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
          const first = props.tabs.findIndex((tb) => isNavigable(tb));
          if (first >= 0) selectIndex(first);
          break;
        }
        case "End": {
          for (let i = props.tabs.length - 1; i >= 0; i -= 1) {
            if (isNavigable(props.tabs[i])) {
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
      const mergedHead = mergedRun.value[0];
      const listChildren = [
        <div
          key="$indicator"
          class="hk-tabs-indicator"
          style={indicatorStyle.value}
          data-ready={indicatorReady.value || undefined}
        />,
      ];
      props.tabs.forEach((tab, idx) => {
        if (isMergedTab(tab)) {
          // The merged run renders as ONE combined cell at its first
          // option's position — a real flex child of the track (joins
          // layout and the swap/indicator animation context), never an
          // absolute cover. role=presentation: the radiogroup's a11y
          // surface is the remaining triggers; interactive slot content
          // carries its own semantics.
          if (tab.key === mergedHead) {
            listChildren.push(
              <div
                key="$merged"
                class="hk-tabs-merged"
                ref={setMergedCellRef}
                role="presentation"
                data-keys={mergedRun.value.join(" ")}
                data-disabled={props.disabled || undefined}
              >
                {slots.merged?.({ keys: mergedRun.value })}
              </div>,
            );
          }
          return;
        }
        const active = tab.key === props.modelValue;
        const disabled = tab.disabled;
        const icon = slots[`icon-${tab.key}`]?.() ?? (tab.icon != null ? <span class="hk-tabs-trigger-icon">{tab.icon as any}</span> : null);
        listChildren.push(
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
          </button>,
        );
      });
      const list = (
        <div
          class="hk-tabs-list"
          ref={listRef}
          data-variant={props.variant}
          data-block={isBlock.value ? "true" : undefined}
          role={isSegmented.value ? "radiogroup" : "tablist"}
          onKeydown={onKeydown}
        >
          {/* Tagless group: the track stays a plain element (ref/CSS/
              keydown unchanged) while option/cell inserts and removals
              run through the hk-tabs-swap transitions. */}
          <TransitionGroup name="hk-tabs-swap" onBeforeLeave={pinLeaving} onLeaveCancelled={clearLeaveGeometry}>
            {listChildren}
          </TransitionGroup>
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

          {props.renderPanels && !isSegmented.value && props.tabs.filter((tab) => !isMergedTab(tab)).map((tab) => (
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
