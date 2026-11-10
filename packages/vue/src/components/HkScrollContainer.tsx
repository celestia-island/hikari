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
// One-WAY dependency on the dock module (keys only — no component, no
// cycle): the container publishes its viewport + host refs so an
// HkScrollProgressDock inside the slot can sense this scroller and
// teleport its pill onto this host. The dock feature itself (2026-11-09
// componentization) moved OUT of this container into the standalone
// HkScrollProgressDock; the `scrollProgress` / `scrollProgressIdle` /
// `scrollProgressSelector` props and the whole sensing engine that
// served them are retired — hosts wrap their content in the dock
// instead (HkFaceShell does it for the document shell).
import { HK_SCROLL_PROGRESS_HOST, HK_SCROLL_PROGRESS_VIEWPORT } from "./HkScrollProgressDock";
import { scheduleFrame, notifyScrollStart, onceFrame, type AnimationHandle } from "../runtime/animationBus";
import HFab from "./HkFab";
import HkEdgeGlow, { type EdgeGlowEdge } from "./HkEdgeGlow";

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

/** Physical edges still hiding content, derived from the per-axis
 *  overflow verdicts in the SAME pass that publishes them (see the
 *  overflowGlow prop doc). Physical, because HkEdgeGlow paints screen sides:
 *  the horizontal scroll-START verdict denotes the inline start, which is the
 *  visual RIGHT edge under RTL — exactly the mapping the fade strengths
 *  already apply, and the reason both consumers resolve direction in JS
 *  instead of sniffing [dir] in CSS. Axis-gated verdicts arrive as "none",
 *  so the caller needs no hasH/hasV branch. */
function overflowGlowEdgesFor(
  horizontal: OverflowSense,
  vertical: OverflowSense,
  rtl: boolean,
): EdgeGlowEdge[] {
  const edges: EdgeGlowEdge[] = [];
  const hStart: EdgeGlowEdge = rtl ? "right" : "left";
  const hEnd: EdgeGlowEdge = rtl ? "left" : "right";
  if (horizontal === "start" || horizontal === "both") edges.push(hStart);
  if (horizontal === "end" || horizontal === "both") edges.push(hEnd);
  if (vertical === "start" || vertical === "both") edges.push("top");
  if (vertical === "end" || vertical === "both") edges.push("bottom");
  return edges;
}

/** Map a selection-beyond verdict onto the glow painter's PHYSICAL edges
 *  (the hint is vertical by design — see the selectionHint prop doc). */
function selectionGlowEdgesFor(beyond: SelectionBeyond): EdgeGlowEdge[] {
  if (beyond === "top") return ["top"];
  if (beyond === "bottom") return ["bottom"];
  if (beyond === "both") return ["top", "bottom"];
  return [];
}

/** Sticky-end tolerance in px (see the anchor prop doc): within this many
 *  pixels of an end the viewport still counts as parked there, so a pass
 *  does not rewrite an offset the engine already placed. */
