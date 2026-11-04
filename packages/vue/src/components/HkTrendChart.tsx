import { computed, defineComponent, type PropType } from "vue";

import {
  renderTrendChartSvg,
  trendHeightPx,
  type AlarmThresholds,
  type TrendGuide,
  type TrendPen,
  type TrendPoint,
  type TrendYDomain,
} from "./trendGeometry";

// The pen/threshold data types live in the pure geometry module (the Rust
// mirror's trend_chart.rs surface) and re-export here so direct-file
// importers keep their established paths. TrendGuide / TrendYDomain are the
// wowsp-migration extensions (documented in ./trendGeometry).
export type { AlarmThresholds, TrendGuide, TrendPen, TrendPoint, TrendYDomain };

/**
 * HkTrendChart — labelled time-series ("pens") drawn over a rolling time
 * window, with optional alarm threshold guides (hh/h/l/ll per pen). Pure
 * plumbing — no domain logic, so any consumer can feed it metrics,
 * telemetry or analytics series.
 *
 * Dependency-free (the HkBarChart / HkDonutChart line): the chart is a
 * hand-drawn declarative SVG subtree produced by ./trendGeometry — the
 * faithful TS port of the Rust mirror's pure `trend_geometry` — mounted on
 * its own `display:contents` host exactly as that mirror documents
 * (packages/components/src/data/trend_chart.rs's DOM contract):
 *
 *   div.hk-trend-chart  style="width:100%;height:{height}"
 *     div[style="display:contents"]
 *       svg.hk-trend-chart__svg  viewBox + preserveAspectRatio="none"
 *         line.hk-trend-chart__guide       (optional chart-level guides)
 *         line.hk-trend-chart__threshold   (one per present limit)
 *         text.hk-trend-chart__y-tick / __x-tick  (optional axis text)
 *         path.hk-trend-chart__area        (one per pen)
 *         polyline.hk-trend-chart__line    (one per pen)
 *         circle.hk-trend-chart__dot       (optional, per inked sample)
 *         text.hk-trend-chart__guide-label (optional tier names, on top)
 *
 * The `hk-trend-chart*` classes are INERT hooks (no sheet defines them);
 * the component ships NO stylesheet and no canvas. Pen ink rides the theme
 * tokens (`rgb(var(--color-primary))` …), so a scheme flip repaints without
 * a re-render, and threshold guides keep the old markLine colors and dash
 * flavors.
 *
 * WOWSP-MIGRATION EXTRAS (all optional, all defaulting to today's frame):
 * chart-level named `guides` (dashed tier lines with left-edge tier labels
 * and hints), per-sample dot ink (`TrendPoint.fill`/`hint`), y-axis
 * numbers (`yAxisFormat` plus the `yAxisClearancePx` collision rule),
 * baseline x ticks (`xTickCount` + `xTickFormat`), a stepped `yDomain`,
 * and a `preserveAspectRatio` override. The exact rules live in
 * ./trendGeometry; with the extras absent the markup is byte-identical to
 * the mirror's.
 *
 * OFFLINE PRE-RENDER SEMANTICS: no animation exists at all — the first
 * render IS the finished frame. Streaming updates re-render the same
 * geometry synchronously when `pens` is reactive state. The identical
 * markup is available as a pure string via `renderTrendChartSvg(pens,
 * opts)` for hosts that embed static exports (inline or as a data URL)
 * without mounting Vue at all.
 *
 * Sizing: the root box is `width:100%` tall `height` (a CSS length,
 * default "240px"); its px value lifts into the viewBox (non-px lengths
 * keep the 640×240 mirror frame) and `preserveAspectRatio="none"`
 * stretches the plot to the box, so container resizes need no listeners.
 *
 * AI-generated (glm-5.3-flash via DeepSeek Harness), 2026-11-03 — SySL-1.0 §2.3.
 */
export default defineComponent({
  name: "HkTrendChart",
  props: {
    /** The labelled series, in ascending time order (default []). */
    pens: { type: Array as PropType<TrendPen[]>, default: () => [] },
    /** The root box's CSS height (default "240px"); its px value sizes the viewBox. */
    height: { type: String, default: "240px" },
    /** Draw the alarm threshold guides (default true). */
    showThresholds: { type: Boolean, default: true },
    /** Rolling window length in ms (default 300_000 — five minutes). */
    timeWindowMs: { type: Number, default: 300_000 },
    /** The window's "now" in epoch ms. Absent: the window freezes at the
     * newest sample across pens, so a render is deterministic (the old
     * echarts build read Date.now() on every tick). */
    now: { type: Number, default: undefined },
    /** The viewBox width (default 640 — the mirror's frame). */
    width: { type: Number, default: 640 },
    /** Chart-level horizontal guides rendered with the alarms — the named
     * tier lines. Default: none. */
    guides: { type: Array as PropType<TrendGuide[]>, default: undefined },
    /** Formats the y-axis gridline numbers (floor/mid/ceiling of the shown
     * domain); absent → no y-axis text. */
    yAxisFormat: { type: Function as PropType<(value: number) => string>, default: undefined },
    /** A mid/ceiling number whose gridline sits within this many viewBox px
     * of a guide's line is dropped (the floor number always renders).
     * Default 0 — nothing is dropped. */
    yAxisClearancePx: { type: Number, default: 0 },
    /** Baseline tick count, clamped to the shown sample count; needs
     * `xTickFormat`. Default: no x ticks. */
    xTickCount: { type: Number, default: undefined },
    /** Formats each tick's epoch ms; needs `xTickCount`. */
    xTickFormat: { type: Function as PropType<(timeMs: number) => string>, default: undefined },
    /** The stepped y extent rule; absent → the raw extent (flat-pad ±1). */
    yDomain: { type: Object as PropType<TrendYDomain>, default: undefined },
    /** The SVG fit (default "none" — stretch to the box, the mirror's
     * rule; "xMidYMid meet" keeps the frame's aspect). */
    preserveAspectRatio: {
      type: String as PropType<"none" | "xMidYMid meet">,
      default: "none",
    },
  },
  setup(props) {
    const svg = computed(() =>
      renderTrendChartSvg(props.pens, {
        now: props.now,
        timeWindowMs: props.timeWindowMs,
        width: props.width,
        height: props.height,
        showThresholds: props.showThresholds,
        guides: props.guides,
        yAxisFormat: props.yAxisFormat,
        yAxisClearancePx: props.yAxisClearancePx,
        xTickCount: props.xTickCount,
        xTickFormat: props.xTickFormat,
        yDomain: props.yDomain,
        preserveAspectRatio: props.preserveAspectRatio,
      }),
    );
    // An empty height keeps the viewBox-derived px (the mirror's rule).
    const heightCss = computed(() =>
      props.height.trim() === "" ? `${trendHeightPx(props.height)}px` : props.height,
    );
    return () => (
      <div class="hk-trend-chart" style={`width:100%;height:${heightCss.value}`}>
        <div style="display:contents" innerHTML={svg.value} />
      </div>
    );
  },
});
