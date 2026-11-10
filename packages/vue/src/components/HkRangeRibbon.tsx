import { RotateCcw } from "lucide-vue-next";
import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, ref, type PropType, useId, watch } from "vue";

import { useI18n } from "../i18n/context";
import HIconButton from "./HkIconButton";
import "./HkRangeRibbon.scss";

/**
 * HkRangeRibbon — the generic sequence-ribbon waterfall: two explicit layers
 * projected from ONE host-supplied sequence.
 *
 * The ribbon owns no content vocabulary. `lanes` is the consumer's row
 * structure, `segments` are its parts and `domain` is the axis they are
 * measured on (default `[0, 1]`, the familiar 0%..100%; a caller may declare
 * `[-0.1, 1]`, `[0, 2]`, `[-0.5, 1.5]` or a narrower `[0.2, 0.8]`). Segment
 * starts/ends, the window and `windowChange` all live in those axis units.
 *
 *   · data-layer="minimap" — the top, compact strip. It paints every lane's
 *     segments clipped to the DOMAIN and never follows the window, so the
 *     window stays locatable; the window frame, the two outside scrims, both
 *     edge handles and the reset button ride on it, and it owns the brush
 *     surface. Its x is `(f - domain[0]) / span`.
 *   · data-layer="detail" — the lower, taller lane list focused on the
 *     selected window: the track is always 0..100% of the WINDOW, in the
 *     caller's domain units, so a window of [0.35, 0.67] starts the detail at
 *     0 and ends it at 100% however the domain is placed (with the default
 *     axis those are the familiar 35%..67%). Only segments intersecting the
 *     window survive, clipped at its edges. With no window the detail is the
 *     full view, i.e. the caller's domain.
 *
 * The minimap shares the lanes' label column (an empty gutter), so both
 * layers always start at the same inline x. Their x% agree only in the
 * FULL-DOMAIN view: a window re-normalizes the detail against the selected
 * sub-domain, and a non-unit domain rescales the minimap.
 *
 * DOMAIN: the axis is the caller's `domain`; content outside it is clipped
 * away, and space inside it the content does not fill stays blank (a 200%
 * budget, a 10% lead-in, a zoomed window of interest). `headroom` is the
 * DEPRECATED shorthand for the trailing-axis case — the axis is
 * `[0, 1 + headroom]`, so the "110%" reading is headroom 0.1 — and a valid
 * `domain` wins over it. The alias is SOURCE-compatible with the old
 * `headroom` prop but NOT behaviour-compatible: there is no special
 * tail-clamp, because the whole component reads `[0, 1 + headroom]` as the
 * coordinate system — the reserved tail is selectable axis, the axis end
 * (not content 100%) is the reset state, the keyboard steps 5% of the span,
 * the no-window detail and the minimal bar draw it, and ARIA reads it.
 * Windows and every emitted value stay absolute coordinates in the caller's
 * domain units: pointer x maps back onto the domain (`d0 + x * span`) and
 * clamps to it, the keyboard nudges by 5% of the span, and labels/ARIA read
 * domain percentages (negative or above 100% when the domain says so).
 * `minimal` mode suppresses the minimap lane rows and the whole detail layer
 * (its bare bar still lives in the overview container) and draws the same
 * domain axis.
 *
 * Editing: drag on the strip to brush a new window, drag either edge handle
 * to resize it, and reset back to the full domain — the reset button, a
 * strip double-click, Escape anywhere inside the ribbon, or Home when the
 * range surface (strip / handle / reset button) holds focus. The strip is
 * focusable: arrows slide the window, Shift+arrows resize it. Handle sliders
 * nudge their own edge. Hovering or focusing a segment floats its tip card
 * (tip.title + tip.lines); the card anchors inside the ribbon at the edges.
 *
 * Contract with the host: `segments` are fed in ABSOLUTE coordinates on the
 * caller's domain axis (default 0..1) and `windowChange` always answers in
 * those same coordinates — never fractions of the currently zoomed
 * sub-domain — so a consumer can filter its own row list with the emitted
 * range unchanged.
 * `window === null` is a controlled full view; omitting the prop entirely
 * (undefined) makes the ribbon keep its own window state.
 */

export type RibbonTone = "success" | "secondary" | "warning" | "error" | "muted";
export type RibbonStatus = "pending" | "error";

/** The floating card a segment carries: a title plus optional detail lines. */
export interface RibbonTip {
  title: string;
  lines?: string[];
}

/** One horizontal track of the ribbon (a device, a stream, a queue …). */
export interface RibbonLane {
  key: string;
  label: string;
}

/** One bar on a lane, in the caller's DOMAIN units (`start < end`). */
export interface RibbonSegment {
  id: string;
  lane: string;
  /** Start coordinate on the caller's domain axis. */
  start: number;
  /** End coordinate on the caller's domain axis. */
  end: number;
  label: string;
  tone?: RibbonTone;
  /** Free-form host vocabulary; forwarded as data-kind for styling hooks. */
  kind?: string;
  status?: RibbonStatus;
  tip?: RibbonTip;
}

type WindowRange = [number, number];

/** Assumed minimum window width when the host hands over something that is
 *  not a positive finite number (0 / negative / NaN). */
const MIN_WINDOW_FALLBACK = 0.02;
/** Keyboard nudge as a fraction of the AXIS SPAN for move and resize. */
const KEYBOARD_STEP = 0.05;
/** Slack for "did this interaction change anything" comparisons. */
const WINDOW_EPSILON = 1e-9;

/** An ordered pair of caller coordinates: the axis everything is drawn on. */
type DomainRange = [number, number];

/** The fallback axis: the familiar 0%..100% reading. */
const UNIT_DOMAIN: DomainRange = [0, 1];

