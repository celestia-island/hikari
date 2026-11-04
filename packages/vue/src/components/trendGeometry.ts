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
// WOWSP-MIGRATION SUPERSET: HkTrendChart grew optional capabilities for
// wowsp's PrTrendChart — chart-level named guides, per-sample dot ink,
// y-axis numbers with a clearance rule, baseline x ticks, a stepped yDomain
// and a preserveAspectRatio override. Every extension is optional and absent
// means the mirror's exact math and markup (the ported cfg(test) cases stay
// verbatim); the extra types live TS-side until the mirror grows them.
//
// Dependency-free (no Vue, no chart library): everything here is pure and
// unit-testable. `renderTrendChartSvg` is the OFFLINE pre-render entry — its
// string is the finished frame (nothing animates, anywhere), and consumers
// embed it directly (inline or as a data URL; html-to-image and static
// exports just work). Pen labels are still not rendered into the markup; the
// superset's consumer strings (guide labels/hints, dot ink, formatted axis
// text) go through `escapeSvgText` before they enter the SVG.
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

/** Chart-level guide defaults: a quiet `currentColor` line (consumers name
 * tier colors) with the alarm `dashed` flavor. */
export const TREND_GUIDE_DEFAULT_COLOR = "currentColor";
export const TREND_GUIDE_DEFAULT_DASH = TREND_THRESHOLD_DASHED;
export const TREND_GUIDE_DEFAULT_OPACITY = 0.35;
/** A named guide's label sits inside the plot near the left edge, a step
 * above its line (viewBox px). */
export const TREND_GUIDE_LABEL_INSET = 6;
export const TREND_GUIDE_LABEL_LIFT = 4;
/** Axis text: one small size; y numbers sit in the left grid gutter, x ticks
 * drop under the baseline (viewBox px). */
export const TREND_CHART_AXIS_FONT_SIZE = 10;
export const TREND_Y_TICK_INSET = 6;
export const TREND_Y_TICK_BASELINE_SHIFT = 3;
export const TREND_X_TICK_DROP = 14;
/** Per-sample dot radius (viewBox px). */
export const TREND_CHART_DOT_RADIUS = 3.5;

/** The y axis collapses when every shown value is equal; the range pads by
 * this much on each side so the line lands mid-plot. */
const TREND_FLAT_RANGE_PAD = 1;
const TREND_RANGE_EPSILON = 1e-9;

/** One sample (the old echarts option tree's `[time, value]` entries). The
 * wowsp migration adds per-sample dot ink: a sample that names `fill`
 * renders a dot at its coordinate, optionally carrying a `hint`. */
export interface TrendPoint {
  /** Epoch milliseconds. */
  time: number;
  value: number;
  /** Dot ink; a dot is drawn at the sample only when present. */
  fill?: string;
  /** The dot's data-hint payload; rendered only alongside `fill`. */
  hint?: string;
}

/** Per-pen alarm limits. */
export interface AlarmThresholds {
  hh?: number;
  h?: number;
  l?: number;
  ll?: number;
}

/** One chart-level horizontal guide (the wowsp tier chart's named tier
 * lines). Clipped to the shown y range like the alarm thresholds. */
export interface TrendGuide {
  /** The value the line sits at. */
  value: number;
  /** Tier name rendered as text inside the plot near the left edge. */
  label?: string;
  /** Line/label ink; default a quiet `currentColor`. */
  color?: string;
  /** Dash array; default `"6 4"` (the alarm `dashed` flavor). */
  dash?: string;
  /** The line's data-hint payload. */
  hint?: string;
}

/** The stepped y extent rule (absent → the raw extent with the flat pad).
 * The span widens to `minSpan`, is padded UP to the next `padToMultiple`,
 * and `floorAtZero` anchors the floor at 0 when the shown extent is
 * non-negative (re-padding the elevated ceiling so the top lands on a step
 * and no shown sample escapes the domain). */
