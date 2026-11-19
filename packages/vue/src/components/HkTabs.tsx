import { computed, defineComponent, h, nextTick, onBeforeUnmount, onBeforeUpdate, onMounted, onUpdated, ref, watch, TransitionGroup, type ComponentPublicInstance, type PropType, type VNodeChild } from "vue";
import { Ellipsis } from "lucide-vue-next";

import "./HkTabs.scss";
import HkScrollContainer from "./HkScrollContainer";
import HkHoverRevealAction from "./HkHoverRevealAction";
import HkIconButton from "./HkIconButton";
import HkTransitionContainer from "./HkTransitionContainer";
import HkCornerBadge from "./HkCornerBadge";
import type { CornerBadgePlacement, CornerBadgeVariant } from "./HkCornerBadge";
import { iconByName } from "../composables/iconRegistry";
import { useI18n } from "../i18n/context";
import { clearLeaveGeometry, pinLeaveGeometry, type LeaveBoxSnapshot } from "../utils/dom";
import {
  bindContextMenu,
  useContextMenu,
  type ContextMenuRequest,
  type ContextTriggerPoint,
} from "../composables/useContextMenu";

/** DEV-only drift alarms that must survive re-renders without spamming:
 *  a render function runs per tick, so each distinct alarm fires once. */
const warnedOnce = new Set<string>();
function warnOnce(id: string, ...args: unknown[]): void {
  if (!import.meta.env.DEV || warnedOnce.has(id)) return;
  warnedOnce.add(id);
  // eslint-disable-next-line no-console -- dev-only drift alarm
  console.warn(...args);
}

/** Test hook: the once-only cache is module state, so a suite that mounts
 *  the same option key twice would see the second alarm suppressed. */
export function _resetTabsWarnOnceForTests(): void {
  warnedOnce.clear();
}

export interface TabItem {
  /** Unique option key. `$indicator` and `$merged` are reserved — they
   *  key the strip's internal indicator and the merged cell inside the
   *  swap TransitionGroup. */
  key: string;
  label: string;
  /** Optional icon vnode rendered before the label (the `icon-${key}`
   *  slot wins when provided). */
  icon?: unknown;
  /** Count badge rendered on the trigger through HkCornerBadge — the ONE
   *  sup/sub decoration shell (user direction 2026-11-05: hand-rolled
   *  "(n)" count suffixes baked into labels are replaced by the standard
   *  mark, and triggers are badge hosts like every other button). Zero
   *  stays visible: a tab count is presence information (the "（0）" the
   *  inline suffix carried), not notification noise — pass no badge to
   *  hide it entirely. The badge anchors the LABEL, so a tab with an
   *  empty label renders no badge either; pass `label` (an accessible
   *  name like "{n} active") or the mark is aria-hidden decoration and
   *  the count is announced nowhere (a DEV warning fires — a silent a11y
   *  regression must at least be loud). */
  badge?: {
    count: number;
    /** "N+" ceiling (HkCornerBadge.max). */
    max?: number;
    /** Where the mark hangs (HkCornerBadge.placement). Default `right`:
     *  a tab trigger is a BUTTON-GROUP member, so the mark sits BESIDE
     *  the label, vertically centered and never covering it (user
     *  direction 2026-11-05 — the subscript corner overlay read as
     *  "歪了/盖住了"). Pass a corner only when the host really wants an
     *  overlay mark on the label. */
    placement?: CornerBadgePlacement;
    /** Tone channel (HkCornerBadge.variant names, default "primary"). */
    variant?: CornerBadgeVariant;
    /** Extra clearance in px (HkCornerBadge.offset). Placement-aware
     *  default: side marks are already spaced by the wrapper gap, so they
     *  default to 0; corner marks keep the historical 4 (the pill
     *  straddles the label and the scroller clips ~6px below it). */
    offset?: number;
    /** Accessible name for the mark — strongly expected (DEV-warned
     *  when missing). */
    label?: string;
  };
  disabled?: boolean;
  /**
   * Slot-unit width for block (row-filling) strips: how many equal
   * option slots this trigger occupies (default 1). Declaring ANY span
   * (or using a merged cell, which always spans its run length) flips
   * the strip onto slot-unit distribution — one `1fr` grid track per
   * unit — so every option lands on an exact fraction of the row and
   * the total width stays constant while options merge and unmerge
   * (the theme toggle's altitude strip keeps the exact Light+Dark
   * footprint it replaces). Fractional values round and values below 1
   * clamp to 1. Ignored outside block strips.
   */
  span?: number;
  /** Attached hover-revealed action buttons for this option (2026-11-19
   *  user direction — the theme panel's auto-mode 配置 entry is the
   *  first consumer). Rendered as SIBLINGS of the trigger inside the
   *  option's cell wrapper — never children (a button inside a button
   *  is invalid HTML). Revealed on cell hover / focus-within on pointer
   *  devices; on touch there is no hover, so the reachable path is the
   *  option's `contextMenu` binding (long-press) — pair the two when
   *  touch matters. Ignored while the option is collapsed into a merged
   *  cell (a DEV warning fires). Actions never affect selection,
   *  keyboard navigation or the slot-unit math; the sliding indicator
   *  frames the CELL, whose geometry equals the trigger's. */
  actions?: TabsTriggerAction[];
  /** Right-click / touch-long-press / keyboard-menu-key binding for
   *  this option's trigger (the shared bindContextMenu grammar — menus
   *  resolve innermost-first against the global regime). Return the
   *  request to open a menu; return null to defer outward (the global
   *  default regime then answers, e.g. the built-in clipboard menu on
   *  editables). Without a provider mounted the binding is a no-op —
   *  a context menu is an enhancement, never load-bearing. */
  contextMenu?: (point: ContextTriggerPoint) => ContextMenuRequest | null;
}