function clampTo(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

function domainSpan(domain: DomainRange): number {
  return domain[1] - domain[0];
}

/** Sanitize a caller axis into an ordered, positive-width pair — `null` when
 *  the value cannot be one (not an array, a non-finite member, zero width).
 *  An inverted pair is sorted. Stays `null`-able instead of defaulting here
 *  because the component has a second fallback (the `headroom` alias). */
function sanitizeDomain(input: unknown): DomainRange | null {
  if (!Array.isArray(input) || input.length < 2) return null;
  const first = Number(input[0]);
  const second = Number(input[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  const lo = Math.min(first, second);
  const hi = Math.max(first, second);
  return hi > lo ? [lo, hi] : null;
}

/** The axis a caller meant, never `null`: malformed input is the unit axis.
 *  Shared by the component and `normalizeHkRangeWindow` so hosts and the
 *  ribbon fall back the same way. */
function resolveDomain(input: unknown): DomainRange {
  return sanitizeDomain(input) ?? UNIT_DOMAIN;
}

/** Percent with adaptive precision. An integer percentage stays an integer —
 *  the full domain must keep announcing the classic "0% – 100%" — while a
 *  fractional one keeps a decimal, so a narrow window ("0.4% – 99.6%") is
 *  distinguishable from the full domain instead of rounding to the same
 *  text. */
function percentNumber(fraction: number): number {
  const percentage = fraction * 100;
  const rounded = Math.round(percentage);
  return Math.abs(percentage - rounded) < 1e-9 ? rounded : Number(percentage.toFixed(1));
}

function percentText(fraction: number): string {
  return `${percentNumber(fraction)}%`;
}

/** Inline left/width pair — percentages are deterministic in tests and do
 *  not depend on layout measurement for rendering. */
function percent(fraction: number): string {
  return `${Number((fraction * 100).toFixed(4))}%`;
}

/**
 * Normalize a host-supplied window into the ribbon's contract.
 *
 * This is the ONE implementation the component and its hosts share — the
 * component's former private helper, identical except the min-guard, which
 * absorbs the component's existing sanitizer (that helper had no other
 * observers, so this is not a behaviour change). A consumer that keeps its
 * own rendering/filter driven by the same window (chest's trace model builds
 * its row filter from these fractions) must import this instead of mirroring
 * the algorithm: a copy forks silently the moment the algorithm or the 0.02
 * default changes upstream.
 *
 * @param input Any host window value. `null` / `undefined`, a non-array, an
 *   array with fewer than two entries, or either member non-finite all mean
 *   "no window" and return `null` (the host reads that as the full domain).
 * @param minWidth Narrowest window the ribbon will produce, in domain units,
 *   defaulting to 0.02. Capped at the axis span; a non-finite or non-positive
 *   value falls back to the default.
 * @param domain The axis the window lives on, defaulting to `[0, 1]`. An
 *   inverted pair is sorted; anything malformed (not an array, non-finite
 *   members, zero width) falls back to `[0, 1]`, which keeps the two-argument
 *   host calls byte-identical to the pre-domain contract.
 * @returns An ordered, domain-clamped `[start, end]` pair in the caller's
 *   axis units, never narrower than `minWidth` (or than the span), or `null`
 *   for "no window".
 */
export function normalizeHkRangeWindow(
  input: unknown,
  minWidth: number = MIN_WINDOW_FALLBACK,
  domain: readonly number[] | null = UNIT_DOMAIN,
): [number, number] | null {
  if (input == null || !Array.isArray(input) || input.length < 2) return null;
  const first = Number(input[0]);
  const second = Number(input[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  const [d0, d1] = resolveDomain(domain);
  const span = d1 - d0;
  const min =
    Number.isFinite(minWidth) && minWidth > 0
      ? Math.min(minWidth, span)
      : Math.min(MIN_WINDOW_FALLBACK, span);
  let lo = clampTo(Math.min(first, second), d0, d1);
  let hi = clampTo(Math.max(first, second), d0, d1);
  if (hi - lo < min) {
    // Expand around the point, then shift inward at the domain edges.
    const middle = (lo + hi) / 2;
    lo = middle - min / 2;
    hi = middle + min / 2;
    if (lo < d0) {
      lo = d0;
      hi = Math.min(d1, d0 + min);
    }
    if (hi > d1) {
      hi = d1;
      lo = Math.max(d0, d1 - min);
    }
  }
  return [lo, hi];
}

function windowsMatch(first: WindowRange | null, second: WindowRange | null): boolean {
  if (first === null || second === null) return first === second;
  return (
    Math.abs(first[0] - second[0]) < WINDOW_EPSILON &&
    Math.abs(first[1] - second[1]) < WINDOW_EPSILON
  );
}

interface PlacedSegment {
  segment: RibbonSegment;
  start: number;
  end: number;
}

/** The one intersection rule the whole component shares: the lanes render a
 *  segment, and the window filter keeps it, exactly when this is true. */
function intersectsWindow(placed: PlacedSegment, win: WindowRange): boolean {
  return placed.end > win[0] && placed.start < win[1];
}

/** Keep every usable segment, in the caller's DOMAIN units; drop NaN /
 *  unusable entries (a broken row must not take the whole ribbon down).
 *  Segments are deliberately NOT clamped here: content may extend past the
 *  axis the caller chose to show, and the projections clip to the domain at
 *  render time. A zero-length segment is kept: the LANE sheet gives it a 2px
 *  min-width floor under `box-sizing: border-box`, so a lane tick is exactly
 *  that 2px (the 1px borders sit inside it); the overview twin draws 1px. */
function placeSegments(segments: RibbonSegment[] | undefined): PlacedSegment[] {
  if (!Array.isArray(segments)) return [];
  const placed: PlacedSegment[] = [];
  for (const segment of segments) {
    if (!segment || typeof segment.id !== "string" || typeof segment.lane !== "string") continue;
    const first = Number(segment.start);
    const second = Number(segment.end);
    if (!Number.isFinite(first) || !Number.isFinite(second)) continue;
    placed.push({
      segment,
      start: Math.min(first, second),
      end: Math.max(first, second),
    });
  }
  return placed;
}

/** A box in domain fractions (0..1 of the surface it is drawn on). A type
 *  alias (not an interface) so Vue's `CSSProperties` accepts it. */
type SegmentBox = {
  left: number;
  width: number;
};

/** Clip a placed segment to the DOMAIN, in content units. This is the one
 *  domain-clipping rule: the minimap and the no-window detail both paint the
 *  domain, so anything wholly outside it is not drawn. A zero-length point is
 *  kept only when it lies on the domain (the strict `start < end` test above
 *  cannot express a point). */
function clipToDomain(placed: PlacedSegment, domain: DomainRange): WindowRange | null {
  const [d0, d1] = domain;
  if (placed.start === placed.end) {
    return placed.start >= d0 && placed.start <= d1 ? [placed.start, placed.start] : null;
  }
  if (placed.end <= d0 || placed.start >= d1) return null;
  return [Math.max(placed.start, d0), Math.min(placed.end, d1)];
}

/** The box a segment paints on the FULL-DOMAIN axis (0..1 = domain start..
 *  domain end). The minimap draws it directly and the no-window detail draws
 *  it too — with no window the detail's axis IS the domain — so the two
 *  layers agree by construction in the full-domain view. */
function domainBox(placed: PlacedSegment, domain: DomainRange): SegmentBox | null {
  const clipped = clipToDomain(placed, domain);
  if (!clipped) return null;
  return {
    left: projectToAxis(clipped[0], domain),
    width: projectToAxisLength(clipped[1] - clipped[0], domain),
  };
}

/** One of the TWO clipping sites (the other is `clipToDomain`, the domain
 *  axis): with a window, a segment is clipped to the window and
 *  re-normalized against it. Segments (and zero-length points) wholly
 *  outside the window return null and render nowhere in the lanes. */
function windowedBox(placed: PlacedSegment, win: WindowRange): SegmentBox | null {
  if (!intersectsWindow(placed, win)) return null;
  const [lo, hi] = win;
  const span = hi - lo;
  const start = Math.max(placed.start, lo);
  const end = Math.min(placed.end, hi);
  return {
    left: (start - lo) / span,
    width: (end - start) / span,
  };
}

/** Project one CONTENT COORDINATE onto the minimap axis:
 *  `(value - domain[0]) / span`. This pair (`projectToAxis` for
 *  coordinates, `projectToAxisLength` for lengths) is the ONLY place a
 *  content value becomes an axis x: the window frame, both scrims, both
 *  handles and `domainBox` (the clipped-domain segments, which delegates
 *  here) all go through them, and `fractionFrom` is the inverse (axis →
 *  content) for pointer input. The WINDOWED detail is never projected — its
 *  axis is the window itself — so none of this may leak into `windowedBox`;
 *  the no-window detail reuses `domainBox`, i.e. the domain axis.
 *  A coordinate and a length are different projections: a length has no
 *  origin and only divides by the span, which is why a box must not scale
 *  its width through the coordinate function. */
function projectToAxis(value: number, domain: DomainRange): number {
  return (value - domain[0]) / domainSpan(domain);
}

/** Project a CONTENT LENGTH (a box width) onto the minimap axis: no origin to
 *  subtract, so it only scales by `1/span`. */
function projectToAxisLength(length: number, domain: DomainRange): number {
  return length / domainSpan(domain);
}

/** Project a CONTENT box onto the minimap axis. The left edge is a
 *  coordinate, the width a length — scaling the width through
 *  `projectToAxis` would wrongly subtract the domain start from it. */
function axisBox(box: SegmentBox, domain: DomainRange): SegmentBox {
  return {
    left: projectToAxis(box.left, domain),
    width: projectToAxisLength(box.width, domain),
  };
}

/** Pointer travel (px) that turns a press into a brush; below it a click
 *  with sub-pixel jitter must not zoom to a hairline window. Touch taps
 *  drift much further than a mouse press (4–6px is normal), so touch gets
 *  its own, wider threshold — otherwise a tap would brush a minWindow. */
const BRUSH_SLOP_MOUSE = 3;
const BRUSH_SLOP_TOUCH = 10;

type Gesture =
  | {
      kind: "brush";
      pointerId: number;
      anchor: number;
      originX: number;
      slop: number;
      dragging: boolean;
    }
  | { kind: "edge"; pointerId: number; edge: "start" | "end" };

export default defineComponent({
  name: "HkRangeRibbon",
  props: {
    lanes: { type: Array as PropType<RibbonLane[]>, required: true },
    segments: { type: Array as PropType<RibbonSegment[]>, required: true },
    /** Id of the segment to paint as selected (host-owned). */
    selectedId: { type: String as PropType<string | null>, default: null },
    /** Controlled window in the caller's DOMAIN units; null = full domain.
     *  Omitting the prop (undefined) turns the uncontrolled fallback on. */
    window: {
      type: Array as PropType<number[] | null>,
      default: undefined,
    },
    /** Kill switch for the window feature: false = a static full-domain
     *  view (a supplied window is ignored, all window UI disappears). */
    windowEnabled: { type: Boolean, default: true },
    /** Narrowest window the ribbon will produce, in DOMAIN units. Capped at
     *  the axis span, because a floor wider than the axis could never fit
     *  inside it. */
    minWindow: { type: Number, default: MIN_WINDOW_FALLBACK },
    /** The axis the whole ribbon is drawn against: `[start, end]` in the SAME
     *  units as `segments` and `window`. Defaults to the unit axis `[0, 1]`
     *  (the familiar 0%..100%). A caller may declare a negative start or an
     *  end above 1 — `[-0.1, 1]` for a lead-in, `[0, 2]` for a 200% budget,
     *  `[-0.5, 1.5]` for a centred one — or a narrower window of interest
     *  such as `[0.2, 0.8]`. Sanitized: two finite numbers with a positive
     *  span; an inverted pair is sorted and anything else (not an array,
     *  non-finite members, zero width) falls back to `[0, 1]`. Content
     *  outside the domain is clipped away and space inside it the content
     *  does not fill stays blank; every emitted window is a coordinate on
     *  this axis. */
    domain: { type: Array as PropType<number[] | null>, default: undefined },
    /** @deprecated Use `domain`. Trailing-axis shorthand: a positive value
     *  means the axis is `[0, 1 + headroom]` (the "110%" reading is headroom
     *  0.1), sanitized to 0..1 and ignored when a valid `domain` is
     *  supplied. SOURCE-compatible with the old prop, NOT
     *  behaviour-compatible: there is no special tail-clamp — the component
     *  treats `[0, 1 + headroom]` as its coordinate system, so the old
     *  reserved tail becomes selectable axis, the axis end becomes the reset
     *  state, the keyboard step is 5% of the span and the no-window detail /
     *  minimal bar draw the axis. Kept for the 0.55 patch line. */
    headroom: { type: Number, default: 0 },
    /** Wave (2026-11-06 raw-records five): MINIMAL MODE — a bare dual-handle
     *  range bar: no lane rows and no detail layer (the strip still lives in
     *  the overview container, which keeps data-layer="minimap"). The shared
     *  label gutter is still rendered and hidden in this mode, so the strip
     *  spans the full width; its track uses muted-based tokens (the
     *  surface-based track read whitish inside dark phone modals).
     *  The grips paint only for a NON-null window, so an uncontrolled
     *  minimal bar starts as a bare track; a host that wants the "default =
     *  everything selected" reading feeds the controlled window covering the
     *  whole axis (`[d0, d1]`, i.e. `[0, 1]` on the default domain).
     *  `segments` / `selectedId` are IGNORED in this mode (no segment DOM to
     *  select from). */
    minimal: { type: Boolean, default: false },
  },
  emits: {
    select: (_id: string) => true,
    windowChange: (_window: WindowRange | null) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const stripRef = ref<HTMLElement | null>(null);

    const internalWindow = ref<WindowRange | null>(null);
    /** Id of the segment whose tip card is floating (hover or focus). */
    const tipSegmentId = ref<string | null>(null);
    const hintId = `hk-range-ribbon-hint-${useId()}`;

    let gesture: Gesture | null = null;

    /** Sanitized trailing headroom (the DEPRECATED `domain` alias): a
     *  non-finite or negative value is no headroom at all, and more than a
     *  full axis of extra range is capped, so the alias axis never exceeds
     *  `[0, 2]`. */
    const headroom = computed(() => {
      const raw = Number(props.headroom);
      return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 1) : 0;
    });

    /** The effective axis: the caller's valid `domain`, else the deprecated
     *  `headroom` shorthand `[0, 1 + headroom]`, else the unit axis. Every
     *  geometry path (minimap x, scrims, handles, pointer input) reads this
     *  one pair, so a declared domain and the alias cannot disagree, and
     *  `minimal` mode draws the same axis as the full ribbon. */
    const domain = computed<DomainRange>(() => {
      const provided = sanitizeDomain(props.domain);
      if (provided) return provided;
      const extra = headroom.value;
      return extra > 0 ? [0, 1 + extra] : UNIT_DOMAIN;
    });

    /** Narrowest window the ribbon will produce, in DOMAIN units. A request
     *  wider than the axis is capped at the span: a minWindow longer than the
     *  domain could never be satisfied inside it. */
    const minWidth = computed(() => {
      const raw = Number(props.minWindow);
      const span = domainSpan(domain.value);
      const requested = Number.isFinite(raw) && raw > 0 ? raw : MIN_WINDOW_FALLBACK;
      return Math.min(requested, span);
    });

    /** A supplied `window` prop (even null) is the controlled contract; no
     *  prop at all means "keep your own state". */
    const controlled = computed(() => props.window !== undefined);

    const activeWindow = computed<WindowRange | null>(() => {
      if (!props.windowEnabled) return null;
      const source = controlled.value ? props.window : internalWindow.value;
      return normalizeHkRangeWindow(source, minWidth.value, domain.value);
    });

    const lanes = computed<RibbonLane[]>(() =>
      Array.isArray(props.lanes)
        ? props.lanes.filter(
            (lane): lane is RibbonLane =>
              Boolean(lane) && typeof lane.key === "string" && typeof lane.label === "string",
          )
        : [],
    );

    const placedSegments = computed(() => placeSegments(props.segments));

    /** Ids the LANES actually paint right now (declared lane +, when
     *  windowed, intersecting it). The tip card must never outlive its
     *  segment: a window change unmounts the hovered bar, and the tip id
     *  would otherwise resurrect the card with no pointer or focus. */
    const renderedSegmentIds = computed(() => {
      const win = activeWindow.value;
      const axis = domain.value;
      const declared = new Set(lanes.value.map((lane) => lane.key));
      const ids = new Set<string>();
      for (const placed of placedSegments.value) {
        if (!declared.has(placed.segment.lane)) continue;
        // With a window the clipping site is the window; without one it is
        // the domain (the detail's no-window axis), so a segment outside the
        // caller's axis cannot leave a tip card behind.
        if (win ? !intersectsWindow(placed, win) : clipToDomain(placed, axis) === null) continue;
        ids.add(placed.segment.id);
      }
      return ids;
    });

    watch(renderedSegmentIds, (ids) => {
      if (tipSegmentId.value !== null && !ids.has(tipSegmentId.value)) {
        tipSegmentId.value = null;
      }
    });

    /** Emit the window in absolute coordinates on the caller's domain axis;
     *  the uncontrolled fallback mirrors it into local state so the ribbon
     *  still zooms without a host listener. Controlled hosts own the prop and
     *  are never overwritten. */
    function commitWindow(next: WindowRange | null): void {
      if (!props.windowEnabled) return;
      if (!controlled.value) internalWindow.value = next;
      emit("windowChange", next);
    }

    /** Commit only a real change: a no-op at a domain edge must not wake the
     *  host (and must not report a new window that equals the old one). */
    function commitIfChanged(next: WindowRange | null): boolean {
      if (!props.windowEnabled) return false;
      if (windowsMatch(next, activeWindow.value)) return false;
      commitWindow(next);
      return true;
    }

    /** A window that covers the whole domain IS the unfiltered state — there
     *  is nothing to reset back to (2026-11-07, the raw-records consumer: a
     *  minimal bar paints its grips for a non-null window, so its rest state
     *  is the full axis `[d0, d1]`; without this check Escape "reset" it
     *  every press, swallowed the key, and the hosting dialog could never
     *  close while the bar held focus). */
    function isFullDomain(win: WindowRange | null): boolean {
      const [d0, d1] = domain.value;
      return win !== null && win[0] <= d0 + WINDOW_EPSILON && win[1] >= d1 - WINDOW_EPSILON;
    }

    /** Returns true when a window actually existed AND was narrower than the
     *  full domain (and was cleared), so the caller can leave Escape alone
     *  when the host needs it — a full-domain window has nothing to reset. */
    function resetWindow(): boolean {
      if (isFullDomain(activeWindow.value)) return false;
      if (!commitIfChanged(null)) return false;
      // A reset that interrupts a drag (Escape mid-brush) must drop the
      // gesture too, or the next pointermove re-brushes from the stale
      // anchor and undoes the reset.
      gesture = null;
      return true;
    }

    /** Pointer x → a CONTENT coordinate in the caller's DOMAIN units. The
     *  pointer reads as a fraction of the strip's WHOLE width, so the reading
     *  is mapped onto the axis (`d0 + x * span`) and clamped to it: a press
     *  past either edge lands on that domain edge, never outside the
     *  caller's coordinates. This is the only axis→content conversion in the
     *  component. */
    function fractionFrom(clientX: number): number | null {
      const strip = stripRef.value;
      if (!strip) return null;
      const rect = strip.getBoundingClientRect();
      if (!(rect.width > 0)) return null;
      const [d0, d1] = domain.value;
      return clampTo(d0 + ((clientX - rect.left) / rect.width) * (d1 - d0), d0, d1);
    }

    function brushTo(fraction: number): void {
      if (!gesture || gesture.kind !== "brush") return;
      const [d0, d1] = domain.value;
      // The anchor was captured at pointerdown; a `domain` prop that changes
      // mid-gesture would otherwise let a stale anchor build a window outside
      // the current axis.
      const anchor = clampTo(gesture.anchor, d0, d1);
      const min = minWidth.value;
      let lo = Math.min(anchor, fraction);
      let hi = Math.max(anchor, fraction);
      if (hi - lo < min) {
        // Keep the anchor pinned and build the minimum width away from it.
        // Do NOT re-test `hi - lo < min` afterwards: `anchor + min - anchor`
        // can land a float epsilon BELOW min, and treating that as "the
        // domain squeezed us" would teleport the window to the far edge
        // (0.5 + 0.1 was answering [0.9, 1]). The domain edge is the only
        // reason to shift, and it has its own explicit check.
        if (fraction >= anchor) {
          lo = anchor;
          hi = anchor + min;
        } else {
          hi = anchor;
          lo = anchor - min;
        }
        if (lo < d0) {
          lo = d0;
          hi = Math.min(d1, d0 + min);
        } else if (hi > d1) {
          hi = d1;
          lo = Math.max(d0, d1 - min);
        }
      }
      commitWindow([lo, hi]);
    }

    /** The window produced by moving ONE edge to `fraction` (a DOMAIN-unit
     *  coordinate), clamped so the window never crosses itself, never drops
     *  below minWindow and never leaves the caller's axis. Pure: drag and
     *  keyboard share it. */
    function edgeWindow(
      win: WindowRange,
      edge: "start" | "end",
      fraction: number,
    ): WindowRange {
      const min = minWidth.value;
      const [d0, d1] = domain.value;
      const [lo, hi] = win;
      if (edge === "start") {
        return [Math.max(d0, Math.min(fraction, hi - min)), hi];
      }
      return [lo, Math.min(d1, Math.max(fraction, lo + min))];
    }

    function dragEdge(edge: "start" | "end", fraction: number): void {
      const win = activeWindow.value;
      if (!win) return;
      commitWindow(edgeWindow(win, edge, fraction));
    }

    function onStripPointerDown(event: PointerEvent): void {
      // One pointer owns the gesture: a second finger must not teleport the
      // window or steal the anchor (multi-touch).
      if (!props.windowEnabled || gesture) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const fraction = fractionFrom(event.clientX);
      if (fraction === null) return;
      gesture = {
        kind: "brush",
        pointerId: event.pointerId,
        anchor: fraction,
        originX: event.clientX,
        slop: event.pointerType === "touch" ? BRUSH_SLOP_TOUCH : BRUSH_SLOP_MOUSE,
        dragging: false,
      };
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }

    function onHandlePointerDown(edge: "start" | "end", event: PointerEvent): void {
      if (!props.windowEnabled || gesture) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!activeWindow.value) return;
      // The handles are SIBLINGS of the strip, not children of it, so this
      // press never reaches the strip's brush handler in the first place.
      // The stopPropagation below keeps the press out of BUBBLE-phase
      // listeners in the consuming host — none exist in-package today (every
      // in-package document-level pointerdown listener is capture-phase and
      // still sees the press).
      event.stopPropagation();
      gesture = { kind: "edge", pointerId: event.pointerId, edge };
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }

    function onPointerMove(event: PointerEvent): void {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if (gesture.kind === "brush" && !gesture.dragging) {
        // A plain click with sub-pixel jitter is not a brush.
        if (Math.abs(event.clientX - gesture.originX) < gesture.slop) return;
        gesture.dragging = true;
      }
      const fraction = fractionFrom(event.clientX);
      if (fraction === null) return;
      if (gesture.kind === "brush") brushTo(fraction);
      else dragEdge(gesture.edge, fraction);
    }

    function endGesture(event: PointerEvent): void {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      gesture = null;
    }

    /** Arrow = slide the whole window; Shift+Arrow = resize from the
     *  trailing (end) edge. A plain arrow with no window is inert, so the
     *  full-domain view cannot be nudged into a meaningless window; a
     *  Shift+Arrow contracts the full domain into one (keyboard entry). The
     *  nudge is 5% of the VISIBLE span, so a domain of [0, 2] steps 0.1 while
     *  the unit axis keeps the classic 0.05. Inert and no-op arrows are
     *  decided FIRST and left un-prevented, so the host's normal arrow
     *  behaviour survives them. */
    function onStripKeyDown(event: KeyboardEvent): void {
      if (!props.windowEnabled) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const [d0, d1] = domain.value;
      const step = KEYBOARD_STEP * (d1 - d0);
      const win = activeWindow.value;
      const min = minWidth.value;
      let next: WindowRange | null = null;
      if (!event.shiftKey) {
        if (!win) return; // inert without a window
        const width = win[1] - win[0];
        const nextLo = Math.min(Math.max(win[0] + direction * step, d0), d1 - width);
        next = [nextLo, nextLo + width];
      } else if (!win) {
        if (direction > 0) return; // the full domain cannot grow
        const end = Math.max(min, d1 - step);
        if (end >= d1) return;
        next = [d0, end];
      } else {
        next = [win[0], Math.min(d1, Math.max(win[0] + min, win[1] + direction * step))];
      }
      if (next && commitIfChanged(next)) event.preventDefault();
    }

    /** Handle sliders keep their own edge keyboard-editable (same 5%-of-span
     *  nudge as the strip). */
    function onHandleKeyDown(edge: "start" | "end", event: KeyboardEvent): void {
      if (!props.windowEnabled) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const win = activeWindow.value;
      if (!win) return;
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const [d0, d1] = domain.value;
      const step = KEYBOARD_STEP * (d1 - d0);
      const current = edge === "start" ? win[0] : win[1];
      const next = edgeWindow(win, edge, current + direction * step);
      if (commitIfChanged(next)) event.preventDefault();
    }

    function onRootKeyDown(event: KeyboardEvent): void {
      if (!props.windowEnabled) return;
      // Escape resets from anywhere inside the ribbon — but only a REAL reset
      // consumes the key: with no window AND no live gesture, Escape still
      // reaches the host (a dialog closes on it while focus sits in here).
      if (event.key === "Escape") {
        // An in-flight drag is a real, unsaved gesture: cancel it even before
        // the first commit (a brush still inside the slop has produced no
        // window yet, so the reset path alone would find nothing to do).
        // Cancelling consumes the key on its own; with NO gesture and no
        // window the key is still handed back to the host.
        const hadGesture = gesture !== null;
        gesture = null;
        if (resetWindow() || hadGesture) event.preventDefault();
        return;
      }
      if (event.key !== "Home") return;
      // Home is the range surface's own shortcut: a focused segment keeps
      // its native Home behaviour (caret/scroll in the host).
      const surface = (event.target as Element | null)?.closest?.(
        ".hk-range-ribbon-strip, .hk-range-ribbon-handle, .hk-range-ribbon-reset",
      );
      if (!surface) return;
      if (resetWindow()) event.preventDefault();
    }

    function showTip(id: string): void {
      tipSegmentId.value = id;
    }

    function hideTip(id: string): void {
      if (tipSegmentId.value === id) tipSegmentId.value = null;
    }

    // Wave (raw-records five): the label column is JS-MEASURED. The fixed
    // minmax(48px,84px) floor left a dead band next to short labels, and a
    // CSS max-content cannot align two independent grids (each lane sizes
    // to its own label; the overview gutter has no text to size from — a
    // hidden-probe attempt measured misaligned in real Chrome). Measuring
    // the widest rendered label and publishing it as the shared var gives
    // BOTH surfaces the same resolved column, so they start at the same
    // inline x: adaptive and aligned.
    const rootRef = ref<HTMLElement | null>(null);
    const pinnedCol = ref<string | null>(null);
    /** TWO-PHASE measure: FREE the column first. A pinned px width clips
     *  long labels, and a clipped label's offsetWidth equals the clip - so
     *  a naive offsetWidth max can never GROW after the first pin (and a
     *  smaller max leaves the dead band). Freeing lets labels reflow to
     *  natural width; the next frame reads the true text width
     *  (scrollWidth == offsetWidth when unclipped) and re-pins only when
     *  the value changed (converges - no ResizeObserver loop). */
    const syncLabelCol = () => {
      const root = rootRef.value;
      if (!root) return;
      root.style.setProperty("--hk-range-ribbon-label-col", "max-content");
      requestAnimationFrame(() => {
        const r = rootRef.value;
        if (!r) return;
        const labels = r.querySelectorAll<HTMLElement>(".hk-range-ribbon-lane-label");
        let max = 0;
        for (const el of labels) {
          max = Math.max(max, el.offsetWidth, el.scrollWidth);
        }
        if (max <= 0) return;
        const next = `${max}px`;
        // Guard on the CURRENT INLINE value, not the last measurement:
        // after the FREE phase the inline value is "max-content", and an
        // unchanged measurement must STILL re-pin (the re-pin restores the
        // px column the free took away - skipping it because "40px == 40px"
        // left the bar resting misaligned at freed max-content, measured in
        // real Chrome: field 20 vs tracks 41/60).
        if (r.style.getPropertyValue("--hk-range-ribbon-label-col") !== next) {
          pinnedCol.value = next;
          r.style.setProperty("--hk-range-ribbon-label-col", next);
        }
      });
    };
    const labelObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => syncLabelCol())
        : null;

    onMounted(() => {
      // Window-level listeners: a pointer captured by a drag target still
      // emits moves/ups here, and a drag that leaves the strip keeps
      // tracking (same primitive as HkMediaSlider). Only the pointer that
      // STARTED the gesture is honoured.
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endGesture);
      window.addEventListener("pointercancel", endGesture);
      // Publish the measured label column (see syncLabelCol above): after
      // the first paint, on any lane-label resize (locale swap, viewport
      // font change), and when the lanes vocabulary itself changes.
      syncLabelCol();
      labelObserver?.observe(rootRef.value!);
      watch(
        lanes,
        () => {
          nextTick(syncLabelCol);
        },
        { deep: true },
      );
    });

    onBeforeUnmount(() => {
      labelObserver?.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endGesture);
      window.removeEventListener("pointercancel", endGesture);
      gesture = null;
    });

    function renderSegment(placed: PlacedSegment, box: SegmentBox) {
      const segment = placed.segment;
      const selected = props.selectedId === segment.id;
      const tip = segment.tip;
      const tipVisible = tipSegmentId.value === segment.id && tip != null;
      // Anchor the tip inside the ribbon: near either end the card grows
      // inward from the segment's own edge instead of overflowing the host.
      const center = box.left + box.width / 2;
      const tipAnchor = center > 0.75 ? "end" : center < 0.25 ? "start" : "middle";
      return (
        <div
          key={segment.id}
          class="hk-range-ribbon-segment"
          data-segment-id={segment.id}
          data-tone={segment.tone}
          data-kind={segment.kind}
          data-status={segment.status}
          data-selected={selected ? "true" : undefined}
          role="button"
          tabindex={0}
          style={{ left: percent(box.left), width: percent(box.width) }}
          onMouseenter={() => showTip(segment.id)}
          onMouseleave={() => hideTip(segment.id)}
          onFocus={() => showTip(segment.id)}
          onBlur={() => hideTip(segment.id)}
          onClick={() => emit("select", segment.id)}
          onKeydown={(event: KeyboardEvent) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            emit("select", segment.id);
          }}
        >
          <span class="hk-range-ribbon-segment-label">{segment.label}</span>
          {tipVisible && (
            <span class="hk-range-ribbon-tip" role="tooltip" data-anchor={tipAnchor}>
              <span class="hk-range-ribbon-tip-title">{tip.title}</span>
              {(tip.lines ?? []).map((line, index) => (
                <span class="hk-range-ribbon-tip-line" key={index}>
                  {line}
                </span>
              ))}
            </span>
          )}
        </div>
      );
    }

    return () => {
      const win = activeWindow.value;

      // Segments whose lane is not declared are dropped: the lanes prop is
      // the structure, a segment can never invent a track.
      const byLane = new Map<string, PlacedSegment[]>();
      for (const lane of lanes.value) byLane.set(lane.key, []);
      for (const placed of placedSegments.value) {
        byLane.get(placed.segment.lane)?.push(placed);
      }

      // Minimap geometry, content → axis (projected through the two helpers
      // only). The before scrim starts at the DOMAIN start (axis 0) and the
      // after scrim runs to the DOMAIN end, so both cover exactly the
      // coordinates outside the window — content the domain shows but the
      // caller did not select.
      const axis = domain.value;
      const minimapFrame = win ? axisBox({ left: win[0], width: win[1] - win[0] }, axis) : null;
      const minimapBefore = win ? { left: 0, width: projectToAxis(win[0], axis) } : null;
      const minimapAfterLeft = win ? projectToAxis(win[1], axis) : 0;
      const minimapAfter = win
        ? { left: minimapAfterLeft, width: 1 - minimapAfterLeft }
        : null;

      const strip = (
        <div
          ref={stripRef}
          class="hk-range-ribbon-strip"
          data-windowed={win ? "true" : undefined}
          role="slider"
          aria-orientation="horizontal"
          tabindex={props.windowEnabled ? 0 : -1}
          aria-label={t("hikari::ribbon.rangeAria", "Observation range")}
          aria-describedby={props.windowEnabled ? hintId : undefined}
          aria-disabled={props.windowEnabled ? undefined : "true"}
          aria-valuemin={percentNumber(axis[0])}
          aria-valuemax={percentNumber(axis[1])}
          aria-valuenow={percentNumber(win ? win[0] : axis[0])}
          aria-valuetext={`${percentText(win ? win[0] : axis[0])} – ${percentText(
            win ? win[1] : axis[1],
          )}`}
          title={
            props.windowEnabled
              ? t(
                  "hikari::ribbon.dragHint",
                  "Drag to select a range; double-click, Escape or Home resets",
                )
              : undefined
          }
          onPointerdown={onStripPointerDown}
          onDblclick={(event: MouseEvent) => {
            // Same rule as Escape/Home: only a double-click that actually
            // resets consumes the event.
            if (resetWindow()) event.preventDefault();
          }}
          onKeydown={onStripKeyDown}
        >
          {/* The overview paints the whole DOMAIN only — it never follows
              the zoom, so the window's position stays locatable. Bars are
              clipped to the caller's axis, so content beyond it simply does
              not exist here. */}
          <div class="hk-range-ribbon-overview-lanes" aria-hidden="true">
            {!props.minimal && lanes.value.map((lane) => (
              <div class="hk-range-ribbon-overview-row" key={lane.key} data-lane={lane.key}>
                {(byLane.get(lane.key) ?? []).map((placed) => {
                  const box = domainBox(placed, axis);
                  if (!box) return null;
                  return (
                    <div
                      key={placed.segment.id}
                      class="hk-range-ribbon-overview-segment"
                      data-segment-id={placed.segment.id}
                      data-tone={placed.segment.tone}
                      data-status={placed.segment.status}
                      style={{ left: percent(box.left), width: percent(box.width) }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {win && (
            <>
              <div
                class="hk-range-ribbon-scrim"
                data-side="before"
                style={{ left: percent(minimapBefore!.left), width: percent(minimapBefore!.width) }}
              />
              <div
                class="hk-range-ribbon-scrim"
                data-side="after"
                style={{ left: percent(minimapAfter!.left), width: percent(minimapAfter!.width) }}
              />
              <div
                class="hk-range-ribbon-window"
                style={{
                  left: percent(minimapFrame!.left),
                  width: percent(minimapFrame!.width),
                }}
              />
            </>
          )}
        </div>
      );

      return (
        <div
          ref={rootRef}
          class="hk-range-ribbon"
          data-minimal={props.minimal || undefined}
          data-windowed={win ? "true" : undefined}
          data-window-enabled={props.windowEnabled ? "true" : "false"}
          onKeydown={onRootKeyDown}
        >
          {/* LAYER 1 — the minimap: the caller's whole domain, the brush
              surface, the window chrome. It shares the lanes' label column
              (an empty gutter first), so both layers always start at the same
              inline x; their x% agree only in the full-domain view (a window
              re-normalizes the detail, a non-unit domain rescales the
              minimap). */}
          <div class="hk-range-ribbon-overview" data-layer="minimap">
            {/* The gutter's width IS the shared label column: the
                component JS-measures the widest rendered label and
                publishes it on the root (two-phase free/measure/pin), so
                this empty cell keeps both layers' inline START aligned at
                any label width (their x% only agree in the full-domain
                view). */}
            <span class="hk-range-ribbon-overview-gutter" aria-hidden="true" />
            <div class="hk-range-ribbon-overview-field">
              {strip}
              {win && (
                <>
                  <div
                    class="hk-range-ribbon-handle"
                    data-edge="start"
                    role="slider"
                    aria-orientation="horizontal"
                    tabindex={0}
                    aria-label={t("hikari::ribbon.windowStart", "Window start")}
                    aria-valuemin={percentNumber(axis[0])}
                    aria-valuemax={percentNumber(win[1] - minWidth.value)}
                    aria-valuenow={percentNumber(win[0])}
                    aria-valuetext={percentText(win[0])}
                    style={{ left: percent(projectToAxis(win[0], axis)) }}
                    onPointerdown={(event: PointerEvent) => onHandlePointerDown("start", event)}
                    onKeydown={(event: KeyboardEvent) => onHandleKeyDown("start", event)}
                  />
                  <div
                    class="hk-range-ribbon-handle"
                    data-edge="end"
                    role="slider"
                    aria-orientation="horizontal"
                    tabindex={0}
                    aria-label={t("hikari::ribbon.windowEnd", "Window end")}
                    aria-valuemin={percentNumber(win[0] + minWidth.value)}
                    aria-valuemax={percentNumber(axis[1])}
                    aria-valuenow={percentNumber(win[1])}
                    aria-valuetext={percentText(win[1])}
                    style={{ left: percent(projectToAxis(win[1], axis)) }}
                    onPointerdown={(event: PointerEvent) => onHandlePointerDown("end", event)}
                    onKeydown={(event: KeyboardEvent) => onHandleKeyDown("end", event)}
                  />
                  {/* The reset affordance is the STANDARD icon button (user
                      direction 2026-11-06: no hand-rolled chip chrome) —
                      HkIconButton owns box, glyph size, hover, press and
                      focus; this sheet only pins the seat (position) and a
                      surface backing via its override vars. The glyph slots
                      as a lucide component (the house-normal integration:
                      every in-tree HkIconButton slots its glyph). A
                      full-domain window has nothing to reset, so the chip
                      only renders for a REAL sub-domain selection. */}
                  {win && !isFullDomain(win) && (
                  <HIconButton
                    class="hk-range-ribbon-reset"
                    size={24}
                    variant="ghost"
                    aria-label={t("hikari::ribbon.reset", "Reset range")}
                    {...{ title: t("hikari::ribbon.reset", "Reset range") }}
                    onClick={resetWindow}
                  >
                    {{ icon: () => <RotateCcw aria-hidden="true" /> }}
                  </HIconButton>
                  )}
                </>
              )}
            </div>
            {props.windowEnabled && (
              <span id={hintId} class="hk-range-ribbon-hint">
                {`${t(
                  "hikari::ribbon.moveWindow",
                  "Move window",
                )}: ←/→ · ${t(
                  "hikari::ribbon.resizeWindow",
                  "Resize window",
                )}: ⇧+←/→ · ${t(
                  "hikari::ribbon.dragHint",
                  "Drag to select a range; double-click, Escape or Home resets",
                )}`}
              </span>
            )}
          </div>
          {/* LAYER 2 — the detail: the same segments, focused. Its track is
              always 0..100% of the SELECTED WINDOW, in the caller's domain
              units: a window of [0.35, 0.67] (the familiar 35%..67% on the
              default [0, 1] axis) starts the detail at 0 and ends it at 100%,
              and a segment at 1.0 inside a [0.5, 1.5] window lands at 50%.
              With no window the map is absent, so the detail's axis is the
              caller's DOMAIN (the full view): a domain wider than the content
              leaves blank space instead of stretching the content. */}
          {!props.minimal && (
          <div class="hk-range-ribbon-detail" data-layer="detail">
            <div class="hk-range-ribbon-lanes">
              {lanes.value.map((lane) => (
                <div class="hk-range-ribbon-lane" key={lane.key} data-lane={lane.key}>
                  <span class="hk-range-ribbon-lane-label" title={lane.label}>
                    {lane.label}
                  </span>
                  <div class="hk-range-ribbon-lane-track" role="group" aria-label={lane.label}>
                    {(byLane.get(lane.key) ?? []).map((placed) => {
                      const box = win ? windowedBox(placed, win) : domainBox(placed, axis);
                      return box ? renderSegment(placed, box) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      );
    };
  },
});
