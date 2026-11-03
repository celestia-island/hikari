// Pure trend-chart geometry for HkTrendChart (the HkBarChart/HkDonutChart
// "pure logic module + thin component" pattern).
//
// Faithful TS port of the Rust mirror's pure `trend_geometry`
// (packages/components/src/data/trend_chart.rs): the same named surface, the
// same math, the same contract comments — the mirror's cfg(test) cases are
// ported verbatim in ./trendGeometry.test.ts so both mirrors stay pinned to
// identical numbers. (Rust snake_case -> camelCase per TS convention; the
// shapes and semantics are one-to-one.) That file's header documents the DOM
// contract the render layer mounts and the delta history against the old
// echarts build.
//
// Dependency-free (no Vue, no chart library): everything here is pure and
// unit-testable. `renderTrendChartSvg` is the OFFLINE pre-render entry — its
// string is the finished frame (nothing animates, anywhere), and consumers
// embed it directly (inline or as a data URL; html-to-image and static
// exports just work). Pen labels are not rendered into the markup, so no
// consumer-authored string reaches the SVG and nothing needs escaping.
//
// AI-generated (glm-5.3-flash via DeepSeek Harness), 2026-11-03 — SySL-1.0 §2.3.

/** Vue: `grid: { left: 50, right: 20, top: 30, bottom: 40 }`. */
export const TREND_CHART_GRID_LEFT = 50;
export const TREND_CHART_GRID_RIGHT = 20;
export const TREND_CHART_GRID_TOP = 30;
export const TREND_CHART_GRID_BOTTOM = 40;
/** The mirror's viewBox frame when the CSS height is not a px length. */
export const TREND_CHART_WIDTH = 640;
export const TREND_CHART_HEIGHT = 240;
/** Vue default: five minutes. */
export const TREND_CHART_TIME_WINDOW_MS = 300_000;
/** Vue: `lineStyle: { width: 2 }`. */
export const TREND_CHART_LINE_WIDTH = 2;
/** The translucent fill under a line (see the mirror header's area delta). */
export const TREND_CHART_AREA_OPACITY = 0.12;
/** Vue's `markLine` ink: hh/ll dashed red, h dotted orange, l dotted yellow. */
export const TREND_THRESHOLD_HH_COLOR = "#FF1744";
export const TREND_THRESHOLD_H_COLOR = "#FF6D00";
export const TREND_THRESHOLD_L_COLOR = "#FFD600";
export const TREND_THRESHOLD_LL_COLOR = "#FF1744";
/** SVG dash arrays approximating echarts' `dashed` / `dotted` line styles. */
export const TREND_THRESHOLD_DASHED = "6 4";
export const TREND_THRESHOLD_DOTTED = "1 3";

/** The y axis collapses when every shown value is equal; the range pads by
 * this much on each side so the line lands mid-plot. */
const TREND_FLAT_RANGE_PAD = 1;
const TREND_RANGE_EPSILON = 1e-9;

/** One sample (the old echarts option tree's `[time, value]` entries). */
export interface TrendPoint {
  /** Epoch milliseconds. */
  time: number;
  value: number;
}

/** Per-pen alarm limits. */
export interface AlarmThresholds {
  hh?: number;
  h?: number;
  l?: number;
  ll?: number;
}

/** One labelled series. */
export interface TrendPen {
  label: string;
  /** Samples in ascending time order. */
  data: TrendPoint[];
  thresholds?: AlarmThresholds;
}

/** One projected sample in viewBox units. */
export interface TrendCoord {
  x: number;
  y: number;
}

/** The plot frame and the value/time mapping the paths are built from. */
export interface TrendFrame {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  /** `now - timeWindowMs`. */
  windowStart: number;
  /** `now` (see `trendWindowEnd`). */
  windowEnd: number;
  valueMin: number;
  valueMax: number;
}

/** One pen's projected geometry. */
export interface TrendPenGeometry {
  label: string;
  color: string;
  points: TrendCoord[];
  /** The `points` attribute of the `<polyline>` (`"x,y x,y …"`). */
  line: string;
  /** The area `d` attribute (the line closed down to the baseline). */
  area: string;
}

/** One horizontal alarm guide (one old `markLine` entry). */
export interface TrendThresholdLine {
  value: number;
  y: number;
  color: string;
  dash: string;
}

/** Everything the render layer needs. */
export interface TrendGeometry {
  frame: TrendFrame;
  pens: TrendPenGeometry[];
  thresholds: TrendThresholdLine[];
}