export interface TrendYDomain {
  /** Pad the extent's span UP to the next multiple of this. */
  padToMultiple?: number;
  /** Never show a span narrower than this (value units). */
  minSpan?: number;
  /** Anchor the floor at 0 when the shown extent is non-negative. */
  floorAtZero?: boolean;
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

/** One projected per-sample dot. */
export interface TrendDot {
  x: number;
  y: number;
  fill: string;
  hint?: string;
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
  /** Per-sample dots in draw order (the samples naming `fill`). */
  dots: TrendDot[];
}

/** One horizontal alarm guide (one old `markLine` entry). */
export interface TrendThresholdLine {
  value: number;
  y: number;
  color: string;
  dash: string;
}

/** One projected chart-level guide. */
export interface TrendGuideLine {
  value: number;
  y: number;
  /** Resolved ink (`TREND_GUIDE_DEFAULT_COLOR` when unnamed). */
  color: string;
  dash: string;
  /** `stroke-opacity`; set only for the default color's quiet line. */
  opacity?: number;
  hint?: string;
  label?: string;
  labelX: number;
  labelY: number;
}

/** One y-axis gridline number (floor/mid/ceiling of the shown domain). */
export interface TrendYTick {
  value: number;
  /** The text's baseline y (the gridline y shifted for optical centering). */
  y: number;
  text: string;
}

/** One baseline x tick. */
export interface TrendXTick {
  /** The tick's time (interpolated across the shown data's time span). */
  time: number;
  x: number;
  y: number;
  text: string;
}

/** Everything the render layer needs. */
export interface TrendGeometry {
  frame: TrendFrame;
  pens: TrendPenGeometry[];
  thresholds: TrendThresholdLine[];
  /** Chart-level named guides (empty without the `guides` extra). */
  guides: TrendGuideLine[];
  /** Gridline numbers (empty without `yAxisFormat`). */
  yTicks: TrendYTick[];
  /** Baseline ticks (empty without `xTickCount` + `xTickFormat`). */
  xTicks: TrendXTick[];
}

/** The wowsp-migration extensions, passed to `trendGeometry` after the
 * mirror's six pinned arguments. Every field is optional; absent means the
 * mirror's exact behavior. */
export interface TrendGeometryExtras {
  guides?: readonly TrendGuide[];
  yDomain?: TrendYDomain;
  yAxisFormat?: (value: number) => string;
  yAxisClearancePx?: number;
  xTickCount?: number;
  xTickFormat?: (timeMs: number) => string;
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

/** The next multiple of `step` at or above `span` (a zero span pads up to
 * one step; sub-epsilon float noise does not trigger an extra step). */
function padUpToMultiple(span: number, step: number): number {
  const stepped = Math.ceil((span - TREND_RANGE_EPSILON) / step) * step;
  return stepped > 0 ? stepped : step;
}

/** A usable `padToMultiple`: finite and positive. */
function isUsableStep(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

/**
 * The `yDomain` extent rule (the wowsp tier chart's stepped axis): the raw
 * span widens to `minSpan`, is padded UP to the next `padToMultiple`, and
 * `floorAtZero` anchors the floor at 0 when the shown extent is
 * non-negative — re-padding the elevated ceiling so the top lands on a step
 * and no shown sample escapes the domain. Negative extents keep their floor
 * (zero-anchoring would hide the data) and only widen by the span.
 */
function applyTrendYDomain(
  rawMin: number,
  rawMax: number,
  domain: TrendYDomain,
): { min: number; max: number } {
  const rawSpan = rawMax - rawMin;
  const minSpan = domain.minSpan;
  let span =
    minSpan !== undefined && Number.isFinite(minSpan) && minSpan >= 0
      ? Math.max(rawSpan, minSpan)
      : rawSpan;
  if (isUsableStep(domain.padToMultiple)) span = padUpToMultiple(span, domain.padToMultiple);
  if (domain.floorAtZero === true && rawMin >= 0) {
    const ceiling = isUsableStep(domain.padToMultiple)
      ? padUpToMultiple(rawMax, domain.padToMultiple)
      : Math.max(rawMax, rawMin + span);
    return { min: 0, max: ceiling };
  }
  return { min: rawMin, max: rawMin + span };
}

/**
 * XML-escape a consumer-authored string before it enters the SVG markup
 * (guide labels/hints, dot ink, formatted axis text). Attribute values and
 * text content share one escape — the extra entities are valid in both
 * positions, so there is no second code path to forget.
 */
function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Pens → projected geometry. Pure: same pens + clock + window + frame +
 * extras → the same geometry. The first six arguments are the mirror's
 * pinned surface; `extras` carries the wowsp-migration extensions and
 * defaults to the mirror's exact behavior.
 */
export function trendGeometry(
  pens: readonly TrendPen[],
  now: number | undefined,
  timeWindowMs: number,
  width: number,
  height: number,
  showThresholds: boolean,
  extras: TrendGeometryExtras = {},
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
  const shownTimes: number[] = [];
  for (const pen of pens) {
    for (const point of pen.data) {
      if (point.time >= windowStart && point.time <= windowEnd) {
        shownTimes.push(point.time);
        if (point.value < valueMin) valueMin = point.value;
        if (point.value > valueMax) valueMax = point.value;
      }
    }
  }
  if (!Number.isFinite(valueMin) || !Number.isFinite(valueMax)) {
    valueMin = 0;
    valueMax = 1;
  }
  // The stepped-domain extra (absent → the raw extent below, the mirror's
  // rule). The trailing flat-pad still catches a degenerate result.
  if (extras.yDomain !== undefined) {
    const stepped = applyTrendYDomain(valueMin, valueMax, extras.yDomain);
    valueMin = stepped.min;
    valueMax = stepped.max;
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
    const dots: TrendDot[] = [];
    for (const point of pen.data) {
      if (point.time >= windowStart && point.time <= windowEnd) {
        const coord = { x: xOf(point.time), y: yOf(point.value) };
        points.push(coord);
        // A sample carries a dot only when it names its own ink.
        if (point.fill !== undefined) {
          dots.push({ x: coord.x, y: coord.y, fill: point.fill, hint: point.hint });
        }
      }
    }
    projected.push({
      label: pen.label,
      color: trendPenColor(index),
      line: trendPolyline(points),
      area: trendAreaPath(points, plotBottom),
      points,
      dots,
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

  const guides: TrendGuideLine[] = [];
  for (const guide of extras.guides ?? []) {
    // The alarm guides clip outside the axis range; the named guides — and
    // their labels with them — clip the same way.
    if (guide.value < valueMin || guide.value > valueMax) continue;
    const y = yOf(guide.value);
    guides.push({
      value: guide.value,
      y,
      color: guide.color ?? TREND_GUIDE_DEFAULT_COLOR,
      dash: guide.dash ?? TREND_GUIDE_DEFAULT_DASH,
      // The default ink stays quiet; a named color draws at full strength.
      opacity: guide.color === undefined ? TREND_GUIDE_DEFAULT_OPACITY : undefined,
      hint: guide.hint,
      label: guide.label,
      labelX: plotLeft + TREND_GUIDE_LABEL_INSET,
      labelY: y - TREND_GUIDE_LABEL_LIFT,
    });
  }

  const yTicks: TrendYTick[] = [];
  if (extras.yAxisFormat !== undefined) {
    // Gridline numbers: floor / mid / ceiling of the shown domain. A
    // mid/ceiling number whose gridline sits within `yAxisClearancePx` of a
    // rendered guide's line is dropped (the floor number always renders);
    // viewBox px, like the clearance prop says.
    const guideYs = guides.map((guide) => guide.y);
    const clearance = extras.yAxisClearancePx ?? 0;
    const collides = (y: number): boolean =>
      clearance > 0 && guideYs.some((guideY) => Math.abs(guideY - y) <= clearance);
    const mid = valueMin + valueSpan / 2;
    yTicks.push({
      value: valueMin,
      y: yOf(valueMin) + TREND_Y_TICK_BASELINE_SHIFT,
      text: extras.yAxisFormat(valueMin),
    });
    const midY = yOf(mid);
    if (!collides(midY)) {
      yTicks.push({ value: mid, y: midY + TREND_Y_TICK_BASELINE_SHIFT, text: extras.yAxisFormat(mid) });
    }
    const ceilingY = yOf(valueMax);
    if (!collides(ceilingY)) {
      yTicks.push({
        value: valueMax,
        y: ceilingY + TREND_Y_TICK_BASELINE_SHIFT,
        text: extras.yAxisFormat(valueMax),
      });
    }
  }

  const xTicks: TrendXTick[] = [];
  if (extras.xTickFormat !== undefined && extras.xTickCount !== undefined) {
    // Evenly spaced ticks across the SHOWN data's time span; the count
    // clamps to the sample count (a lone tick sits at the span's start).
    const count = Math.min(Math.max(0, Math.floor(extras.xTickCount)), shownTimes.length);
    let timeMin = Infinity;
    let timeMax = -Infinity;
    for (const time of shownTimes) {
      if (time < timeMin) timeMin = time;
      if (time > timeMax) timeMax = time;
    }
    if (count >= 1 && Number.isFinite(timeMin)) {
      for (let index = 0; index < count; index += 1) {
        const time =
          count === 1 ? timeMin : timeMin + ((timeMax - timeMin) * index) / (count - 1);
        xTicks.push({
          time,
          x: xOf(time),
          y: plotBottom + TREND_X_TICK_DROP,
          text: extras.xTickFormat(time),
        });
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
    guides,
    yTicks,
    xTicks,
  };
}

/**
 * The chart SVG markup: named guides, then the threshold guides, then the
 * axis text, then each pen's area + line + dots, and the named guides'
 * labels on top. With every wowsp extension absent this is byte-for-byte the
 * Rust mirror's `trend_chart_svg` (private there; the public offline entry
 * below wraps it).
 */
function trendChartSvg(geometry: TrendGeometry, preserveAspectRatio: string): string {
  const frame = geometry.frame;
  let svg = `<svg class="hk-trend-chart__svg" viewBox="0 0 ${frame.width} ${frame.height}" preserveAspectRatio="${preserveAspectRatio}" style="display:block;width:100%;height:100%">`;
  for (const guide of geometry.guides) {
    svg += `<line class="hk-trend-chart__guide" x1="${frame.plotLeft}" y1="${guide.y}" x2="${frame.plotRight}" y2="${guide.y}" stroke="${escapeSvgText(guide.color)}"${guide.opacity !== undefined ? ` stroke-opacity="${guide.opacity}"` : ""} stroke-width="1" stroke-dasharray="${escapeSvgText(guide.dash)}"${guide.hint !== undefined ? ` data-hint="${escapeSvgText(guide.hint)}"` : ""}/>`;
  }
  for (const threshold of geometry.thresholds) {
    svg += `<line class="hk-trend-chart__threshold" x1="${frame.plotLeft}" y1="${threshold.y}" x2="${frame.plotRight}" y2="${threshold.y}" stroke="${threshold.color}" stroke-width="1" stroke-dasharray="${threshold.dash}"/>`;
  }
  for (const tick of geometry.yTicks) {
    svg += `<text class="hk-trend-chart__y-tick" x="${frame.plotLeft - TREND_Y_TICK_INSET}" y="${tick.y}" fill="currentColor" font-size="${TREND_CHART_AXIS_FONT_SIZE}" text-anchor="end">${escapeSvgText(tick.text)}</text>`;
  }
  for (const tick of geometry.xTicks) {
    svg += `<text class="hk-trend-chart__x-tick" x="${tick.x}" y="${tick.y}" fill="currentColor" font-size="${TREND_CHART_AXIS_FONT_SIZE}" text-anchor="middle">${escapeSvgText(tick.text)}</text>`;
  }
  for (const pen of geometry.pens) {
    if (pen.area !== "") {
      svg += `<path class="hk-trend-chart__area" d="${pen.area}" fill="${pen.color}" fill-opacity="${TREND_CHART_AREA_OPACITY}" stroke="none"/>`;
    }
    if (pen.line !== "") {
      svg += `<polyline class="hk-trend-chart__line" points="${pen.line}" fill="none" stroke="${pen.color}" stroke-width="${TREND_CHART_LINE_WIDTH}" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    for (const dot of pen.dots) {
      svg += `<circle class="hk-trend-chart__dot" cx="${dot.x}" cy="${dot.y}" r="${TREND_CHART_DOT_RADIUS}" fill="${escapeSvgText(dot.fill)}"${dot.hint !== undefined ? ` data-hint="${escapeSvgText(dot.hint)}"` : ""}/>`;
    }
  }
  for (const guide of geometry.guides) {
    if (guide.label !== undefined) {
      svg += `<text class="hk-trend-chart__guide-label" x="${guide.labelX}" y="${guide.labelY}" fill="${escapeSvgText(guide.color)}" font-size="${TREND_CHART_AXIS_FONT_SIZE}" text-anchor="start">${escapeSvgText(guide.label)}</text>`;
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
  /** Chart-level horizontal guides (the named tier lines); default none. */
  guides?: readonly TrendGuide[];
  /** Formats the y-axis gridline numbers (floor/mid/ceiling of the shown
   * domain); absent → no y-axis text. */
  yAxisFormat?: (value: number) => string;
  /** A mid/ceiling number whose gridline sits within this many viewBox px
   * of a guide's line is dropped; default 0 (nothing dropped). */
  yAxisClearancePx?: number;
  /** Baseline tick count, clamped to the shown sample count; needs
   * `xTickFormat`. Default: no x ticks. */
  xTickCount?: number;
  /** Formats each tick's epoch ms; needs `xTickCount`. */
  xTickFormat?: (timeMs: number) => string;
  /** The stepped y extent rule; absent → the raw extent flat-pad. */
  yDomain?: TrendYDomain;
  /** The SVG fit; default "none" (the mirror's stretch-to-box). */
  preserveAspectRatio?: "none" | "xMidYMid meet";
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
    {
      guides: options.guides,
      yDomain: options.yDomain,
      yAxisFormat: options.yAxisFormat,
      yAxisClearancePx: options.yAxisClearancePx,
      xTickCount: options.xTickCount,
      xTickFormat: options.xTickFormat,
    },
  );
  return trendChartSvg(geometry, options.preserveAspectRatio ?? "none");
}