const ANCHOR_TOLERANCE = 2;

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
    /** Where a newly overflowing scroll axis parks on its FIRST overflow
     *  pass (2026-11-08, the battle heatmap's "focus the newest day"
     *  direction). The default "start" matches every engine's natural scroll
     *  origin and is therefore inert BY CONSTRUCTION: parking at the start
     *  would mean writing 0 to an offset that already is 0 (under RTL the
     *  Chromium-family convention keeps scrollLeft 0 at the inline start
     *  too), so only "end" has code paths to run — which is also why the
     *  default cannot disturb the shipped containers.
     *
     *  With "end", each enabled scroll axis parks at the LOGICAL content end
     *  — the newest data, the last row — as soon as that axis starts
     *  overflowing, and then stays parked STICKILY: a later change of the
     *  scroll extent (data replaced, a range narrowed, the viewport resized)
     *  re-parks the axis only while the viewport was still at the end on the
     *  PREVIOUS pass (tolerance 2px). A user who scrolled away owns the
     *  offset; an extent change under them is not a request to yank them
     *  back, so the anchor stops re-parking the moment it sees them
     *  elsewhere. Logical, not physical: under RTL the inline end is the
     *  visual LEFT edge and the offset that lands there is negative, the same
     *  normalization the fade/overflow sensing applies.
     *
     *  The sticky re-park covers content arriving after mount (an async
     *  series, a window resize); a consumer that REPLACES its data can also
     *  re-park deterministically through the exposed `scrollToEnd()` (the
     *  heatmap does that on a range switch). Not intended together with
     *  `autoFollow` on a vertical container: both own the vertical end, and
     *  autoFollow's jump-back affordance assumes the user is the only one
     *  moving the offset. */
    anchor: { type: String as PropType<"start" | "end">, default: "start" },
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
    /** Opt-in overflow glow (2026-11-08 user direction: the battle heatmap
     *  must show that content still hides at an edge now that the native bar
     *  is gone, without a native bar coming back): while on, the container
     *  mounts the shared <HkEdgeGlow> painter as a FIXED, NON-SCROLLING
     *  child and lights the PHYSICAL edges where the sensed overflow still
     *  hides content. It is the same feathered primary-gradient band the
     *  settings rail's selectionHint paints — one painter for both features
     *  (components/HkEdgeGlow), so the band's geometry, feather and colour
     *  cannot drift between them.
     *
     *  Edges are derived in the SAME sensing pass that writes
     *  data-h-overflow / data-v-overflow, from those verdicts mapped
     *  through the COMPUTED direction (not [dir]): axis="horizontal" lights
     *  left/right, "vertical" top/bottom, "both" all four sides; a
     *  scroll-start verdict lights the physical start side (right under
     *  RTL), a scroll-end verdict the other one, "both" both. The bands
     *  breathe (`animate`) — an overflow glow is ambient chrome while a
     *  strip scrolls, unlike the static selection STATE hint; the loop is
     *  registered in animation/registerAnimations.ts and dropped under
     *  reduced motion.
     *
     *  Size and feather are consumer-tunable from OUTSIDE: the painter gets
     *  `var(--hk-scroll-overflow-glow-size, var(--space-24))` and the
     *  `-feather` twin, so a host sets the knob on this container (or any
     *  ancestor) instead of fighting the sheet. While the prop is on the root
     *  carries `data-overflow-glow="true"` — a styling hook for a host that
     *  wants its own backdrop behind the band. Off by default (per-house
     *  additive-chrome discipline); only surfaces that hide content without
     *  visible native chrome opt in. */
    overflowGlow: { type: Boolean, default: false },
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
     *  tall, opacity 100 -> 0) while a PINNED (`dockMode="pin"`) dock slot
     *  is mounted, so mid-scroll content dissolving at the dock's edge
     *  reads as intentional instead of a hard clip. Not published for a
     *  ride-mode dock: that dock lives INSIDE the masked viewport, so the
     *  same band would fade the dock's own bottom edge; and it needs no
     *  dissolve at all, because the air between content and dock is the
     *  dock's measured height (see `dockMode`). */
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
    /** Where a mounted `dockBottom` dock LIVES (2026-11-10 user ruling):
     *
     *  - `pin` (default) — today's placement, unchanged: the dock is a
     *    NON-scrolling flex SIBLING of the viewport, so it always sits on
     *    the container's bottom edge and the `flex: 1` viewport shrinks by
     *    its height. The viewport is that much shorter whether or not the
     *    content fills it, so short content leaves the leftover window
     *    height between the content end and the dock.
     *  - `ride` — the dock moves INTO the viewport's content flow, after
     *    the slot content: `.hk-scroll-dock-ride-spacer` (a block spacer
     *    exactly one MEASURED dock height tall, `--hk-scroll-dock-bottom`)
     *    then the dock itself as `.hk-scroll-dock.hk-scroll-dock-ride`
     *    (`position: sticky; bottom: 0`). Short content: the dock trails
     *    the content at its own flow position, so the air above it is
     *    exactly one dock height and the leftover window height falls
     *    BELOW the dock. Long content: the spacer delivers the same one
     *    dock height of air at the scroll end, while the pinned dock sits
     *    on the visible bottom edge and never scrolls away.
     *
     *  Ride is NOT the retired frame-level reservation (see the
     *  dockTailClearance lesson below). That recipe reserved room for a
     *  dock living OUTSIDE the flow — a shell-fixed plane — so the
     *  reserved band showed as dead air BEFORE the scroll end and the
     *  dock itself never followed the content. Here the dock's own body is
     *  the in-flow child: the empty band is its measured box, nothing is
     *  pre-reserved for something painted elsewhere, and the band tracks
     *  every dock reflow (a model row changing, a breakpoint switch)
     *  because the var is re-measured by the same ResizeObserver that
     *  publishes `--hk-scroll-dock-top/bottom` in pin mode.
     *
     *  Load-bearing details:
     *    - the wrapper keeps the `.hk-scroll-dock` class: consumers detect
     *      "this surface is already a container dock" by
     *      `closest(".hk-scroll-dock")` (chest's DockBar drops its own
     *      shell-level clearance publication that way). Renaming it
     *      double-clears the same dock;
     *    - the spacer is an explicit `display: block` box (a height on an
     *      inline box is inert — the measured viewport default is a block
     *      flow, so a bare inline spacer would measure zero clearance) and
     *      `flex: none`, so a column-flex viewport cannot compress it;
     *    - the dock is `flex: none; z-index: 1`: while it is pinned over
     *      scrolling content it must paint above it;
     *    - the wrapper AND the spacer are `pointer-events: none`. A
     *      pinned ride wrapper covers a whole band of the visible area
     *      (a column-flex viewport stretches it to full width × dock
     *      height), so an `auto` hit target there would swallow every
     *      click and hover on the content underneath it — a defect the
     *      pin placement cannot have, because its dock is a sibling
     *      OUTSIDE the viewport. Ride follows the floating-dock contract
     *      instead (HkDockBar: transparent anchor box, catching surface):
     *      the SURFACE opts back in with `pointer-events: auto`
     *      (`.hk-dock-bar-surface`, chest's `.s-dock-bar-surface`).
     *      SLOT CONTENT THAT MUST CATCH EVENTS HAS TO DECLARE
     *      `pointer-events: auto` ON THE PART THAT CATCHES THEM — the
     *      wrapper does not hand interactivity to a generic slot child.
     *
     *  Ignored (falls back to `pin`) on `axis="horizontal"` containers:
     *  there the content tail is the cross axis and an in-flow block
     *  child leaks onto the hidden vertical axis — the same measured
     *  defect that gates the dockTailClearance spacer (see there). `pin`
     *  stays byte-compatible with the pre-2026-11-10 render. */
    dockMode: { type: String as PropType<"pin" | "ride">, default: "pin" },
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
     *  "both" | "none"` so consumers can paint an edge hint in pure CSS,
     *  and mounts the shared <HkEdgeGlow> painter (the primary-color
     *  feathered gradient — the same one the overflowGlow opt-in uses)
     *  on each offending edge. VERTICAL only by design: horizontal carousels
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
  },
  emits: { approachEnd: () => true, "update:backTopVisible": (_v: boolean) => true },
  setup(props, { slots, expose, emit }) {
    const { t } = useI18n();
    // `null`, not `undefined`: a template ref is reset to null on unmount
    // and both consumers below declare `Ref<HTMLElement | null …>`, so the
    // null form is the shared contract (no cast at either call site).
    const viewportRef = ref<HTMLElement | null>(null);
    const hostRef = ref<HTMLElement | null>(null);
    const dockTopRef = ref<HTMLElement>();
    const dockBottomRef = ref<HTMLElement>();
    // Unconditional publication (see the import comment): any
    // HkScrollProgressDock inside the slot senses THIS viewport and
    // teleports its pill onto THIS host. The refs are the shared
    // `Ref<HTMLElement | null>` contract (null on unmount), so the dock
    // needs no cast and re-resolves when the template refs land.
    provide(HK_SCROLL_PROGRESS_VIEWPORT, viewportRef);
    provide(HK_SCROLL_PROGRESS_HOST, hostRef);
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
    // The same verdict published as PHYSICAL edges for the shared
    // <HkEdgeGlow> painter that replaced the retired pseudo-element
    // painters (2026-11-08): top/bottom only — the hint is vertical by
    // design — and empty while nothing hides the selection. A reactive ref
    // because the render function mounts/moves the bands from it; written
    // in the same pass as the attribute, on change only.
    const selectionHintEdges = shallowRef<EdgeGlowEdge[]>([]);
    // Selection/content liveness for the hint: a scroll or resize
    // listener cannot see the .is-active class moving between rows (no
    // scroll happens, no box changes), so while selectionHint is on a
    // MutationObserver on the viewport funnels the mutations that can
    // move a selection into the same rAF-coalesced sensing pass.
    // Attached lazily on mount when the prop is already on; the prop
    // watcher swaps it at runtime.
    let selectionMO: MutationObserver | null = null;

    // ── Overflow glow sensing (overflowGlow opt-in) ────────────────────
    // The lit edges are derived in the overflow sensing pass (the same one
    // that mirrors data-h-overflow / data-v-overflow) and published here
    // only when the SET changes: the mirror's write-only-on-change
    // discipline now also covers reactivity, so a pass that re-senses
    // identical geometry cannot re-render the painter. Empty = no band; the
    // painter's inert root stays mounted while the prop is on, so lighting
    // an edge never mounts chrome mid-scroll.
    const overflowGlowEdges = shallowRef<EdgeGlowEdge[]>([]);
    /** Joined edge list last published — the write-only-on-change key. */
    let lastOverflowGlowKey = "";

    /** Publish the sensed glow edges (see the overflowGlow prop doc). */
    function publishOverflowGlowEdges(edges: EdgeGlowEdge[]) {
      const key = edges.join(",");
      if (key === lastOverflowGlowKey) return;
      lastOverflowGlowKey = key;
      overflowGlowEdges.value = edges;
    }

    /** Drop every glow band (feature turned off / container torn down). The
     *  DOM half follows from the render gate on the prop; this clears the
     *  SENSED state so a re-enable never paints a stale edge for one frame
     *  (same contract shape as stopSelectionSensing's attribute removal). */
    function clearOverflowGlow() {
      lastOverflowGlowKey = "";
      overflowGlowEdges.value = [];
    }

    // Runtime prop swap: off clears the sensed edges, and on re-senses
    // immediately so an already-overflowing container lights its band
    // without waiting for the next scroll. Teardown rides the same clearer:
    // the rendered subtree dies with the root, but the sensed state must not
    // outlive the feature that wrote it.
    watch(() => props.overflowGlow, (on) => {
      if (!on) clearOverflowGlow();
      scheduleUpdate();
    }, { flush: "post" });
    onBeforeUnmount(clearOverflowGlow);

    // ── Anchor parking state (see the anchor prop doc) ─────────────────
    // Per enabled axis: the extent (max scroll offset) and the offset the
    // LAST pass measured; `null` = never sensed, so the next pass has
    // nothing to judge against and parks unconditionally. Remembering the
    // previous OFFSET — not just the previous extent — is load-bearing:
    // content that grows under a viewport sitting at the old end leaves the
    // live offset short of the NEW end, so a "was the viewport at the end?"
    // test against today's max would read "the user scrolled away" exactly
    // when they did not.
    const anchorSeen = {
      horizontal: null as { max: number; pos: number } | null,
      vertical: null as { max: number; pos: number } | null,
    };

    // A prop swap re-baselines so flipping anchor to "end" at runtime takes
    // effect on the next pass instead of waiting for an extent change.
    watch(() => props.anchor, () => {
      anchorSeen.horizontal = null;
      anchorSeen.vertical = null;
      scheduleUpdate();
    });
    onBeforeUnmount(() => {
      anchorSeen.horizontal = null;
      anchorSeen.vertical = null;
    });

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

    const hasV = () => props.axis !== "horizontal";
    const hasH = () => props.axis !== "vertical";
    /** Whether the bottom dock rides the viewport's content flow (see the
     *  dockMode prop doc). Axis-gated here as well as at the host: a
     *  horizontal container's tail is its cross axis, where an in-flow
     *  block child leaks onto the hidden vertical axis (the measured
     *  defect documented on the dockTailClearance spacer). */
    const dockRides = () => props.dockMode === "ride" && hasV();
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

    /** Anchor parking (see the anchor prop doc). Only "end" has code: the
     *  scroll origin IS the start edge on every engine hikari deploys on —
     *  LTR scrollLeft 0, and the Chromium-family RTL convention also starts
     *  at 0 and runs down to -max — so anchoring "start" would only ever
     *  write 0 over 0. That is what makes the shipped default provably
     *  inert. */
    function senseAnchor(vp: HTMLElement) {
      if (props.anchor !== "end") return;
      if (hasH()) anchorAxis(vp, true, getComputedStyle(vp).direction === "rtl");
      if (hasV()) anchorAxis(vp, false, false);
    }

    /** Park ONE axis at its end when the sticky conditions hold (see the
     *  anchor prop doc and the anchorSeen block). Positions are compared in
     *  the normalized LTR convention, so the decisions are direction-free;
     *  only the write converts back (the RTL inline end is -max). */
    function anchorAxis(vp: HTMLElement, horizontal: boolean, rtl: boolean) {
      const size = horizontal ? vp.scrollWidth : vp.scrollHeight;
      const client = horizontal ? vp.clientWidth : vp.clientHeight;
      const max = Math.max(0, size - client);
      const raw = horizontal ? vp.scrollLeft : vp.scrollTop;
      const pos = rtl ? -raw : raw;
      const seen = horizontal ? anchorSeen.horizontal : anchorSeen.vertical;
      // The previous pass's pair, deliberately: content that grew under a
      // viewport parked at the OLD end must still count as "at the end"
      // (see the anchorSeen block).
      const wasAtEnd = seen ? seen.pos >= seen.max - ANCHOR_TOLERANCE : true;
      const extentChanged = seen ? seen.max !== max : true;
      let nextPos = pos;
      if (max > 0 && wasAtEnd && extentChanged && pos < max - ANCHOR_TOLERANCE) {
        const target = rtl ? -max : max;
        if (horizontal) vp.scrollLeft = target;
        else vp.scrollTop = target;
        nextPos = max;
      }
      const record = { max, pos: nextPos };
      if (horizontal) anchorSeen.horizontal = record;
      else anchorSeen.vertical = record;
    }

    /** Mirror the live scroll geometry onto the root element as
     *  data-h-overflow / data-v-overflow, and while `fade` is on publish
     *  the per-edge fade strengths (hidden-content depth saturating over
     *  fadeDistance); while `overflowGlow` is on, derive the glow's
     *  physical edges from the same verdicts. Runs on every scheduled
     *  update (scroll, resize, content resize via the aligner).
     *
     *  Anchor parking runs FIRST (when opted in): it writes the scroll
     *  offset, and every geometry read below must see the post-park state —
     *  the scroll event the write fires would otherwise correct a pre-park
     *  mirror one painted frame too late.
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
      senseAnchor(vp);
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
      // Same-pass glow edges (see the overflowGlow prop doc): the verdicts
      // above and the physical mapping below come from ONE geometry read,
      // so a lit edge and the attribute that explains it never disagree.
      if (props.overflowGlow) {
        publishOverflowGlowEdges(overflowGlowEdgesFor(h, v, rtl));
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
     *  host as data-v-overflow and is only touched on change, and the same
     *  verdict drives the shared <HkEdgeGlow> painter's top/bottom bands
     *  (one painter for the hint and the overflow glow). */
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
        // The shared painter's input (see the selectionHintEdges block):
        // same verdict, same pass, change-only. The attribute above stays
        // the documented consumer contract; this ref is how the component's
        // own render/JSX learns the verdict.
        selectionHintEdges.value = selectionGlowEdgesFor(next);
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
        selectionHintEdges.value = [];
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
     *  property (`--hk-scroll-dock-top` / `--hk-scroll-dock-bottom`). In
     *  `dockMode="pin"` the dock is a non-scrolling flex sibling, so the
     *  viewport already shrinks by its height; the published var exists so
     *  a consumer's content end-padding can clear the dock with breathing
     *  room (padding-bottom: calc(var(--hk-scroll-dock-bottom, 0px) +
     *  2rem)) instead of hand-rolled px guesses that go stale when the dock
     *  reflows. In `dockMode="ride"` the same var IS the layout: the ride
     *  spacer spends it as the one-dock-height air above the dock, so the
     *  measurement feeds the geometry instead of only a consumer's padding
     *  (see the dockMode prop doc). ResizeObserver keeps it live across
     *  dock reflows. */
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

    /** (Re)attach the dock-height observer to the dock wrappers mounted
     *  RIGHT NOW and re-publish. One helper for both the initial mount and
     *  a runtime `dockMode` swap: the dock moves between the pin sibling
     *  and the ride position, so the ref resolves to a NEW element and a
     *  stale observation would freeze the published height (which in ride
     *  mode is the air itself). */
    function syncDockObserver() {
      const top = dockTopRef.value;
      const bottom = dockBottomRef.value;
      if (!top && !bottom) return;
      if (!dockRO) dockRO = new ResizeObserver(publishDockSizes);
      dockRO.disconnect();
      if (top) dockRO.observe(top);
      if (bottom) dockRO.observe(bottom);
      publishDockSizes();
    }

    // A placement swap re-points the observer at the dock's new wrapper
    // (see syncDockObserver) — flush post, so the refs point at the
    // element this render mounted.
    watch(() => props.dockMode, () => syncDockObserver(), { flush: "post" });

    onMounted(() => {
      const vp = viewportRef.value;
      if (!vp) return;

      if (dockTopRef.value || dockBottomRef.value) {
        syncDockObserver();
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

    /** Park the enabled scroll axis/axes at the logical END — the newest
     *  data, the last row — honouring the requested scroll behavior (default
     *  = "auto", an immediate jump; "smooth" rides the engine). This is the
     *  deterministic half of the `anchor` contract: the prop keeps the axis
     *  parked across extent changes while the user stays there, and a
     *  consumer that REPLACES its data (the heatmap's range switch) calls
     *  this to re-park even if the viewport was elsewhere when the new data
     *  arrived.
     *
     *  LOGICAL, not physical: under RTL the inline end is the visual LEFT
     *  edge and requires a negative offset in the Chromium-family
     *  convention, so the offset is direction-resolved here exactly like the
     *  overflow/fade sensing resolves its normalized positions. Resolves
     *  against live geometry at call time, so callers re-render first (the
     *  heatmap calls through a `flush: "post"` watcher). */
    function scrollToEnd(behavior: ScrollBehavior = "auto") {
      scrollAxisTo("end", behavior);
    }

    /** The start twin of `scrollToEnd` (offset 0 on both directions under
     *  the Chromium-family RTL convention). */
    function scrollToStart(behavior: ScrollBehavior = "auto") {
      scrollAxisTo("start", behavior);
    }

    /** Shared implementation: build a ScrollToOptions carrying only the
     *  enabled axes (an omitted member keeps its current offset per CSSOM,
     *  so a vertical-only container never touches scrollLeft — and a host
     *  with a cross-axis overflow it does not want moved keeps it). */
    function scrollAxisTo(end: "start" | "end", behavior: ScrollBehavior) {
      const vp = viewportRef.value;
      if (!vp) return;
      const options: ScrollToOptions = { behavior };
      if (hasH()) {
        const max = Math.max(0, vp.scrollWidth - vp.clientWidth);
        const rtl = getComputedStyle(vp).direction === "rtl";
        options.left = end === "start" ? 0 : rtl ? -max : max;
      }
      if (hasV()) {
        options.top = end === "start" ? 0 : Math.max(0, vp.scrollHeight - vp.clientHeight);
      }
      vp.scrollTo(options);
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

    expose({
      scrollTo,
      scrollToElement,
      // The end/start parks (see scrollToEnd): exposed for consumers that
      // replace their content and must re-park deterministically instead of
      // waiting for the anchor's sticky pass.
      scrollToEnd,
      scrollToStart,
      getScrollElement,
      getScrollTop,
      refresh,
      getOverflow,
      isNearEnd,
      recheck,
      backTopVisible,
    });

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
      // Anchored dock slots (dockMode="pin", the default): a dock renders
      // as a NON-scrolling flex sibling of the viewport — it stays pinned
      // to its edge, never scrolls, and occupies layout space (the flex: 1
      // viewport shrinks by the dock's height). The container measures each
      // mounted dock and publishes --hk-scroll-dock-top/bottom so consumers
      // can size their content end-padding against the dock without
      // guessing px.
      //
      // With dockMode="ride" the BOTTOM dock instead mounts inside the
      // viewport, after the slot content (see the dockMode prop doc and
      // the ride section of HkScrollContainer.scss): one measured-height
      // block spacer, then the .hk-scroll-dock wrapper made sticky. The
      // wrapper keeps the .hk-scroll-dock class on purpose — consumers
      // detect a container-owned dock by closest(".hk-scroll-dock") and
      // drop their own shell-level clearance publication on it.
      const dockTopSlot = slots.dockTop;
      const dockBottomSlot = slots.dockBottom;
      const rideBottom = dockRides();
      return (
        <Tag
          ref={hostRef}
          class="hk-scroll-container"
          data-axis={props.axis}
          data-align={alignCenter() ? "center" : undefined}
          data-fade={props.fade ? "true" : undefined}
          data-overflow-glow={props.overflowGlow ? "true" : undefined}
          data-dock-tail={props.dockTailClearance ? "true" : undefined}
          data-dock-fade={
            props.dockFade && dockBottomSlot && !rideBottom
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
            {dockBottomSlot && rideBottom && (
              <>
                <div class="hk-scroll-dock-ride-spacer" aria-hidden="true" />
                <div ref={dockBottomRef} class="hk-scroll-dock hk-scroll-dock-ride" data-side="bottom">
                  {dockBottomSlot()}
                </div>
              </>
            )}
          </div>
          {dockBottomSlot && !rideBottom && (
            <div ref={dockBottomRef} class="hk-scroll-dock" data-side="bottom">
              {dockBottomSlot()}
            </div>
          )}
          {/* Edge painters (2026-11-08): both are the SAME shared
              <HkEdgeGlow> component, mounted as non-scrolling children of
              the root (the root is the fixed box; painter pseudo-elements on
              the viewport would live in scrolled space and slide away).
              Above the viewport in tree order and z-indexed under the
              scrollbar chrome; the selection hint is static (a STATE hint),
              the overflow glow breathes (ambient chrome). Each stays mounted
              while its prop is on — an empty edge list renders the inert
              root only — so lighting an edge never mounts chrome mid-scroll.
              The hint's knobs are declared by HkScrollContainer.scss on the
              [data-selection-beyond] root rule (consumer overrides win
              there); the glow's knobs resolve on the painter with the
              documented fallbacks, so a host sets them anywhere up the
              tree. */}
          {props.selectionHint && (
            <HkEdgeGlow
              edges={selectionHintEdges.value}
              size="var(--hk-scroll-selection-hint-size)"
              feather="var(--hk-scroll-selection-hint-feather)"
            />
          )}
          {props.overflowGlow && (
            <HkEdgeGlow
              animate
              edges={overflowGlowEdges.value}
              size="var(--hk-scroll-overflow-glow-size, var(--space-24))"
              feather="var(--hk-scroll-overflow-glow-feather, var(--space-24))"
            />
          )}
          {showAutoTag.value && (
            <span class="hk-scroll-container-autotag" aria-hidden="true">{t("hikari::scrollContainer.auto", "Auto")}</span>
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