/**
 * Parse the CSS `height` (default `"240px"`) into the viewBox height. Only a
 * px length can be lifted into the viewBox; anything else (rem/%, a bare
 * number, an empty string) keeps `TREND_CHART_HEIGHT`. The decimal grammar
 * is pinned to what Rust's `f64::from_str` accepts over the trimmed px
 * prefix, so both mirrors agree stroke for stroke.
 */
export function trendHeightPx(height: string): number {
  const trimmed = height.trim();
  if (trimmed.endsWith("px")) {
    const number = trimmed.slice(0, -2).trim();
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(number)) {
      const px = Number(number);
      if (px > 0 && Number.isFinite(px)) return px;
    }
  }
  return TREND_CHART_HEIGHT;
}

/**
 * The pen ink ladder: hikari theme tokens, so a scheme flip repaints without
 * a re-render (the old build relied on echarts' own palette). Wraps, so it
 * never runs out.
 */
export function trendPenColor(index: number): string {
  const LADDER = [
    "rgb(var(--color-primary))",
    "rgb(var(--color-success))",
    "rgb(var(--color-warning))",
    "rgb(var(--color-error))",
    "rgb(var(--color-info))",
  ];
  return LADDER[index % LADDER.length];
}

/**
 * Where the rolling window ends. The prop wins (the host's clock);
 * `undefined` freezes the window at the newest sample across every pen, so a
 * bare render still shows the data instead of an empty five-minute window,
 * and `0` when there is no sample at all.
 */
export function trendWindowEnd(pens: readonly TrendPen[], now: number | undefined): number {
  if (now !== undefined) return now;
  let latest = -Infinity;
  for (const pen of pens) {
    for (const point of pen.data) {
      if (point.time > latest) latest = point.time;
    }
  }
  return Number.isFinite(latest) ? latest : 0;
}

/**
 * The `<polyline>` `points` attribute for projected samples
 * (`"x,y x,y …"`). A single sample yields a lone coordinate — a visually
 * empty line, matching the old build's `symbol: "none"`.
 */
