import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  watch,
  type PropType,
} from "vue";

import { useI18n } from "../i18n/context";
import { laidOffsetWithin } from "../composables/layoutGeometry";
import "./HkScrollContainer.scss";
import { attachOverlayScrollbars, type OverlayScrollbarHandle, type OverlayScrollMapSegment, type OverlayScrollbarMarker } from "../composables/useOverlayScrollbar";
import { useApproachEnd, type ApproachEndHandle } from "../composables/useApproachEnd";
import { provideScrollWindow } from "../composables/useScrollWindow";
import { SCROLL_HOST_CLASS } from "./HkScrollPin";
import {
  HK_SCROLL_PROGRESS_REGISTRAR,
  default as HkScrollProgress,
  type HkScrollProgressHandle,
  type HkScrollProgressRegistrar,
} from "./HkScrollProgress";
import { scheduleFrame, notifyScrollStart, onceFrame, type AnimationHandle } from "../runtime/animationBus";
import HFab from "./HkFab";

type ScrollAxis = "vertical" | "horizontal" | "both";
type ScrollMode = "traditional" | "windowed";
type ScrollAlign = "start" | "center";
type OverflowSense = "none" | "start" | "end" | "both";
type SelectionBeyond = "none" | "top" | "bottom" | "both";

/** Which edges of an axis still hide content, derived from live scroll
 *  geometry. "end" = content continues past the end edge (can scroll
 *  towards larger offsets), "start" = content hides before the start
 *  edge, "both" = either side, "none" = everything fits. */
function computeOverflow(scrollSize: number, clientSize: number, scrollPos: number): OverflowSense {
  if (scrollSize <= clientSize + 1) return "none";
  const max = scrollSize - clientSize;
  const atStart = scrollPos <= 1;
  const atEnd = scrollPos >= max - 1;
  if (atStart && atEnd) return "none";
  if (atStart) return "end";
  if (atEnd) return "start";
  return "both";
}