/** One attached action button of a trigger (see {@link TabItem.actions}).
 *  `label` is required — an unnamed icon button is an a11y hole, and a
 *  DEV warning fires without it. */
export interface TabsTriggerAction {
  /** Stable identity (list key + test hook). */
  key: string;
  /** Icon vnode; omitted → the default Ellipsis glyph. */
  icon?: unknown;
  /** Accessible name + native tooltip. */
  label: string;
  /** Disable just this action (the trigger stays live). */
  disabled?: boolean;
  /** Pressed. The action never toggles/selects the option itself. */
  onSelect: () => void;
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
 *   while "auto" is active). The cell is a real in-flow child of the
 *   track (never an absolute cover), so it joins layout AND the animation
 *   context: options/cells fade-swap on merge changes, and the sliding
 *   indicator measures the cell when the active key is merged. Merged
 *   options are skipped by keyboard navigation;
 * - slot-unit distribution (block strips): a merged cell always spans
 *   its run's option count and `TabItem.span` may size any trigger —
 *   the row is then divided into one equal `1fr` grid track per unit,
 *   so merging Light+Dark into the altitude strip swaps TWO one-unit
 *   slots for ONE two-unit cell and nothing else on the strip moves;
 * - morphing tab panels (pill mode, `renderPanels`): the panel area is
 *   ONE HkTransitionContainer keyed on the active tab — switching tabs
 *   dissolves the outgoing panel through HkCrossfade while the
 *   container height-morphs to the incoming panel's natural size
 *   (panels never had switch CSS before — inactive ones were simply
 *   display:none'd, so nothing visual is layered away);
 * - `TabItem.actions` + `TabItem.contextMenu` — per-option attached
 *   action buttons (hover/focus-revealed, siblings of the trigger inside
 *   a `.hk-tabs-cell`) and a per-option right-click / long-press /
 *   menu-key binding; `trigger-<key>` slots replace a trigger's content
 *   entirely (the `icon-<key>` slot's whole-trigger sibling — same
 *   naming family, same per-key contract);
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
    /** Accessible name of the track (the tablist's / radiogroup's
     *  aria-label). A segmented strip is a form control — its filter
     *  hosts label the DIMENSION ("Running state", "Node status"), and
     *  an unnamed radiogroup inside a named popover is what the former
     *  HkSegmentedRadio's `label` prop existed to prevent. */
    ariaLabel: { type: String, default: undefined },
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
     *  merged option's place as a real in-flow child of the track,
     *  joining layout AND the animation context (swap transitions + the sliding
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
    // Per-option context-menu bindings ride the shared app-wide menu
    // (no provider mounted → the NOOP api, and the binding is silent).
    const contextMenuApi = useContextMenu();
    const triggerRefs = ref<Map<number, HTMLElement>>(new Map());
    /** Context-menu bindings actually installed, keyed by the ELEMENT
     *  they are bound to (NOT by option index — Vue fires a function
     *  ref's `null` with the ref's ORIGINAL index, so an index-keyed
     *  cleanup tears down whatever entry now sits there, including a
     *  live sibling's freshly installed binding after a shrinking list
     *  patch). Rebinding happens only when the element instance (or the
     *  option behind it) changes. */
    const contextBindings = new Map<HTMLElement, { key: string; unbind: () => void }>();
    /** The CURRENT option list, readable from the bound handlers. A plain
     *  binding (not a ref) on purpose: the handlers run on events, long
     *  after render, and must see the latest closures without writing
     *  reactive state during render. Dispatch is by option KEY (not the
     *  captured index) so a reordered list can never serve the wrong
     *  option's menu. */
    let tabsNow: TabItem[] = [];
    /** The framed element per index when the option renders a CELL
     *  (actions present) — the sliding indicator and the active-scroll
     *  nudge measure the cell, whose geometry equals the trigger's but
     *  whose offsetParent chain stays the list (the cell is the
     *  positioned ancestor, so the button's own offsets would be
     *  cell-relative and break the indicator math). */
    const cellRefs = ref<Map<number, HTMLElement>>(new Map());
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
    /** First-wins collapse of duplicate keys plus a DEV alarm. The
     *  contract says keys are unique; a duplicate renders TWO
     *  aria-checked controls for one value with roving tabindex broken,
     *  and Vue's own keyed-patch warning never fires for identical
     *  ORDERED keys (they sync 1:1), so the alarm lives here. Ported
     *  from the deleted HkSegmentedRadio with its pin tests when the
     *  duplicate component was removed (R2, 2026-10-28). Every index —
     *  merged runs, slot units, refs map, keyboard nav, the indicator —
     *  derives from THIS list, so the collapse keeps them all
     *  consistent. */
    const tabs = computed(() => {
      const seen = new Set<string>();
      const list = props.tabs.filter((tb) => {
        if (seen.has(tb.key)) return false;
        seen.add(tb.key);
        return true;
      });
      if (import.meta.env.DEV && list.length !== props.tabs.length) {
        // eslint-disable-next-line no-console -- dev-only drift alarm
        console.warn(
          "[HkTabs] duplicate tab keys dropped:",
          props.tabs.map((tb) => tb.key).join(", "),
        );
      }
      if (import.meta.env.DEV) {
        // A badge the strip renders as aria-hidden decoration is a
        // SILENT a11y regression against the inline "(n)" suffix it
        // replaces — the count was part of the accessible name before
        // and is announced nowhere now. Same tier as the duplicate-key
        // drift alarm above.
        for (const tb of props.tabs) {
          if (tb.badge && !tb.badge.label) {
            // eslint-disable-next-line no-console -- dev-only drift alarm
            console.warn(
              "[HkTabs] tab badge without a label is aria-hidden — pass badge.label so the count is announced:",
              tb.key,
            );
          }
        }
      }
      return list;
    });
    /** Merged keys actually present in `tabs`, in tab order. */
    const mergedRun = computed(() =>
      tabs.value.filter((tb) => mergeSet.value.has(tb.key)).map((tb) => tb.key),
    );
    /** The contract is ONE contiguous run; a scattered selection would
     *  silently swallow the middle options, so degrade to plain
     *  triggers instead. */
    const mergedContiguous = computed(() => {
      const idxs = tabs.value
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
    /** Slot-unit weight of an option (TabItem.span): non-integers round
     *  and the value is clamped into [1, 64], so a bogus or absurd value
     *  degrades to sane track counts instead of poisoning the grid
     *  (browsers cap repeat() counts; beyond that the declaration would
     *  become invalid at computed-value time and drop the division). */
    function slotSpan(tab: TabItem): number {
      const s = tab.span;
      if (typeof s !== "number" || s < 1) return 1;
      return Math.min(64, Math.max(1, Math.round(s)));
    }
    /** Slot-unit distribution (block strips only): active when a merged
     *  cell actually renders (it always spans its run length) or ANY
     *  option declares a span. Plain strips — including a degraded merge
     *  that fell back to plain triggers — never see the attribute and
     *  keep the content-sized block flex exactly as before. */
    const slotMode = computed(
      () =>
        hasMergedCell.value ||
        tabs.value.some((tb) => slotSpan(tb) !== 1),
    );
    /** Total slot units the strip is divided into while in slot mode:
     *  every rendered option contributes its clamped span, and the
     *  merged cell contributes its run's option count (it replaces
     *  those triggers). Matches the grid track count in HkTabs.scss. */
    const slotUnits = computed(() => {
      let units = 0;
      for (const tb of tabs.value) {
        if (isMergedTab(tb)) continue;
        units += slotSpan(tb);
      }
      return units + (hasMergedCell.value ? mergedRun.value.length : 0);
    });
    /** Navigable = rendered trigger: not disabled, not whole-strip
     *  disabled upstream, and not collapsed into the merged cell. */
    function isNavigable(tab: TabItem): boolean {
      return !tab.disabled && !isMergedTab(tab);
    }
    // No active tab (modelValue matches nothing / active disabled or
    // merged): keep the first enabled trigger tabbable so the group
    // stays reachable — otherwise every trigger would be tabindex=-1.
    const fallbackTabbableIdx = computed(() => {
      const hasActive = tabs.value.some(
        (tb) => tb.key === props.modelValue && isNavigable(tb),
      );
      if (hasActive) return -1;
      return tabs.value.findIndex((tb) => isNavigable(tb));
    });

    function resolvedActionLabel(action: TabsEndAction): string {
      return action.label || t("hikari::tabs.add", "Add tab");
    }

    function setTriggerRef(el: Element | ComponentPublicInstance | null, idx: number, tab: TabItem) {
      if (el instanceof HTMLElement) {
        // (Re)bind the option's context-menu grammar (right-click,
        // long-press, keyboard menu key) only when this is genuinely a
        // NEW element (or the element got reused for another option):
        // the render function passes a fresh function-ref every render,
        // so an unconditional rebind would tear down and reinstall the
        // listeners on every tick.
        const bound = contextBindings.get(el);
        if (bound && bound.key === tab.key) {
          triggerRefs.value.set(idx, el);
          return;
        }
        bound?.unbind();
        contextBindings.delete(el);
        if (tab.contextMenu) {
          const boundKey = tab.key;
          const unbind = bindContextMenu(el, contextMenuApi, (point) => {
            // Always dispatch to the LATEST handler of this option.
            const live = tabsNow.find((tb) => tb.key === boundKey);
            return live?.contextMenu?.(point) ?? null;
          });
          contextBindings.set(el, { key: boundKey, unbind });
        }
        triggerRefs.value.set(idx, el);
      } else {
        // A ref's null value carries the ORIGINAL index, which may now
        // belong to a different (live) option — never unbind by index
        // here. Detached elements are pruned by pruneDetachedBindings.
        triggerRefs.value.delete(idx);
      }
    }

    function setCellRef(el: Element | ComponentPublicInstance | null, idx: number) {
      if (el instanceof HTMLElement) {
        cellRefs.value.set(idx, el);
      } else {
        // Same stale-index trap as setTriggerRef: only drop the record
        // when it no longer points at a live element, so a shrinking
        // list cannot evict a sibling's freshly patched cell (which
        // would silently fall back to measuring the trigger).
        const current = cellRefs.value.get(idx);
        if (!current || !current.isConnected) cellRefs.value.delete(idx);
      }
    }

    /** Tear down every context-menu binding (the tabs watcher drops the
     *  whole option set on any change — stale indices must not keep
     *  live listeners on detached elements). */
    /** Drop bindings whose element left the document. Deliberately NOT
     *  a full teardown on every option-list change: the option arrays
     *  are rebuilt per parent render, and each unbind cancels an
     *  in-progress long-press — a full sweep there would swallow the
     *  touch menu on any repaint. */
    function pruneDetachedBindings() {
      for (const [el, bound] of [...contextBindings]) {
        if (!el.isConnected) {
          bound.unbind();
          contextBindings.delete(el);
        }
      }
    }

    function unbindAllContextMenus() {
      for (const bound of contextBindings.values()) bound.unbind();
      contextBindings.clear();
    }

    function setMergedCellRef(el: Element | ComponentPublicInstance | null) {
      mergedCellRef.value = el instanceof HTMLElement ? el : null;
    }

    /** The element the indicator should frame: the CELL when the active
     *  option renders one (actions present — geometry equals the
     *  trigger's, but only the cell's offsets resolve against the
     *  list), the merged cell when the active key is collapsed into it,
     *  otherwise the active trigger (falling back to the first option's
     *  render — trigger OR cell — while no geometry exists). */
    function activeFrameEl(): HTMLElement | undefined {
      const idx = tabs.value.findIndex((tb) => tb.key === props.modelValue);
      const i = idx >= 0 ? idx : 0;
      const tab = tabs.value[i];
      if (tab && isMergedTab(tab)) {
        return mergedCellRef.value ?? undefined;
      }
      return cellRefs.value.get(i) ?? triggerRefs.value.get(i);
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

    // Post-patch prune: the `props.tabs` watcher runs BEFORE Vue patches
    // the DOM, so an element this very update detaches still reports
    // itself connected there. After the patch it is genuinely gone.
    onUpdated(() => {
      pruneDetachedBindings();
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      scrollerResizeObserver?.disconnect();
      scrollerResizeObserver = null;
      unbindAllContextMenus();
    });

    watch(() => props.modelValue, () => nextTick(refreshGeometry));

    watch(() => props.tabs, () => {
      triggerRefs.value.clear();
      cellRefs.value.clear();
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
      const tb = tabs.value[idx];
      if (!tb || !isNavigable(tb) || props.disabled || tb.key === props.modelValue) return;
      emit("update:modelValue", tb.key);
      focusTrigger(idx);
    }
    function moveSelection(from: number, delta: number) {
      const n = tabs.value.length;
      if (n === 0) return;
      let idx = from;
      for (let step = 0; step < n; step += 1) {
        idx = (idx + delta + n) % n;
        if (isNavigable(tabs.value[idx])) {
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
      const current = Math.max(0, tabs.value.findIndex((tb) => tb.key === props.modelValue));
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
          const first = tabs.value.findIndex((tb) => isNavigable(tb));
          if (first >= 0) selectIndex(first);
          break;
        }
        case "End": {
          for (let i = tabs.value.length - 1; i >= 0; i -= 1) {
            if (isNavigable(tabs.value[i])) {
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
      // Read side of the context-menu bindings (see tabsNow's doc).
      tabsNow = tabs.value;
      const mergedHead = mergedRun.value[0];
      /** The ONE panel on stage: the active tab's, when panels render
       *  (pill mode only) and the tab is not collapsed into the merged
       *  cell — merged options' panels are not rendered while merged
       *  (unchanged contract; the whole container drops out instead). */
      const panelTab = props.renderPanels && !isSegmented.value
        ? tabs.value.find((tb) => tb.key === props.modelValue && !isMergedTab(tb))
        : undefined;
      const listChildren = [
        <div
          key="$indicator"
          class="hk-tabs-indicator"
          style={indicatorStyle.value}
          data-ready={indicatorReady.value || undefined}
        />,
      ];
      tabs.value.forEach((tab, idx) => {
        if (isMergedTab(tab)) {
          // Attached actions have no trigger to attach to while the run
          // is collapsed — documented ignore, loud ONCE in DEV (a render
          // function repeats, a drift alarm must not).
          if (tab.actions?.length) {
            warnOnce(`merged-actions:${tab.key}`, "[HkTabs] actions on a merged tab are ignored:", tab.key);
          }
          // The merged run renders as ONE combined cell at its first
          // option's position — a real in-flow child of the track (joins
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
                // The cell occupies as many slot units as the options it
                // replaces (see HkTabs.scss slot-unit distribution).
                style={{ "--hk-tabs-span": String(mergedRun.value.length) }}
              >
                {slots.merged?.({ keys: mergedRun.value })}
              </div>,
            );
          }
          return;
        }
        const active = tab.key === props.modelValue;
        const disabled = tab.disabled;
        // The badge default is placement-aware: a side mark is spaced by
        // the wrapper (offset 0), a corner mark keeps the clearance that
        // keeps the straddling pill inside the scroller viewport.
        const badgePlacement = tab.badge?.placement ?? "right";
        const badgeOffset =
          tab.badge?.offset ??
          (badgePlacement === "right" || badgePlacement === "left" ? 0 : 4);
        // `icon` is a deliberately loose `unknown` on the public item type
        // (hosts may pass vnodes materialized against another vue store);
        // at the render site its documented contract is a render child.
        const icon = slots[`icon-${tab.key}`]?.() ?? (tab.icon != null ? <span class="hk-tabs-trigger-icon">{tab.icon as VNodeChild}</span> : null);
        // Attached actions (2026-11-19): rendered through a CELL wrapper
        // so the action buttons are SIBLINGS of the trigger — a button
        // cannot nest a button, and the wrapper (not the trigger) becomes
        // the track child the grid/flex layout and the indicator measure.
        // (Merged-away options are handled — and DEV-alarmed — in the
        // merged branch above; this code only sees plain triggers.)
        const actions = tab.actions?.length ? tab.actions : undefined;
        if (actions?.some((action) => !action.label)) {
          warnOnce(`unlabeled-action:${tab.key}`, "[HkTabs] trigger action without a label is an unnamed button:", tab.key);
        }
        const trigger = (
          <button
            // Keyed child of the swap TransitionGroup — a CELL takes the
            // key when the option carries actions (the button is then an
            // unkeyed cell child; the cell is the track child).
            key={actions ? undefined : tab.key}
            ref={(el) => setTriggerRef(el, idx, tab)}
            type="button"
            role={isSegmented.value ? "radio" : "tab"}
            aria-checked={isSegmented.value ? active : undefined}
            aria-selected={isSegmented.value ? undefined : active}
            aria-disabled={disabled || undefined}
            class="hk-tabs-trigger"
            data-active={active || undefined}
            data-disabled={props.disabled || disabled || undefined}
            // Slot-unit weight (1 unless the option declares a span);
            // only consumed while the strip carries data-slots (a CELL,
            // not the trigger, is the direct child then).
            style={{ "--hk-tabs-span": String(slotSpan(tab)) }}
            // Roving tabindex: the active trigger joins the page tab
            // sequence, the others stay arrow-reachable.
            tabindex={active || idx === fallbackTabbableIdx.value ? undefined : -1}
            disabled={props.disabled || disabled}
            onClick={() => {
              if (!props.disabled && !disabled && tab.key !== props.modelValue) emit("update:modelValue", tab.key);
            }}
          >
            {(() => {
              const triggerSlot = slots[`trigger-${tab.key}`];
              if (triggerSlot) {
                if (tab.icon != null || tab.badge) {
                  warnOnce(
                    `trigger-slot-drops-decor:${tab.key}`,
                    "[HkTabs] trigger-<key> slot replaces the icon and badge of:",
                    tab.key,
                  );
                }
                return triggerSlot({ tab });
              }
              return null;
            })() ?? (
              <>
                {icon}
                {/* The badge anchors the LABEL (inside the trigger's own
                 *  padding box) rather than the button box: the mark reads
                 *  as part of the control's silhouette. A tab is a
                 *  BUTTON-GROUP member, so its default is the side placement
                 *  (`right`, vertically centered): the label keeps its full
                 *  box and the strip grows by the mark + gap — a corner
                 *  overlay straddled the label and read as covering it (user
                 *  report 2026-11-05). Corner placements stay available for
                 *  hosts that want the overlay on purpose. */}
                {tab.label && (tab.badge ? (
                  <HkCornerBadge
                    count={tab.badge.count}
                    max={tab.badge.max}
                    showZero
                    placement={badgePlacement}
                    offset={badgeOffset}
                    variant={tab.badge.variant ?? "primary"}
                    label={tab.badge.label}
                  >
                    <span>{tab.label}</span>
                  </HkCornerBadge>
                ) : (
                  <span>{tab.label}</span>
                ))}
              </>
            )}
          </button>
        );
        if (actions) {
          listChildren.push(
            <div
              key={tab.key}
              class="hk-tabs-cell"
              role="presentation"
              ref={(el) => setCellRef(el, idx)}
              // The CELL mutes for the same reasons its trigger does: the
              // strip's own flag OR this option's `disabled` (a disabled
              // option's actions must not stay operable — the whole option
              // is inert, not just its label).
              data-disabled={props.disabled || disabled || undefined}
              style={{ "--hk-tabs-span": String(slotSpan(tab)) }}
            >
              {trigger}
              <span class="hk-tabs-trigger-actions">
                {actions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    class="hk-tabs-trigger-action"
                    title={action.label}
                    aria-label={action.label}
                    data-test={`hk-tabs-action-${tab.key}-${action.key}`}
                    // NO tabindex override: the buttons are natively
                    // Tab-reachable, and the reveal is what keeps the
                    // page tab order clean — `visibility: hidden` makes an
                    // unrevealed action UNFOCUSABLE, while focusing the
                    // trigger flips `:focus-within`, which reveals the
                    // cell's actions and hands the next Tab stop to them.
                    disabled={props.disabled || disabled || action.disabled || undefined}
                    onClick={() => {
                      if (!props.disabled && !disabled && !action.disabled) action.onSelect();
                    }}
                  >
                    {(action.icon != null ? action.icon : <Ellipsis size={14} />) as VNodeChild}
                  </button>
                ))}
              </span>
            </div>,
          );
        } else {
          listChildren.push(trigger);
        }
      });
      const list = (
        <div
          class="hk-tabs-list"
          ref={listRef}
          data-variant={props.variant}
          data-block={isBlock.value ? "true" : undefined}
          // Block strips on slot units divide the row into one equal
          // 1fr track per unit instead of by content — see HkTabs.scss.
          data-slots={isBlock.value && slotMode.value ? "" : undefined}
          style={
            isBlock.value && slotMode.value
              ? { "--hk-tabs-units": String(slotUnits.value) }
              : undefined
          }
          role={isSegmented.value ? "radiogroup" : "tablist"}
          aria-label={props.ariaLabel || undefined}
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
        <div
      class="hk-tabs"
      data-variant={props.variant}
      data-scrollable={props.scrollable || undefined}
      data-actions={actionsAttr}
      // A tab strip is interactive content, never a window-drag surface: the
      // scroller pans overflowing strips with its own pointer sweep, which
      // would fight Tauri's caption-band drag on a deep host band (2026-11-12).
      // "false" blocks the ancestor walk — inert outside a Tauri webview.
      data-tauri-drag-region={false}
    >
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

          {/* Panel area (pill mode, renderPanels): ONE morph container
              keyed on the active tab (2026-10-22 animation direction) —
              HkCrossfade dissolves the outgoing panel in the shared grid
              cell while the container's inline-height transition rides the
              incoming panel's natural size. The strip's own hk-tabs-swap
              transitions are untouched; a merged-active strip renders no
              panel at all, exactly as before. */}
          {panelTab && (
            <HkTransitionContainer swapKey={panelTab.key} class="hk-tabs-panels">
              <div role="tabpanel" class="hk-tabs-panel" data-active>
                {slots[panelTab.key]?.()}
              </div>
            </HkTransitionContainer>
          )}
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
        // `iconByName` never returns null (it falls back to `Info`), so the
        // registry lookup is a straight `Component` — no assertion needed.
        const PlusIcon = iconByName("Plus");
        const icon = action.icon != null ? action.icon : h(PlusIcon, { size: 14 });
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
