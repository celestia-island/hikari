import { RotateCcw } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
  type PropType,
} from "vue";

import { useI18n } from "../i18n/context";
import "./HkRangeRibbon.scss";

/**
 * HkRangeRibbon — the generic multi-lane "sequence ribbon" with a brushed
 * observation window.
 *
 * One thin OVERVIEW strip paints the whole sequence (fractions of the full
 * domain), a highlight marks the active window and the outside is dimmed;
 * below it, every lane renders its segments. With no window the lanes are
 * the full domain; with a window the lanes zoom to it — only segments that
 * intersect the window survive, clipped at the edges and re-normalized to
 * the window. The overview NEVER clips: it is the only place the full
 * domain stays visible. The overview shares the lanes' label column, so a
 * bar at x% sits at the same inline position on both surfaces.
 *
 * Editing: drag on the strip to brush a new window, drag either edge handle
 * to resize it, and reset back to the full domain — the reset button, a
 * strip double-click, Escape anywhere inside the ribbon, or Home when the
 * range surface (strip / handle / reset button) holds focus. The strip is
 * focusable: arrows slide the window, Shift+arrows resize it. Handle sliders
 * nudge their own edge. Hovering or focusing a segment floats its tip card
 * (tip.title + tip.lines); the card anchors inside the ribbon at the edges.
 *
 * Contract with the host: `segments` are fed in FULL-DOMAIN fractions
 * (0..1) and `windowChange` always answers in those same absolute
 * fractions — never fractions of the currently zoomed sub-domain — so a
 * consumer can filter its own row list with the emitted range unchanged.
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

/** One bar on a lane, in fractions of the FULL domain (`start < end`). */
export interface RibbonSegment {
  id: string;
  lane: string;
  /** Fraction of the full sequence, 0..1. */
  start: number;
  /** Fraction of the full sequence, 0..1. */
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
/** Keyboard nudge (fraction of the full domain) for move and resize. */
const KEYBOARD_STEP = 0.05;
/** Slack for "did this interaction change anything" comparisons. */
const WINDOW_EPSILON = 1e-9;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Inline left/width pair — percentages are deterministic in tests and do
 *  not depend on layout measurement for rendering. */
function percent(fraction: number): string {
  return `${Number((fraction * 100).toFixed(4))}%`;
}

/** Normalize a host window: swap inverted ranges, clamp to the domain,
 *  ignore non-finite or malformed input (that means "no window"), and never
 *  return a window narrower than `minWidth`. */
function normalizeWindow(input: unknown, minWidth: number): WindowRange | null {
  if (input == null || !Array.isArray(input) || input.length < 2) return null;
  const first = Number(input[0]);
  const second = Number(input[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  const min = Math.min(Math.max(minWidth, 0), 1);
  let lo = clamp01(Math.min(first, second));
  let hi = clamp01(Math.max(first, second));
  if (hi - lo < min) {
    // Expand around the point, then shift inward at a domain edge.
    const middle = (lo + hi) / 2;
    lo = middle - min / 2;
    hi = middle + min / 2;
    if (lo < 0) {
      lo = 0;
      hi = Math.min(1, min);
    }
    if (hi > 1) {
      hi = 1;
      lo = Math.max(0, 1 - min);
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

/** Clamp every segment into the domain; drop NaN/unusable entries (a broken
 *  row must not take the whole ribbon down). A zero-length segment is kept —
 *  it renders as a tick thanks to the sheet's min-width. */
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
      start: clamp01(Math.min(first, second)),
      end: clamp01(Math.max(first, second)),
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

function fullDomainBox(placed: PlacedSegment): SegmentBox {
  return {
    left: placed.start,
    width: placed.end - placed.start,
  };
}

/** The ONLY place clipping happens: with a window, a segment is clipped to
 *  the window and re-normalized against it. Segments (and zero-length
 *  points) wholly outside the window return null and render nowhere in the
 *  lanes. */
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
    /** Controlled window in FULL-DOMAIN fractions; null = full domain.
     *  Omitting the prop (undefined) turns the uncontrolled fallback on. */
    window: {
      type: Array as PropType<number[] | null>,
      default: undefined,
    },
    /** Kill switch for the window feature: false = a static full-domain
     *  view (a supplied window is ignored, all window UI disappears). */
    windowEnabled: { type: Boolean, default: true },
    /** Narrowest window the ribbon will produce, in domain fractions. */
    minWindow: { type: Number, default: MIN_WINDOW_FALLBACK },
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

    const minWidth = computed(() => {
      const raw = Number(props.minWindow);
      return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 1) : MIN_WINDOW_FALLBACK;
    });

    /** A supplied `window` prop (even null) is the controlled contract; no
     *  prop at all means "keep your own state". */
    const controlled = computed(() => props.window !== undefined);

    const activeWindow = computed<WindowRange | null>(() => {
      if (!props.windowEnabled) return null;
      const source = controlled.value ? props.window : internalWindow.value;
      return normalizeWindow(source, minWidth.value);
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
      const declared = new Set(lanes.value.map((lane) => lane.key));
      const ids = new Set<string>();
      for (const placed of placedSegments.value) {
        if (!declared.has(placed.segment.lane)) continue;
        if (win && !intersectsWindow(placed, win)) continue;
        ids.add(placed.segment.id);
      }
      return ids;
    });

    watch(renderedSegmentIds, (ids) => {
      if (tipSegmentId.value !== null && !ids.has(tipSegmentId.value)) {
        tipSegmentId.value = null;
      }
    });

    /** Emit the window in FULL-DOMAIN fractions; the uncontrolled fallback
     *  mirrors it into local state so the ribbon still zooms without a host
     *  listener. Controlled hosts own the prop and are never overwritten. */
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

    /** Returns true when a window actually existed (and was cleared), so the
     *  caller can leave Escape alone when the host needs it. */
    function resetWindow(): boolean {
      if (!commitIfChanged(null)) return false;
      // A reset that interrupts a drag (Escape mid-brush) must drop the
      // gesture too, or the next pointermove re-brushes from the stale
      // anchor and undoes the reset.
      gesture = null;
      return true;
    }

    function fractionFrom(clientX: number): number | null {
      const strip = stripRef.value;
      if (!strip) return null;
      const rect = strip.getBoundingClientRect();
      if (!(rect.width > 0)) return null;
      return clamp01((clientX - rect.left) / rect.width);
    }

    function brushTo(fraction: number): void {
      if (!gesture || gesture.kind !== "brush") return;
      const anchor = gesture.anchor;
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
        if (lo < 0) {
          lo = 0;
          hi = Math.min(1, min);
        } else if (hi > 1) {
          hi = 1;
          lo = Math.max(0, 1 - min);
        }
      }
      commitWindow([lo, hi]);
    }

    /** The window produced by moving ONE edge to `fraction` (absolute domain
     *  fraction), clamped so the window never crosses itself and never drops
     *  below minWindow. Pure: drag and keyboard share it. */
    function edgeWindow(
      win: WindowRange,
      edge: "start" | "end",
      fraction: number,
    ): WindowRange {
      const min = minWidth.value;
      const [lo, hi] = win;
      if (edge === "start") {
        return [Math.max(0, Math.min(fraction, hi - min)), hi];
      }
      return [lo, Math.min(1, Math.max(fraction, lo + min))];
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
      // The handle sits over the strip: never start a brush underneath it.
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
     *  Shift+Arrow contracts the full domain into one (keyboard entry).
     *  Inert and no-op arrows are decided FIRST and left un-prevented, so
     *  the host's normal arrow behaviour survives them. */
    function onStripKeyDown(event: KeyboardEvent): void {
      if (!props.windowEnabled) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const win = activeWindow.value;
      const min = minWidth.value;
      let next: WindowRange | null = null;
      if (!event.shiftKey) {
        if (!win) return; // inert without a window
        const width = win[1] - win[0];
        const nextLo = Math.min(Math.max(win[0] + direction * KEYBOARD_STEP, 0), 1 - width);
        next = [nextLo, nextLo + width];
      } else if (!win) {
        if (direction > 0) return; // the full domain cannot grow
        const end = Math.max(min, 1 - KEYBOARD_STEP);
        if (end >= 1) return;
        next = [0, end];
      } else {
        next = [win[0], Math.min(1, Math.max(win[0] + min, win[1] + direction * KEYBOARD_STEP))];
      }
      if (next && commitIfChanged(next)) event.preventDefault();
    }

    /** Handle sliders keep their own edge keyboard-editable. */
    function onHandleKeyDown(edge: "start" | "end", event: KeyboardEvent): void {
      if (!props.windowEnabled) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const win = activeWindow.value;
      if (!win) return;
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const current = edge === "start" ? win[0] : win[1];
      const next = edgeWindow(win, edge, current + direction * KEYBOARD_STEP);
      if (commitIfChanged(next)) event.preventDefault();
    }

    function onRootKeyDown(event: KeyboardEvent): void {
      if (!props.windowEnabled) return;
      // Escape resets from anywhere inside the ribbon — but only a REAL reset
      // consumes the key: with no window, Escape must still reach the host
      // (a dialog closes on it while focus sits in here).
      if (event.key === "Escape") {
        if (resetWindow()) event.preventDefault();
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

    onMounted(() => {
      // Window-level listeners: a pointer captured by a drag target still
      // emits moves/ups here, and a drag that leaves the strip keeps
      // tracking (same primitive as HkMediaSlider). Only the pointer that
      // STARTED the gesture is honoured.
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endGesture);
      window.addEventListener("pointercancel", endGesture);
    });

    onBeforeUnmount(() => {
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

      const strip = (
        <div
          ref={stripRef}
          class="hk-range-ribbon-strip"
          data-windowed={win ? "true" : undefined}
          role="slider"
          aria-orientation="horizontal"
          tabindex={props.windowEnabled ? 0 : -1}
          aria-label={t("hikari::ribbon.rangeAria", "Observation range")}
          aria-describedby={hintId}
          aria-disabled={props.windowEnabled ? undefined : "true"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((win ? win[0] : 0) * 100)}
          aria-valuetext={`${Math.round((win ? win[0] : 0) * 100)}% – ${Math.round(
            (win ? win[1] : 1) * 100,
          )}%`}
          title={t(
            "hikari::ribbon.dragHint",
            "Drag to select a range; double-click, Escape or Home resets",
          )}
          onPointerdown={onStripPointerDown}
          onDblclick={(event: MouseEvent) => {
            // Same rule as Escape/Home: only a double-click that actually
            // resets consumes the event.
            if (resetWindow()) event.preventDefault();
          }}
          onKeydown={onStripKeyDown}
        >
          {/* The overview paints the FULL domain only — it never follows
              the zoom, so the window's position stays locatable. */}
          <div class="hk-range-ribbon-overview-lanes" aria-hidden="true">
            {lanes.value.map((lane) => (
              <div class="hk-range-ribbon-overview-row" key={lane.key} data-lane={lane.key}>
                {(byLane.get(lane.key) ?? []).map((placed) => {
                  const box = fullDomainBox(placed);
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
                style={{ left: "0%", width: percent(win[0]) }}
              />
              <div
                class="hk-range-ribbon-scrim"
                data-side="after"
                style={{ left: percent(win[1]), width: percent(1 - win[1]) }}
              />
              <div
                class="hk-range-ribbon-window"
                style={{
                  left: percent(win[0]),
                  width: percent(win[1] - win[0]),
                }}
              />
            </>
          )}
        </div>
      );

      return (
        <div
          class="hk-range-ribbon"
          data-windowed={win ? "true" : undefined}
          data-window-enabled={props.windowEnabled ? "true" : "false"}
          onKeydown={onRootKeyDown}
        >
          {/* The overview is laid out on the SAME label column as the lanes
              (empty gutter first), so x% means the same inline position on
              both surfaces — the strip can be used to locate a bar. */}
          <div class="hk-range-ribbon-overview">
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
                    aria-valuemin={0}
                    aria-valuemax={Math.round((win[1] - minWidth.value) * 100)}
                    aria-valuenow={Math.round(win[0] * 100)}
                    aria-valuetext={`${Math.round(win[0] * 100)}%`}
                    style={{ left: percent(win[0]) }}
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
                    aria-valuemin={Math.round((win[0] + minWidth.value) * 100)}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(win[1] * 100)}
                    aria-valuetext={`${Math.round(win[1] * 100)}%`}
                    style={{ left: percent(win[1]) }}
                    onPointerdown={(event: PointerEvent) => onHandlePointerDown("end", event)}
                    onKeydown={(event: KeyboardEvent) => onHandleKeyDown("end", event)}
                  />
                  <button
                    type="button"
                    class="hk-range-ribbon-reset"
                    aria-label={t("hikari::ribbon.reset", "Reset range")}
                    title={t("hikari::ribbon.reset", "Reset range")}
                    onClick={resetWindow}
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
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
          </div>
          <div class="hk-range-ribbon-lanes">
            {lanes.value.map((lane) => (
              <div class="hk-range-ribbon-lane" key={lane.key} data-lane={lane.key}>
                <span class="hk-range-ribbon-lane-label" title={lane.label}>
                  {lane.label}
                </span>
                <div class="hk-range-ribbon-lane-track" role="group" aria-label={lane.label}>
                  {(byLane.get(lane.key) ?? []).map((placed) => {
                    const box = win ? windowedBox(placed, win) : fullDomainBox(placed);
                    return box ? renderSegment(placed, box) : null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    };
  },
});