export default defineComponent({
  name: "HkScrollContainer",
  props: {
    as: { type: String, default: "div" },
    axis: { type: String as PropType<ScrollAxis>, default: "vertical" },
    mode: { type: String as PropType<ScrollMode>, default: "traditional" },
    scrollbar: { type: Boolean, default: true },
    /** Change marks for the overlay's right-hand rail (VS Code's overview
     *  ruler): fractions of the FULL content extent, so a mark stays put
     *  while the user scrolls. Vertical axis only, and additive — leaving
     *  it out renders exactly the chrome this container had before the
     *  rail existed. */
    markers: { type: Array as PropType<OverlayScrollbarMarker[]>, default: () => [] },
    /** Width the vertical track widens to while marks show, in px. Omitted
     *  = the library default (14). Only read when `markers` is non-empty. */
    markersWidth: { type: Number, default: undefined },
    /**
     * Asymmetric scroll map (vertical): the scrollbar represents the
     * DOCUMENT while the viewport holds only rendered rows — collapsed
     * regions sweep the thumb quickly and pin the content while dragging
     * (see `OverlayScrollMapSegment`). Omitted = the dom-native bar.
     */
    mapSegments: { type: Array as PropType<OverlayScrollMapSegment[]>, default: undefined },
    autoFollow: { type: Boolean, default: false },
    overscanScreens: { type: Number, default: 1 },
    /** Inline-axis alignment of the content when it fits the viewport.
     *  "center" wraps the slot in an auto-margin aligner: content that
     *  fits stays centered while overflowing content falls back to the
     *  inline-start edge (scrollable, never clipped) — the safe
     *  centering `justify-content: center` cannot provide. Applies to
     *  horizontal-axis containers (toggling at runtime is supported);
     *  ignored for vertical-only and axis="both" containers (the
     *  latter would re-introduce cross-axis center-clipping). */
    align: { type: String as PropType<ScrollAlign>, default: "start" },
    /** Fade the viewport's inline edges (CSS mask) on the sides where
     *  the sensed overflow (`data-h-overflow`) reports hidden content. */
    fade: { type: Boolean, default: false },
    /** Hidden-content distance (px) over which a lit edge fade deepens
     *  from a hard cut to the full band (the progressive fade): the
     *  component senses how much content hides past each edge and
     *  mirrors it as a 0..1 strength (--hk-scroll-fade-strength-<side>)
     *  that scales the band in CSS, so pulling the strip grows the
     *  trailing fade and scrolling back recedes it. Read live (runtime
     *  changes need no remount, like approachDistance). 0 or negative
     *  degrades to the pre-2026-11 binary shape: any lit edge jumps
     *  straight to the full band. Only read while `fade` is on.
     *
     *  RTL normalization assumes the Chromium/WebKit convention
     *  (scrollLeft runs 0 → -max): every engine hikari deploys on is
     *  Chromium-family (the sheet's WebView notes). A legacy
     *  positive-descending engine would clamp the normalized offset to
     *  0 — bounded degradation: the sense parks at "end" and one fade
     *  stays saturated, never inverted. */
    fadeDistance: { type: Number, default: 96 },
    /** Additive opt-in: while autoFollow is enabled and the user has
     *  scrolled away from the bottom, float a small jump-back FAB that
     *  snaps to the latest content and re-arms follow. */
    followAffordance: { type: Boolean, default: false },
    /** Additive opt-in: sense "the viewport is at/near the end of its
     *  content" and emit `approachEnd` so the consumer can load the
     *  next page of data (infinite/dynamic loading). The event fires on
     *  zone entry and whenever the content geometry grows while still
     *  in the zone — including every pass while the content does not
     *  fill the viewport (CSSOM clamps scrollHeight there, so the
     *  under-filled state always reports; that is what lets a consumer
     *  auto-fill a first screen). Fire-and-dedup contract: guard the
     *  handler with your own loading flag; when a load renders nothing
     *  new (all filtered out downstream), call the exposed `recheck()`
     *  to force the next emission. */
    approachEnd: { type: Boolean, default: false },
    /** Distance in px from the vertical end that still counts as
     *  approaching (`approachEnd`). Read live, so runtime changes need
     *  no remount. */
    approachDistance: { type: Number, default: 160 },
    /** Fade the viewport's bottom edge (CSS mask, --hk-scroll-dock-fade
     *  tall, opacity 100 -> 0) while a dock slot is mounted, so mid-
     *  scroll content dissolving at the dock's edge reads as
     *  intentional instead of a hard clip. */
    dockFade: { type: Boolean, default: true },
    /** Opt-in tail clearance for FLOATING docks (2026-10-12): a dock that
     *  lives OUTSIDE this container (a shell-level fixed plane — a page's
     *  bottom-center dock bar, e.g. chest's DockBar) covers the bottom of
     *  whatever scroll area it hovers over. The shell publishes the dock's
     *  live measured occupancy as `--hk-scroll-tail-bottom` (on any
     *  ancestor, typically :root); with this prop the container spends
     *  that var as an IN-FLOW tail spacer on the viewport's own content,
     *  so the room becomes reachable scroll range that only appears once
     *  the scroll end is reached — mid-scroll content keeps flowing under
     *  the dock across the full viewport. The published value is the
     *  whole tail room the publisher wants spent (dock occupancy plus
     *  whatever breathing room its design rules add).
     *
     *  The spacer is a `flex: none; display: block` ::after, and every
     *  direct child of the viewport is pinned against main-axis SHRINKING
     *  while the prop is on. Both halves are load-bearing: a child that
     *  behaves as a shrinkable flex item once the viewport is flex-ified
     *  (hikari's own `.hk-kanban-lanes` ships only `min-height: 100%`, so
     *  the flex-item initial `0 1 auto` applies) overflows its own box
     *  visibly and paints OVER a spacer that trails the box — the exact
     *  defect that kept a consumer board's tail under its dock through
     *  three rounds of padding adjustments that "never entered the flow"
     *  (chest follow-up to #1538/#1542, root-caused and measured in a real
     *  layout engine, 2026-10-12); and the explicit `display: block` is
     *  what makes the spacer's height apply in the DEFAULT block viewport
     *  at all (a bare ::after there is an inline box and `height` is inert
     *  on it — measured: zero clearance without, content+spacer with).
     *  The spacer is inert while the var is unset/0px, so dockless pages
     *  keep their full centering box; the shrink pin is active whenever
     *  the prop is on. Unlike the dockTop/dockBottom slots (layout-space
     *  docks that shrink the viewport permanently), this contract is for
     *  docks that float OVER the scroll area by design. Do not combine it
     *  with a `--hk-scroll-dock-bottom` end-padding recipe for the SAME
     *  dock (double clearance). The spacer is not generated on
     *  axis="horizontal" containers — the tail is the cross axis there,
     *  and an ungated block spacer leaks onto the hidden vertical axis
     *  (measured: scrollHeight grows and a programmatic scrollTop shifts
     *  content up behind overflow-y:hidden) — while the shrink pin still
     *  applies. A higher-specificity consumer ::after recipe on the
     *  viewport overrides this spacer's height: adopting the prop means
     *  deleting the hand-rolled recipe, not stacking it. The shrink pin's
     *  accepted cost: a child that legitimately needs main-axis shrink
     *  inside an opted-in container (a nested pane meant to fit the
     *  viewport and scroll internally) cannot shrink; consumers escape
     *  with a >=(0,2,0) override loaded after the library CSS. */
    dockTailClearance: { type: Boolean, default: false },
    /** Back-to-top signal (scroll parameter every scrollable template
     *  can hand to a floating quick-action pad): while set, the
     *  container derives a visibility signal from its own throttled
     *  scroll pass — visible once scrollTop passes SHOW px, hidden
     *  again below HIDE px. The HIDE < SHOW hysteresis band stops the
     *  signal from flickering when the user idles at one threshold.
     *  Emits `update:backTopVisible` on change; inert (never emitted)
     *  while unset. */
    backTopShow: { type: Number, default: undefined },
    /** Hide threshold of the hysteresis; only read when `backTopShow`
     *  is also set. Without it the signal falls back to the single
     *  `top > backTopShow` test. A misconfigured `backTopHide >=
     *  backTopShow` degrades the same way (the show test wins first),
     *  so the band only widens, never inverts. */
    backTopHide: { type: Number, default: undefined },
    /** Opt-in selection edge hint (2026-10-21): a list taller than its
     *  viewport (a settings rail, a long nav) hides its SELECTED row as
     *  soon as it scrolls out of the visible band, and nothing on the
     *  screen says which way to scroll for it. While this prop is on,
     *  every sensing pass additionally checks whether any "selected"
     *  descendant (which ones count is `selectionSelector`) lies fully
     *  outside the viewport's visible vertical band, and mirrors the
     *  verdict on the root as `data-selection-beyond="top" | "bottom" |
     *  "both" | "none"` so consumers can paint an edge hint in pure CSS
     *  (the shipped SCSS draws a primary-color gradient at each
     *  offending edge). VERTICAL only by design: horizontal carousels
     *  keep their own affordances (edge fades, snap alignment) and no
     *  horizontal consumer has proven the need yet. Sensing rides the
     *  same rAF-coalesced update pass as the overflow mirror, so
     *  scroll, resize and `refresh()` re-sense for free; while the prop
     *  is on, a MutationObserver on the viewport funnels selection and
     *  content changes into the same pass — the `.is-active` class
     *  moving between rows fires neither a scroll nor a resize. */
    selectionHint: { type: Boolean, default: false },
    /** Which descendants count as "selected" for `selectionHint`. The
     *  default matches the library's own selection grammar — aria-current
     *  with any non-false value (nav rails), aria-selected="true"
     *  (option lists) and .is-active (class-driven surfaces) — so the
     *  settings rail lights the hint with zero configuration. Only read
     *  while `selectionHint` is on; a runtime change re-senses on the
     *  next pass. */
    selectionSelector: {
      type: String,
      default: '[aria-current]:not([aria-current="false"]), [aria-selected="true"], .is-active',
    },
    /** Scroll-progress pill opt-in (2026-11): while on, the container
     *  floats a small "xx / xx" counter near its bottom-center while the
     *  scroll offset is changing — first visible row index over total
     *  rows of whichever registered list is under the viewport. Lists
     *  opt in per-list by registering against the provided registrar
     *  (see `HK_SCROLL_PROGRESS_REGISTRAR`); provide/inject scoping
     *  keeps a list registered against an inner container from leaking
     *  to this one. Sensing rides the same rAF-coalesced update pass as
     *  the overflow mirror — no second scroll listener. Off by default
     *  (per-house additive-chrome discipline; HkFaceShell turns it on
     *  for the document-mode shell).
     *
     *  Known edges (both accepted, documented for the next reader):
     *  the registrar is provided at SETUP time only — a container
     *  mounted OFF that flips the prop on later renders the pill with
     *  nothing registered (hosts pass the prop statically; FaceShell
     *  never toggles it). And sensing keys on THIS container's viewport
     *  scroll — a nested INNER scroller moving on its own triggers no
     *  pass here, so rows clipped inside the inner scroller can be
     *  counted by the outer pill while invisible. The admin grammar
     *  (one shell viewport) never nests. */
    scrollProgress: { type: Boolean, default: false },
    /** Idle window (ms) after the last scroll-offset change before the
     *  pill fades out. Read live; clamped to 300..3000. Only meaningful
     *  with `scrollProgress`. */
    scrollProgressIdle: { type: Number, default: 900 },
    /** Which descendants count as "rows" for the pill's visible band
     *  (from/to) and its total fallback. The default matches the table
     *  grammar every admin list ships — BODY rows only: a `tr` default
     *  would count the header row as row one and skew every index. A
     *  non-table list (a card roster) overrides with its own row
     *  spelling. Only read while `scrollProgress` is on; a runtime
     *  change re-senses on the next pass. */
    scrollProgressSelector: { type: String, default: "tbody tr" },
  },
  emits: { approachEnd: () => true, "update:backTopVisible": (_v: boolean) => true },
  setup(props, { slots, expose, emit }) {
    const { t } = useI18n();
    // `null`, not `undefined`: a template ref is reset to null on unmount
    // and both consumers below declare `Ref<HTMLElement | null …>`, so the
    // null form is the shared contract (no cast at either call site).
    const viewportRef = ref<HTMLElement | null>(null);
    const hostRef = ref<HTMLElement>();
    const dockTopRef = ref<HTMLElement>();
    const dockBottomRef = ref<HTMLElement>();
    let ro: ResizeObserver | null = null;
    let dockRO: ResizeObserver | null = null;
    let scheduled: AnimationHandle | null = null;
    // Overlay track/thumb machinery lives in the shared composable;
    // this component keeps overflow sensing, autoFollow, the aligner,
    // fade, windowed mode and the scrollbar opt-in.
    let overlay: OverlayScrollbarHandle | null = null;

    // Sensed overflow mirrored onto the root as data-h-overflow /
    // data-v-overflow so consumers can style edge affordances in pure
    // CSS. Attributes are only touched on change to avoid DOM churn.
    let lastHOverflow: OverflowSense | null = null;
    let lastVOverflow: OverflowSense | null = null;

    // Progressive fade strengths last written to the root (see the
    // fadeDistance prop doc). Same write-only-on-change discipline as
    // the overflow mirror: scroll redraws the mask every frame anyway,
    // but a pass that re-senses identical geometry must not churn
    // inline style for nothing. The mirrored direction rides the same
    // contract — it keys the CSS band-slot swap (see the SCSS RTL
    // rules) and MUST agree with the physical-side depths below, which
    // is why the computed direction is mirrored instead of CSS
    // sniffing [dir] itself: a computed rtl under a missing/mismatched
    // ancestor attribute (dir on the container, dir="auto") would
    // light the wrong physical edge.
    const lastFadeStrengths = new Map<string, string>();
    let lastPublishedDir: string | null = null;

    // Sensed selection edge hint (see the selectionHint prop doc),
    // mirrored onto the root as data-selection-beyond — the same
    // write-only-on-change discipline as the overflow mirror.
    let lastSelectionBeyond: SelectionBeyond | null = null;
    // Selection/content liveness for the hint: a scroll or resize
    // listener cannot see the .is-active class moving between rows (no
    // scroll happens, no box changes), so while selectionHint is on a
    // MutationObserver on the viewport funnels the mutations that can
    // move a selection into the same rAF-coalesced sensing pass.
    // Attached lazily on mount when the prop is already on; the prop
    // watcher swaps it at runtime.
    let selectionMO: MutationObserver | null = null;

    const alignerRef = shallowRef<HTMLElement | null>(null);
    let alignRO: ResizeObserver | null = null;

    const pinned = ref(true);
    const FOLLOW_THRESHOLD = 24;

    // Back-to-top visibility (see the backTopShow prop doc). Starts
    // false and only ever changes through the sensed hysteresis below —
    // the same semantics HkWaterfall shipped before the signal moved
    // down to the shared scroll host.
    const backTopVisible = ref(false);
    const autoFollowContent = shallowRef<HTMLElement | null>(null);
    let followRO: ResizeObserver | null = null;
    const showAutoTag = computed(() => props.autoFollow && props.scrollbar && pinned.value);

    // End-approach sensing (infinite loading): the composable owns the
    // scroll/resize/mutation sensors; this component only owns the
    // lifecycle and forwards the emission. `distance` is passed as a
    // getter so runtime approachDistance changes need no restart.
    const approachHandle = shallowRef<ApproachEndHandle | null>(null);

    function startApproach() {
      if (approachHandle.value) return;
      approachHandle.value = useApproachEnd(
        viewportRef,
        () => emit("approachEnd"),
        { distance: () => props.approachDistance },
      );
    }

    function stopApproach() {
      approachHandle.value?.stop();
      approachHandle.value = null;
    }

    watch(() => props.approachEnd, (on) => {
      if (on) startApproach();
      else stopApproach();
    }, { flush: "post" });

    if (props.mode === "windowed") {
      provideScrollWindow(viewportRef, props.overscanScreens);
    }

    // ── Scroll progress pill (scrollProgress opt-in) ──────────────────
    // Registration store + pill state. The registrar is PROVIDED here —
    // once, at setup, only when the prop is on (the windowed-mode
    // precedent above) — so provide/inject scoping resolves a list's
    // inject to the NEAREST enclosing container with the feature on: a
    // list registered against an inner container never leaks to an
    // outer one, and with the prop off there is no registrar at all.
    const progressRegistrars = new Set<HkScrollProgressHandle>();
    const progressShown = ref(false);
    const progressActive = ref(false);
    const progressFrom = ref(0);
    const progressTo = ref(0);
    const progressDenominator = ref(0);
    let progressIdleTimer: ReturnType<typeof setTimeout> | null = null;
    // The offset the last sensing pass saw; null = not baselined yet, so
    // the mount-time pass never counts as "scrolling" (the pill appears
    // on the first real offset change, not on mount).
    let progressLastTop: number | null = null;

    function clampProgressIdle(): number {
      return Math.min(3000, Math.max(300, props.scrollProgressIdle));
    }

    function disarmProgressIdle() {
      if (progressIdleTimer !== null) {
        clearTimeout(progressIdleTimer);
        progressIdleTimer = null;
      }
    }

    function armProgressIdle() {
      disarmProgressIdle();
      progressIdleTimer = setTimeout(() => {
        progressIdleTimer = null;
        progressActive.value = false;
      }, clampProgressIdle());
    }

    function registerProgress(handle: HkScrollProgressHandle) {
      progressRegistrars.add(handle);
      scheduleUpdate();
    }

    function unregisterProgress(handle: HkScrollProgressHandle) {
      progressRegistrars.delete(handle);
      scheduleUpdate();
    }

    if (props.scrollProgress) {
      provide(HK_SCROLL_PROGRESS_REGISTRAR, {
        register: registerProgress,
        unregister: unregisterProgress,
      } satisfies HkScrollProgressRegistrar);
    }

    /** Drop every pill precondition at once. `progressLastTop` resets so
     *  the next appearance re-baselines — a pass that only re-armed the
     *  preconditions (content grew back) must not read as a scroll. */
    function setProgressHidden() {
      progressShown.value = false;
      progressActive.value = false;
      disarmProgressIdle();
      progressLastTop = null;
      progressFrom.value = 0;
      progressTo.value = 0;
      progressDenominator.value = 0;
    }

    /** The ACTIVE registration: the first registered list whose root
     *  intersects the container viewport (registration order — the Set
     *  preserves insertion); when none intersects, the one whose root
     *  top is nearest ABOVE the viewport top (the list the user just
     *  scrolled out of). Deterministic in both tiers. */
    function pickActiveProgressRoot(band: DOMRect): { handle: HkScrollProgressHandle; root: HTMLElement } | null {
      let firstIntersecting: { handle: HkScrollProgressHandle; root: HTMLElement } | null = null;
      let nearestAbove: { handle: HkScrollProgressHandle; root: HTMLElement; top: number } | null = null;
      for (const handle of progressRegistrars) {
        const root = handle.getRoot();
        if (!root || !root.isConnected) continue;
        const rect = root.getBoundingClientRect();
        if (rect.bottom > band.top && rect.top < band.bottom) {
          if (!firstIntersecting) firstIntersecting = { handle, root };
          continue;
        }
        if (rect.top <= band.top && (!nearestAbove || rect.top > nearestAbove.top)) {
          nearestAbove = { handle, root, top: rect.top };
        }
      }
      return firstIntersecting ?? (nearestAbove ? { handle: nearestAbove.handle, root: nearestAbove.root } : null);
    }

    /** Pill sensing, riding the same throttled pass as the overflow
     *  mirror (scroll / resize / content resize / refresh — no second
     *  listener). Preconditions: a registration, vertical overflow, and
     *  an active list with at least one row; failing any hides the pill
     *  outright. While they hold, the band is the VISIBLE ROW RANGE —
     *  `from` is the first row whose bottom edge is still below the
     *  viewport top and `to` the last row whose top edge is still above
     *  the viewport bottom (both 1-based, partial rows counted) — and
     *  the denominator is the registered total — unless it is missing,
     *  non-finite, sub-1, or STALE (smaller than the live row count, a
     *  page that loaded more rows than it declared), in which case the
     *  DOM count wins so the band can never exceed the total (user
     *  direction 2026-11-08: the old single first-row numerator made a
     *  fully-scrolled list read "16 / 30" instead of an end). */
    function senseScrollProgress(vp: HTMLElement) {
      if (!props.scrollProgress || progressRegistrars.size === 0) {
        setProgressHidden();
        return;
      }
      const band = vp.getBoundingClientRect();
      const active = pickActiveProgressRoot(band);
      // A list may own the row grammar (HkTable's section bands are body
      // `<tr>`s that are not data rows); its `getRows` wins over the
      // container selector. No `getRows` (or an undefined return) keeps the
      // existing selector path byte-for-byte.
      const rows = active
        ? active.handle.getRows?.() ?? active.root.querySelectorAll(props.scrollProgressSelector)
        : [];
      if (!active || rows.length === 0 || vp.scrollHeight <= vp.clientHeight + 1) {
        setProgressHidden();
        return;
      }
      let first = rows.length;
      for (let i = 0; i < rows.length; i++) {
        if ((rows[i] as HTMLElement).getBoundingClientRect().bottom > band.top) {
          first = i + 1;
          break;
        }
      }
      let last = first;
      for (let i = rows.length - 1; i >= 0; i--) {
        if ((rows[i] as HTMLElement).getBoundingClientRect().top < band.bottom) {
          last = i + 1;
          break;
        }
      }
      const declared = active.handle.getTotal();
      const denominator =
        typeof declared === "number" && Number.isFinite(declared) && declared >= 1
          ? Math.max(declared, rows.length)
          : rows.length;
      progressFrom.value = Math.min(first, denominator);
      progressTo.value = Math.min(Math.max(last, progressFrom.value), denominator);
      progressDenominator.value = denominator;
      progressShown.value = true;
      // Scroll-active: only a changed offset counts (the pass also runs
      // for resizes and content mutations). The idle fade re-arms on
      // every moving pass, so continuous scrolling never snaps off.
      if (progressLastTop !== null && vp.scrollTop !== progressLastTop) {
        progressActive.value = true;
        armProgressIdle();
      }
      progressLastTop = vp.scrollTop;
    }

    const hasV = () => props.axis !== "horizontal";
    const hasH = () => props.axis !== "vertical";
    // Safe centering applies to horizontal-axis containers only; the
    // rendered aligner + flex overlay are both gated on this.
    const alignCenter = () => props.align === "center" && props.axis === "horizontal";

    function setAligner(el: unknown) {
      const prev = alignerRef.value;
      if (prev && alignRO) alignRO.unobserve(prev);
      alignerRef.value = el instanceof HTMLElement ? el : null;
      // Content growth changes the sensed overflow but not the
      // viewport box, so the viewport-only ResizeObserver never fires
      // for it — observe the aligner as the content-size proxy.
      if (alignerRef.value && alignRO) alignRO.observe(alignerRef.value);
      // A render that just created the aligner (align toggled on after
      // mount) needs the observer created lazily here.
      syncAlignObserver();
    }

    /** (Re)create or drop the content-size observer so runtime toggles
     *  of the align/axis props keep sensing accurate (a container that
     *  switches to align="center" after mount still gets an aligner
     *  observer; switching back stops it). */
    function syncAlignObserver() {
      if (alignCenter() && !alignRO && alignerRef.value) {
        alignRO = new ResizeObserver(scheduleUpdate);
        alignRO.observe(alignerRef.value);
      } else if (!alignCenter() && alignRO) {
        alignRO.disconnect();
        alignRO = null;
      }
    }

    watch(() => [props.align, props.axis] as const, ([, axis], [, prevAxis]) => {
      syncAlignObserver();
      // Follow an axis change at runtime by rebuilding the overlay
      // tracks so the enabled axes stay in sync with the viewport.
      if (axis !== prevAxis && props.scrollbar) mountScrollbars();
      scheduleUpdate();
    }, { flush: "post" });

    // Runtime threshold changes re-sense immediately (same live-read
    // contract as approachDistance): without this, a backTopShow toggle
    // after mount would emit nothing until the next scroll/resize.
    watch(() => [props.backTopShow, props.backTopHide] as const, () => {
      scheduleUpdate();
    });

    /** Build the overlay tracks for the enabled axes (scrollbar on). */
    function mountScrollbars() {
      const vp = viewportRef.value;
      if (!vp) return;
      overlay?.detach();
      overlay = attachOverlayScrollbars(vp, { axis: props.axis, markers: props.markers, markersWidth: props.markersWidth, mapSegments: props.mapSegments });
    }

    /** Swap the fold state's map without rebuilding the chrome: expanding
     *  or collapsing a region only re-derives the thumb from the new
     *  rungs. */
    watch(() => props.mapSegments, (next) => {
      overlay?.setMapSegments(next ?? []);
    }, { deep: true, flush: "post" });

    /** Re-apply marks without rebuilding the chrome: a diff re-renders its
     *  marks on every tick, and detaching/reattaching would drop the
     *  scroll flash and re-run the positioning guard each time. */
    watch(() => props.markers, (next) => {
      overlay?.setMarkers(next ?? []);
    }, { deep: true, flush: "post" });

    /** Tear down and rebuild the overlay tracks when the `scrollbar`
     *  opt-in flips at runtime (HkTabs passes the prop through). */
    watch(() => props.scrollbar, (on) => {
      overlay?.detach();
      overlay = null;
      if (on) {
        mountScrollbars();
        update();
      }
    }, { flush: "post" });

    function recomputePinned() {
      const vp = viewportRef.value;
      if (!vp) return;
      pinned.value = vp.scrollHeight - vp.scrollTop - vp.clientHeight < FOLLOW_THRESHOLD;
    }

    /** Jump-back affordance: resume semantics, not pinned-recompute —
     *  pin first, then sense so follow state agrees with the new offset. */
    function jumpToLatest() {
      const vp = viewportRef.value;
      if (!vp) return;
      vp.scrollTop = vp.scrollHeight;
      recomputePinned();
    }

    function pinToBottomIfPinned() {
      const vp = viewportRef.value;
      if (!vp || !pinned.value) return;
      vp.scrollTop = vp.scrollHeight;
    }

    const SETTLE_FRAMES = 4;
    let settleRemaining = 0;
    let settleHandle: AnimationHandle | null = null;

    function runSettleFrame() {
      settleHandle = null;
      pinToBottomIfPinned();
      if (settleRemaining > 0) {
        settleRemaining--;
        settleHandle = scheduleFrame(runSettleFrame);
      }
    }

    function kickSettle() {
      settleRemaining = SETTLE_FRAMES;
      if (settleHandle) return;
      settleHandle = scheduleFrame(runSettleFrame);
    }

    function scheduleUpdate() {
      scheduled?.disconnect();
      scheduled = scheduleFrame(() => {
        scheduled = null;
        update();
      });
    }

    /** Component-side sensing pass: mirror the live scroll geometry
     *  onto the root as data-h-overflow / data-v-overflow. The overlay
     *  thumb geometry is the composable's job (it listens to scroll
     *  and resizes itself). */
    function update() {
      const vp = viewportRef.value;
      if (!vp) return;
      senseOverflow(vp);
      senseBackTop(vp);
      senseSelectionBeyond(vp);
      senseScrollProgress(vp);
    }

    /** Back-to-top hysteresis, derived on the same throttled pass as the
     *  overflow sensing (scroll / resize / content resize / refresh) so
     *  every scrollable template gets the signal for free — no consumer
     *  installs a second scroll listener. */
    function senseBackTop(vp: HTMLElement) {
      if (props.backTopShow === undefined) return;
      const top = vp.scrollTop;
      const show = props.backTopShow;
      const hide = props.backTopHide;
      const next =
        hide !== undefined
          ? top > show
            ? true
            : top < hide
              ? false
              : backTopVisible.value
          : top > show;
      if (next !== backTopVisible.value) {
        backTopVisible.value = next;
        emit("update:backTopVisible", next);
      }
    }

    /** Mirror the live scroll geometry onto the root element as
     *  data-h-overflow / data-v-overflow, and while `fade` is on publish
     *  the per-edge fade strengths (hidden-content depth saturating over
     *  fadeDistance). Runs on every scheduled update (scroll, resize,
     *  content resize via the aligner).
     *
     *  Scroll offsets are normalized to LTR convention first: Chromium
     *  reports negative scrollLeft under RTL (0 at the inline start down
     *  to -(max) at the inline end), so both the overflow sense and the
     *  strengths would read as "always at start" without it. Strengths
     *  are PHYSICAL-side (left/right), so the direction-neutral
     *  start/end state rules and their RTL width swap below consume the
     *  same vars unchanged. */
    function senseOverflow(vp: HTMLElement) {
      const root = vp.parentElement;
      if (!root) return;
      const rtl = getComputedStyle(vp).direction === "rtl";
      const hMax = Math.max(0, vp.scrollWidth - vp.clientWidth);
      const vMax = Math.max(0, vp.scrollHeight - vp.clientHeight);
      const clampPos = (pos: number, max: number) => Math.min(max, Math.max(0, pos));
      const hPos = clampPos(hasH() ? (rtl ? -vp.scrollLeft : vp.scrollLeft) : 0, hMax);
      const vPos = clampPos(hasV() ? vp.scrollTop : 0, vMax);
      const h = hasH() ? computeOverflow(vp.scrollWidth, vp.clientWidth, hPos) : "none";
      const v = hasV() ? computeOverflow(vp.scrollHeight, vp.clientHeight, vPos) : "none";
      if (h !== lastHOverflow) {
        lastHOverflow = h;
        root.setAttribute("data-h-overflow", h);
      }
      if (v !== lastVOverflow) {
        lastVOverflow = v;
        root.setAttribute("data-v-overflow", v);
      }
      if (props.fade) {
        // Physical-side depths: the normalized hPos counts the inline
        // START, which is the visual RIGHT edge under RTL — swap there
        // so --hk-scroll-fade-strength-left always means the left edge.
        // Axis-gated edges never hide anything this container can fade,
        // so they publish the unlit "1" rather than live geometry.
        publishFadeStrengths(root, {
          left: hasH() ? (rtl ? hMax - hPos : hPos) : 0,
          right: hasH() ? (rtl ? hPos : hMax - hPos) : 0,
          top: hasV() ? vPos : 0,
          bottom: hasV() ? vMax - vPos : 0,
        });
        // Mirror the COMPUTED direction for the CSS band-slot swap (the
        // SCSS RTL rules key on this attribute, not on [dir]): the
        // depths above are physical, so the slot mapping must come from
        // the same resolved direction the normalization used — an
        // ancestor [dir] the selector happens to miss (dir on this
        // element, dir="auto", an explicit deeper override) would
        // otherwise light the wrong edge. Lands the same pass as the
        // overflow attrs, so band slots and lit attrs are never from
        // different frames. Known trade (2026-11-06 review): a pure
        // direction change at rest (locale flip, scrollLeft 0, no
        // layout delta) schedules no sensing pass, so the mirror and
        // the depths sit stale until the next scroll / resize /
        // refresh / prop touch — wrong physical edge in that window,
        // self-healing; a dir MutationObserver was rejected as
        // over-engineering for a narrow trigger.
        const dir = rtl ? "rtl" : "ltr";
        if (lastPublishedDir !== dir) {
          lastPublishedDir = dir;
          root.setAttribute("data-dir", dir);
        }
      } else {
        clearPublishedFade(root);
      }
    }

    /** Drop every fade state the mirror published (fade prop off):
     *  the four strength vars, their cache and the mirrored direction —
     *  a stale inline value must not outlive the feature that wrote it
     *  (same contract shape as stopSelectionSensing). */
    function clearPublishedFade(root: HTMLElement) {
      if (lastFadeStrengths.size === 0 && lastPublishedDir === null) return;
      for (const side of ["left", "right", "top", "bottom"]) {
        root.style.removeProperty(`--hk-scroll-fade-strength-${side}`);
      }
      lastFadeStrengths.clear();
      if (lastPublishedDir !== null) {
        lastPublishedDir = null;
        root.removeAttribute("data-dir");
      }
    }

    /** Progressive fade strengths (see the fadeDistance prop doc): the
     *  hidden px past an edge saturates linearly over fadeDistance into
     *  the band's 0..1 depth, so the fade grows with the pull and caps
     *  at the full band. An edge hiding nothing (the same ≤1px deadband
     *  computeOverflow uses) publishes 1 — with its 0px band that is
     *  invisible, and it keeps dock-fed edges (which share the vars,
     *  no fade prop → never published) at their designed full band. */
    function publishFadeStrengths(root: HTMLElement, hidden: { left: number; right: number; top: number; bottom: number }) {
      const dist = Math.max(0, props.fadeDistance);
      for (const [side, depth] of Object.entries(hidden) as Array<[keyof typeof hidden, number]>) {
        const strength =
          depth <= 1 || dist === 0
            ? "1"
            : String(Math.min(1, Math.round((depth / dist) * 1000) / 1000));
        if (lastFadeStrengths.get(side) !== strength) {
          lastFadeStrengths.set(side, strength);
          root.style.setProperty(`--hk-scroll-fade-strength-${side}`, strength);
        }
      }
    }

    /** Selection edge hint (see the selectionHint prop doc): does any
     *  "selected" descendant lie fully outside the viewport's visible
     *  vertical band? Both rects are read in DRAWN space, so a zoomed
     *  or scaled root applies the same factor to both sides and the
     *  comparison cancels it out. A match that is not rendered
     *  (getClientRects() empty — a display:none selected row) must not
     *  light the hint. Vertical only; the attribute lands on the same
     *  host as data-v-overflow and is only touched on change. */
    function senseSelectionBeyond(vp: HTMLElement) {
      if (!props.selectionHint) return;
      const root = vp.parentElement;
      if (!root) return;
      const band = vp.getBoundingClientRect();
      let above = false;
      let below = false;
      for (const el of Array.from(vp.querySelectorAll<HTMLElement>(props.selectionSelector))) {
        if (el.getClientRects().length === 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.bottom <= band.top) above = true;
        else if (rect.top >= band.bottom) below = true;
      }
      const next: SelectionBeyond = above && below ? "both" : above ? "top" : below ? "bottom" : "none";
      if (next !== lastSelectionBeyond) {
        lastSelectionBeyond = next;
        root.setAttribute("data-selection-beyond", next);
      }
    }

    /** Attach the selection/content mutation sensor (selectionHint on).
     *  The attribute filter is the closed set of mutations that can
     *  move or create a selected row: the three selection spellings the
     *  default selector matches plus the class channel custom selectors
     *  ride on. childList+subtree covers rows being added/removed. */
    function startSelectionSensing() {
      const vp = viewportRef.value;
      if (!vp || selectionMO) return;
      selectionMO = new MutationObserver(scheduleUpdate);
      selectionMO.observe(vp, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "aria-current", "aria-selected"],
      });
    }

    /** Drop the mutation sensor and clear the mirrored state when the
     *  opt-in turns off — a stale data-selection-beyond must not
     *  outlive the feature that wrote it. */
    function stopSelectionSensing() {
      selectionMO?.disconnect();
      selectionMO = null;
      if (lastSelectionBeyond !== null) {
        lastSelectionBeyond = null;
        viewportRef.value?.parentElement?.removeAttribute("data-selection-beyond");
      }
    }

    // Runtime prop swaps: attach/detach the mutation sensor, and
    // re-sense immediately either way (turning the hint on with a
    // selection already beyond the band must not wait for a scroll;
    // a different selector grammar changes the match set without any
    // DOM mutation).
    watch(() => props.selectionHint, (on) => {
      if (on) startSelectionSensing();
      else stopSelectionSensing();
      scheduleUpdate();
    }, { flush: "post" });

    watch(() => props.selectionSelector, () => scheduleUpdate());

    // Runtime fade changes re-sense immediately: flipping `fade` on with
    // content already hidden must not wait for a scroll, and a different
    // fadeDistance re-derives every strength without any DOM motion.
    watch(() => [props.fade, props.fadeDistance] as const, () => {
      scheduleUpdate();
    });

    function onScroll() {
      if (!viewportRef.value) return;
      scheduleUpdate();
      if (props.scrollbar) notifyScrollStart();
      if (props.autoFollow) recomputePinned();
    }

    function onWheel(e: WheelEvent) {
      const vp = viewportRef.value;
      if (!vp || !hasH()) return;
      if (vp.scrollWidth <= vp.clientWidth) return;
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      const prev = vp.scrollLeft;
      vp.scrollLeft += delta;
      if (vp.scrollLeft !== prev) {
        e.preventDefault();
      }
    }

    /** Publish each mounted dock's measured height as a host-level custom
     *  property (`--hk-scroll-dock-top` / `--hk-scroll-dock-bottom`). The
     *  dock is a non-scrolling flex sibling, so the viewport already
     *  shrinks by its height; the published var exists so a consumer's
     *  content end-padding can clear the dock with breathing room
     *  (padding-bottom: calc(var(--hk-scroll-dock-bottom, 0px) + 2rem))
     *  instead of hand-rolled px guesses that go stale when the dock
     *  reflows. ResizeObserver keeps it live across dock reflows. */
    function publishDockSizes() {
      const host = hostRef.value;
      if (!host) return;
      const top = dockTopRef.value;
      const bottom = dockBottomRef.value;
      host.style.setProperty(
        "--hk-scroll-dock-top",
        top ? `${Math.round(top.getBoundingClientRect().height)}px` : "0px",
      );
      host.style.setProperty(
        "--hk-scroll-dock-bottom",
        bottom ? `${Math.round(bottom.getBoundingClientRect().height)}px` : "0px",
      );
    }

    onMounted(() => {
      const vp = viewportRef.value;
      if (!vp) return;

      if (dockTopRef.value || dockBottomRef.value) {
        dockRO = new ResizeObserver(publishDockSizes);
        if (dockTopRef.value) dockRO.observe(dockTopRef.value);
        if (dockBottomRef.value) dockRO.observe(dockBottomRef.value);
        publishDockSizes();
      }

      if (props.scrollbar) {
        mountScrollbars();
      }

      if (props.approachEnd) startApproach();

      if (props.selectionHint) startSelectionSensing();

      vp.addEventListener("scroll", onScroll, { passive: true });
      vp.addEventListener("wheel", onWheel, { passive: false });

      ro = new ResizeObserver(scheduleUpdate);
      ro.observe(vp);

      syncAlignObserver();

      if (props.autoFollow && autoFollowContent.value) {
        pinned.value = true;
        onceFrame(() => {
          pinToBottomIfPinned();
          recomputePinned();
        });
        followRO = new ResizeObserver(() => {
          pinToBottomIfPinned();
          kickSettle();
        });
        followRO.observe(autoFollowContent.value!);
      }

      update();
    });

    onBeforeUnmount(() => {
      const vp = viewportRef.value;
      if (vp) {
        vp.removeEventListener("scroll", onScroll);
        vp.removeEventListener("wheel", onWheel);
      }
      overlay?.detach();
      overlay = null;
      stopApproach();
      disarmProgressIdle();
      selectionMO?.disconnect();
      selectionMO = null;
      scheduled?.disconnect();
      settleHandle?.disconnect();
      settleHandle = null;
      ro?.disconnect();
      ro = null;
      dockRO?.disconnect();
      dockRO = null;
      followRO?.disconnect();
      followRO = null;
      alignRO?.disconnect();
      alignRO = null;
    });

    function scrollTo(top: number, behavior: ScrollBehavior = "auto") {
      const vp = viewportRef.value;
      if (!vp) return;
      vp.scrollTo({ top, behavior });
    }

    function scrollToElement(el: HTMLElement | null, behavior: ScrollBehavior = "auto") {
      if (!el) return;
      const vp = viewportRef.value;
      if (!vp) {
        el.scrollIntoView({ behavior, block: "start" });
        return;
      }
      // Both ends in the LAYOUT space the scroll offset lives in: the drawn
      // boxes would carry the scale of whatever root this sits in, and the
      // target would overshoot by (scale - 1) of the element's distance from
      // the visible top. The offset is measured INSIDE the viewport — a raw
      // `layoutOffset` sum runs on to the document root, which lands the scroll
      // past the element by however far the viewport itself sits down the page
      // (see `laidOffsetWithin`).
      const inside = laidOffsetWithin(el, vp);
      const target = Number.isFinite(inside.y)
        ? inside.y
        : el.getBoundingClientRect().top - vp.getBoundingClientRect().top + vp.scrollTop;
      vp.scrollTo({ top: target, behavior });
    }

    /** Public contract is `HTMLElement | undefined` (HkKanban, HkWaterfall,
     *  HkTabs, HkSettingsDialog and HkLogWindow all declare it that way), so
     *  the internal `null`-on-unmount ref is normalized here instead of
     *  widening the contract for five consumers. */
    function getScrollElement(): HTMLElement | undefined {
      return viewportRef.value ?? undefined;
    }

    function getScrollTop(): number {
      return viewportRef.value?.scrollTop ?? 0;
    }

    /** Re-run the scrollbar + overflow sensing pass. Public escape
     *  hatch for content mutations the observers cannot see (e.g. the
     *  slot's own children resizing without the aligner box changing,
     *  or non-align consumers swapping content). */
    function refresh(): void {
      overlay?.update();
      update();
    }

    /** Current sensed overflow per axis, same values as the mirrored
     *  data attributes. */
    function getOverflow(): { horizontal: OverflowSense; vertical: OverflowSense } {
      return {
        horizontal: lastHOverflow ?? "none",
        vertical: lastVOverflow ?? "none",
      };
    }

    /** True while the viewport sits within `approachDistance` of its
     *  vertical end (only meaningful with `approachEnd`). */
    function isNearEnd(): boolean {
      return approachHandle.value?.isNearEnd() ?? false;
    }

    /** Force one end-approach sensing pass that ignores the
     *  same-geometry dedup. Call after a load that may still leave the
     *  content under-filled — while under-filled the sensor fires on
     *  its own, but a consumer whose load rendered nothing new (all
     *  filtered out downstream) needs this to keep the walk going. */
    function recheck(): void {
      approachHandle.value?.recheck();
    }

    expose({ scrollTo, scrollToElement, getScrollElement, getScrollTop, refresh, getOverflow, isNearEnd, recheck, backTopVisible });

    return () => {
      const Tag = props.as as "div" | "section" | "nav" | "main" | "aside";
      let content = props.autoFollow ? (
        <div ref={autoFollowContent} class="hk-scroll-container-autofollow-content">
          {slots.default?.()}
        </div>
      ) : (
        slots.default?.()
      );
      // The aligner is the single flex item of the (row) viewport; its
      // auto inline margins center it when it fits and collapse to
      // zero when it overflows — see HkScrollContainer.scss.
      if (alignCenter()) {
        content = <div ref={setAligner} class="hk-scroll-container-aligner">{content}</div>;
      }
      // Anchored dock slots: a dock renders as a NON-scrolling flex
      // sibling of the viewport — it stays pinned to its edge, never
      // scrolls, and occupies layout space (the flex: 1 viewport shrinks
      // by the dock's height). The container measures each mounted dock
      // and publishes --hk-scroll-dock-top/bottom so consumers can size
      // their content end-padding against the dock without guessing px.
      const dockTopSlot = slots.dockTop;
      const dockBottomSlot = slots.dockBottom;
      return (
        <Tag
          ref={hostRef}
          class="hk-scroll-container"
          data-axis={props.axis}
          data-align={alignCenter() ? "center" : undefined}
          data-fade={props.fade ? "true" : undefined}
          data-dock-tail={props.dockTailClearance ? "true" : undefined}
          data-dock-fade={
            props.dockFade && dockBottomSlot
              ? "bottom"
              : props.dockFade && dockTopSlot
                ? "top"
                : undefined
          }
        >
          {dockTopSlot && (
            <div ref={dockTopRef} class="hk-scroll-dock" data-side="top">
              {dockTopSlot()}
            </div>
          )}
          {/* Scroll-pin host marker: the viewport participates in the pin
              contract with its live axis; generic containers declare no
              standard padding, so pins inside resolve their strategy from
              whatever --hk-scroll-pad-* the consumer put on this viewport. */}
          <div
            ref={viewportRef}
            class={["hk-scroll-container-viewport", SCROLL_HOST_CLASS]}
            data-scroll-axis={props.axis}
          >
            {content}
          </div>
          {dockBottomSlot && (
            <div ref={dockBottomRef} class="hk-scroll-dock" data-side="bottom">
              {dockBottomSlot()}
            </div>
          )}
          {showAutoTag.value && (
            <span class="hk-scroll-container-autotag" aria-hidden="true">{t("hikari::scrollContainer.auto", "Auto")}</span>
          )}
          {props.scrollProgress && (
            <HkScrollProgress
              shown={progressShown.value}
              active={progressActive.value}
              from={progressFrom.value}
              to={progressTo.value}
              total={progressDenominator.value}
            />
          )}
          {props.autoFollow && props.followAffordance && !pinned.value && (
            <HFab
              class="hk-scroll-container-jump"
              positioning="absolute"
              corner="bottom-right"
              icon="ArrowDown"
              size="sm"
              ariaLabel={t("hikari::modal.jumpToLatest", "Back to latest")}
              onClick={jumpToLatest}
            />
          )}
        </Tag>
      );
    };
  },
});