export function trendPolyline(points: readonly TrendCoord[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

/**
 * The area `d` attribute: the polyline closed down to `baselineY` and back.
 * Empty for no samples.
 */
export function trendAreaPath(points: readonly TrendCoord[], baselineY: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return "";
  let path = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i += 1) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  path += ` L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
  return path;
}

/**
 * Pens → projected geometry. Pure: same pens + clock + window + frame →
 * the same geometry.
 */
export function trendGeometry(
  pens: readonly TrendPen[],
  now: number | undefined,
  timeWindowMs: number,
  width: number,
  height: number,
  showThresholds: boolean,
): TrendGeometry {
  const windowEnd = trendWindowEnd(pens, now);
  const windowSpan = Math.max(timeWindowMs, 0);
  const windowStart = windowEnd - windowSpan;
  // The old axis: `min = now - timeWindowMs, max = now`. A zero window
  // collapses to an instant; the divisor guard keeps the projection finite.
  const timeDenom = windowSpan > 0 ? windowSpan : 1;

  const plotLeft = TREND_CHART_GRID_LEFT;
  const plotRight = Math.max(width - TREND_CHART_GRID_RIGHT, plotLeft);
  const plotTop = TREND_CHART_GRID_TOP;
  const plotBottom = Math.max(height - TREND_CHART_GRID_BOTTOM, plotTop);
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  // The y range comes from the SHOWN samples only: the old `scale: true`
  // fits the data extent and a threshold value does not extend the axis.
  let valueMin = Infinity;
  let valueMax = -Infinity;
  for (const pen of pens) {
    for (const point of pen.data) {
      if (point.time >= windowStart && point.time <= windowEnd) {
        if (point.value < valueMin) valueMin = point.value;
        if (point.value > valueMax) valueMax = point.value;
      }
    }
  }
  if (!Number.isFinite(valueMin) || !Number.isFinite(valueMax)) {
    valueMin = 0;
    valueMax = 1;
  }
  if (valueMax - valueMin < TREND_RANGE_EPSILON) {
    // A flat (or single-sample) series collapses the axis; pad it so the
    // line lands mid-plot instead of dividing by zero.
    valueMin -= TREND_FLAT_RANGE_PAD;
    valueMax += TREND_FLAT_RANGE_PAD;
  }
  const valueSpan = valueMax - valueMin;

  const xOf = (time: number) => plotLeft + ((time - windowStart) / timeDenom) * plotW;
  const yOf = (value: number) => plotBottom - ((value - valueMin) / valueSpan) * plotH;

  const projected: TrendPenGeometry[] = [];
  for (let index = 0; index < pens.length; index += 1) {
    const pen = pens[index];
    const points: TrendCoord[] = [];
    for (const point of pen.data) {
      if (point.time >= windowStart && point.time <= windowEnd) {
        points.push({ x: xOf(point.time), y: yOf(point.value) });
      }
    }
    projected.push({
      label: pen.label,
      color: trendPenColor(index),
      line: trendPolyline(points),
      area: trendAreaPath(points, plotBottom),
      points,
    });
  }

  const thresholds: TrendThresholdLine[] = [];
  if (showThresholds) {
    for (const pen of pens) {
      const limits = pen.thresholds;
      if (!limits) continue;
      // One guide per PRESENT limit, in this order.
      const ORDER = [
        [limits.hh, TREND_THRESHOLD_HH_COLOR, TREND_THRESHOLD_DASHED],
        [limits.h, TREND_THRESHOLD_H_COLOR, TREND_THRESHOLD_DOTTED],
        [limits.l, TREND_THRESHOLD_L_COLOR, TREND_THRESHOLD_DOTTED],
        [limits.ll, TREND_THRESHOLD_LL_COLOR, TREND_THRESHOLD_DASHED],
      ] as const;
      for (const [value, color, dash] of ORDER) {
        if (value === undefined) continue;
        // The old renderer clipped a guide outside the axis range.
        if (value < valueMin || value > valueMax) continue;
        thresholds.push({ value, y: yOf(value), color, dash });
      }
    }
  }

  return {
    frame: {
      width,
      height,
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      windowStart,
      windowEnd,
      valueMin,
      valueMax,
    },
    pens: projected,
    thresholds,
  };
}

/**
 * The chart SVG markup: threshold guides first, then each pen's area + line.
 * Byte-for-byte the Rust mirror's `trend_chart_svg` (private there; the
 * public offline entry below wraps it).
 */
function trendChartSvg(geometry: TrendGeometry): string {
  const frame = geometry.frame;
  let svg = `<svg class="hk-trend-chart__svg" viewBox="0 0 ${frame.width} ${frame.height}" preserveAspectRatio="none" style="display:block;width:100%;height:100%">`;
  for (const threshold of geometry.thresholds) {
    svg += `<line class="hk-trend-chart__threshold" x1="${frame.plotLeft}" y1="${threshold.y}" x2="${frame.plotRight}" y2="${threshold.y}" stroke="${threshold.color}" stroke-width="1" stroke-dasharray="${threshold.dash}"/>`;
  }
  for (const pen of geometry.pens) {
    if (pen.area !== "") {
      svg += `<path class="hk-trend-chart__area" d="${pen.area}" fill="${pen.color}" fill-opacity="${TREND_CHART_AREA_OPACITY}" stroke="none"/>`;
    }
    if (pen.line !== "") {
      svg += `<polyline class="hk-trend-chart__line" points="${pen.line}" fill="none" stroke="${pen.color}" stroke-width="${TREND_CHART_LINE_WIDTH}" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
  }
  svg += "</svg>";
  return svg;
}

/** Options for the offline pre-render helper. All optional. */
export interface RenderTrendChartOptions {
  /** The window's "now" in epoch ms; default: frozen at the newest sample. */
  now?: number;
  /** Rolling window length in ms; default 300_000 (five minutes). */
  timeWindowMs?: number;
  /** The viewBox width; default 640 (the mirror's frame). */
  width?: number;
  /** The CSS height whose px value lifts into the viewBox (a bare number is
   * a px length); default "240px". Non-px lengths keep the default frame. */
  height?: number | string;
  /** Draw the alarm threshold guides; default true. */
  showThresholds?: boolean;
}

/**
 * Offline pre-render: pens → the finished SVG markup string. Consumers embed
 * it directly (inline in HTML or as a data URL) — no Vue, no chart library,
 * no animation: the string IS the finished frame. The component renders this
 * exact markup, so a mounted chart and its static export never disagree.
 * Pure: same pens + options → the same string.
 */
export function renderTrendChartSvg(
  pens: readonly TrendPen[],
  options: RenderTrendChartOptions = {},
): string {
  const height =
    typeof options.height === "number"
      ? options.height > 0 && Number.isFinite(options.height)
        ? options.height
        : TREND_CHART_HEIGHT
      : trendHeightPx(options.height ?? "240px");
  const geometry = trendGeometry(
    pens,
    options.now,
    options.timeWindowMs ?? TREND_CHART_TIME_WINDOW_MS,
    options.width ?? TREND_CHART_WIDTH,
    height,
    options.showThresholds ?? true,
  );
  return trendChartSvg(geometry);
}
