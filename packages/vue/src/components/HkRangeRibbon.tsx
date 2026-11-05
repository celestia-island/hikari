import { RotateCcw } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
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
 * domain stays visible.
 *
 * Editing: drag on the strip to brush a new window, drag either edge handle
 * to resize it, and reset (button / double-click / Escape / Home) back to
 * the full domain. The strip is focusable: arrows slide the window,
 * Shift+arrows resize it. Handle sliders nudge their own edge. Hovering or
 * focusing a segment floats its tip card (tip.title + tip.lines).
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

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Inline left/width pair — percentages are deterministic in tests and do
 *  not depend on layout measurement for rendering. */
function percent(fraction: number): string {
  return `${Number((fraction * 100).toFixed(4))}%`;
}

/** Normalize a host window: swap inverted ranges, clamp to the domain,
 *  ignore non-finite input (NaN means "no window"), and never return a
 *  window narrower than `minWidth`. */
function normalizeWindow(input: unknown, minWidth: number): WindowRange | null {
  if (input == null || !Array.isArray(input) || input.length < 2) return null;
  const first = Number(input[0]);
  const second = Number(input[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  const min = Math.min(Math.max(minWidth, 0), 1);
  let lo = clamp01(Math.min(first, second));
  let hi = clamp01(Math.max(first, second));
  if (hi - lo < min) {
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

interface PlacedSegment {
  segment: RibbonSegment;
  start: number;
  end: number;
}

/** A type alias (not an interface) so Vue's `CSSProperties` index
 *  signature accepts it as a StyleValue. */
type SegmentBox = {
  left: string;
  width: string;
};

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

function fullDomainBox(placed: PlacedSegment): SegmentBox {
  return {
    left: percent(placed.start),
    width: percent(placed.end - placed.start),
  };
}

/** The ONLY place clipping happens: with a window, a segment is clipped to
 *  the window and re-normalized against it. Segments (and zero-length
 *  points) wholly outside the window return null and render nowhere in the
 *  lanes. */
function windowedBox(placed: PlacedSegment, win: WindowRange): SegmentBox | null {
  const [lo, hi] = win;
  if (placed.end <= lo || placed.start >= hi) return null;
  const span = hi - lo;
  const start = Math.max(placed.start, lo);
  const end = Math.min(placed.end, hi);
  return {
    left: percent((start - lo) / span),
    width: percent((end - start) / span),
  };
}

type Gesture =
  | { kind: "brush"; anchor: number; moved: boolean }
  | { kind: "edge"; edge: "start" | "end" };

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

    /** Emit the window in FULL-DOMAIN fractions; the uncontrolled fallback
     *  mirrors it into local state so the ribbon still zooms without a host
     *  listener. Controlled hosts own the prop and are never overwritten. */
    function commitWindow(next: WindowRange | null): void {
      if (!props.windowEnabled) return;
      if (!controlled.value) internalWindow.value = next;
      emit("windowChange", next);
    }

    function resetWindow(): void {
      commitWindow(null);
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
      gesture.moved = true;
      commitWindow([lo, hi]);
    }

    /** Move ONE edge of the current window to `fraction` (absolute domain
     *  fraction), clamped so the window never crosses itself and never
     *  drops below minWindow. */
    function dragEdge(edge: "start" | "end", fraction: number): void {
      const win = activeWindow.value;
      if (!win) return;
      const min = minWidth.value;
      const [lo, hi] = win;
      if (edge === "start") {
        commitWindow([Math.max(0, Math.min(fraction, hi - min)), hi]);
      } else {
        commitWindow([lo, Math.min(1, Math.max(fraction, lo + min))]);
      }
    }

    function onStripPointerDown(event: PointerEvent): void {
      if (!props.windowEnabled) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const fraction = fractionFrom(event.clientX);
      if (fraction === null) return;
      gesture = { kind: "brush", anchor: fraction, moved: false };
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }

    function onHandlePointerDown(edge: "start" | "end", event: PointerEvent): void {
      if (!props.windowEnabled) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!activeWindow.value) return;
      // The handle sits over the strip: never start a brush underneath it.
      event.stopPropagation();
      gesture = { kind: "edge", edge };
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }

    function onPointerMove(event: PointerEvent): void {
      if (!gesture) return;
      const fraction = fractionFrom(event.clientX);
      if (fraction === null) return;
      if (gesture.kind === "brush") brushTo(fraction);
      else dragEdge(gesture.edge, fraction);
    }

    function endGesture(): void {
      gesture = null;
    }

    /** Arrow = slide the whole window; Shift+Arrow = resize from the
     *  trailing (end) edge. A plain arrow with no window is inert, so the
     *  full-domain view cannot be nudged into a meaningless window; a
     *  Shift+Arrow contracts the full domain into one (keyboard entry). */
    function onStripKeyDown(event: KeyboardEvent): void {
      if (!props.windowEnabled) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const win = activeWindow.value;
      const min = minWidth.value;
      if (!event.shiftKey) {
        if (!win) return;
        const width = win[1] - win[0];
        const nextLo = Math.min(Math.max(win[0] + direction * KEYBOARD_STEP, 0), 1 - width);
        commitWindow([nextLo, nextLo + width]);
        return;
      }
      if (!win) {
        if (direction > 0) return; // full domain cannot grow further
        const end = Math.max(min, 1 - KEYBOARD_STEP);
        if (end < 1) commitWindow([0, end]);
        return;
      }
      const nextEnd = Math.min(1, Math.max(win[0] + min, win[1] + direction * KEYBOARD_STEP));
      commitWindow([win[0], nextEnd]);
    }

    /** Handle sliders keep their own edge keyboard-editable. */
    function onHandleKeyDown(edge: "start" | "end", event: KeyboardEvent): void {
      if (!props.windowEnabled) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const win = activeWindow.value;
      if (!win) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const current = edge === "start" ? win[0] : win[1];
      dragEdge(edge, current + direction * KEYBOARD_STEP);
    }

    function onRootKeyDown(event: KeyboardEvent): void {
      if (!props.windowEnabled) return;
      if (event.key !== "Escape" && event.key !== "Home") return;
      event.preventDefault();
      resetWindow();
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
      // tracking (same primitive as HkMediaSlider).
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
          style={box}
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
            <span class="hk-range-ribbon-tip" role="tooltip">
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

      return (
        <div
          class="hk-range-ribbon"
          data-windowed={win ? "true" : undefined}
          data-window-enabled={props.windowEnabled ? "true" : "false"}
          onKeydown={onRootKeyDown}
        >
          <div class="hk-range-ribbon-overview">
            <div
              ref={stripRef}
              class="hk-range-ribbon-strip"
              data-windowed={win ? "true" : undefined}
              role="slider"
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
                event.preventDefault();
                resetWindow();
              }}
              onKeydown={onStripKeyDown}
            >
              {/* The overview paints the FULL domain only — it never follows
                  the zoom, so the window's position stays locatable. */}
              <div class="hk-range-ribbon-overview-lanes" aria-hidden="true">
                {lanes.value.map((lane) => (
                  <div class="hk-range-ribbon-overview-row" key={lane.key} data-lane={lane.key}>
                    {(byLane.get(lane.key) ?? []).map((placed) => (
                      <div
                        key={placed.segment.id}
                        class="hk-range-ribbon-overview-segment"
                        data-segment-id={placed.segment.id}
                        data-tone={placed.segment.tone}
                        data-status={placed.segment.status}
                        style={fullDomainBox(placed)}
                      />
                    ))}
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
            {win && (
              <>
                <div
                  class="hk-range-ribbon-handle"
                  data-edge="start"
                  role="slider"
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
