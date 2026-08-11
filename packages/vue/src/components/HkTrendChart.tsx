import { defineComponent, onMounted, onUnmounted, ref, watch, type PropType } from "vue";

// echarts is loaded lazily (dynamic import in onMounted) so a consumer that
// merely imports this component — or anything else from the hikari package —
// never pays for echarts in the initial bundle. The static import graph
// previously dragged the whole echarts module tree into the shared chunk,
// which every entry page (e.g. the login screen) had to download and parse.
import type { ECharts } from "echarts/core";

export interface TrendPoint {
  time: number;
  value: number;
}

export interface AlarmThresholds {
  hh?: number;
  h?: number;
  l?: number;
  ll?: number;
}

export interface TrendPen {
  label: string;
  data: TrendPoint[];
  thresholds?: AlarmThresholds;
}

/**
 * Streaming line-chart wrapper around echarts. Takes any number of
 * "pens" (labelled time-series) and renders them against a rolling
 * time window, with optional alarm threshold lines (hh/h/l/ll) per pen.
 * Pure echarts plumbing — no domain logic, so any consumer can feed it
 * metrics, telemetry or analytics series.
 */
export default defineComponent({
  name: "HkTrendChart",
  props: {
    pens: { type: Array as PropType<TrendPen[]>, default: () => [] },
    height: { type: String, default: "240px" },
    showThresholds: { type: Boolean, default: true },
    timeWindowMs: { type: Number, default: 300_000 }, // 5 minutes
  },
  setup(props) {
    const chartEl = ref<HTMLElement>();
    let chart: ECharts | null = null;
    let resizeCleanup: (() => void) | undefined;

    function renderChart() {
      if (!chart || props.pens.length === 0) return;

      const now = Date.now();
      const minTime = now - props.timeWindowMs;

      const series = props.pens.map((pen) => ({
        name: pen.label,
        type: "line" as const,
        data: pen.data
          .filter((p) => p.time >= minTime)
          .map((p) => [p.time, p.value]),
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2 },
      }));

      const markLines: Record<string, unknown>[] = [];
      if (props.showThresholds) {
        for (const pen of props.pens) {
          if (pen.thresholds) {
            const t = pen.thresholds;
            if (t.hh != null)
              markLines.push({
                yAxis: t.hh,
                lineStyle: { color: "#FF1744", type: "dashed", width: 1 },
                label: { show: false },
              });
            if (t.h != null)
              markLines.push({
                yAxis: t.h,
                lineStyle: { color: "#FF6D00", type: "dotted", width: 1 },
                label: { show: false },
              });
            if (t.l != null)
              markLines.push({
                yAxis: t.l,
                lineStyle: { color: "#FFD600", type: "dotted", width: 1 },
                label: { show: false },
              });
            if (t.ll != null)
              markLines.push({
                yAxis: t.ll,
                lineStyle: { color: "#FF1744", type: "dashed", width: 1 },
                label: { show: false },
              });
          }
        }
      }

      chart.setOption(
        {
          tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross" },
          },
          legend: {
            top: 0,
            textStyle: { fontSize: 11 },
          },
          grid: { left: 50, right: 20, top: 30, bottom: 40 },
          xAxis: {
            type: "time",
            min: minTime,
            max: now,
          },
          yAxis: { type: "value", scale: true },
          dataZoom: [{ type: "inside" }],
          series:
            markLines.length > 0
              ? series.map((s) => ({
                  ...s,
                  markLine: { silent: true, data: markLines.map((m) => [{ ...m }, { ...m }]) },
                }))
              : series,
        },
        // Merge (not notMerge): this fires on every streaming tick (deep watch
        // on pens). notMerge:true replaced the whole option each tick, which
        // reset the user's dataZoom pan/zoom on every update and rebuilt every
        // series. Merge updates data incrementally and — because we never
        // specify dataZoom start/end here — preserves the user's current zoom.
      );
    }

    function onResize() {
      chart?.resize();
    }

    onMounted(async () => {
      if (chartEl.value) {
        const echarts = await import("echarts/core");
        const { LineChart } = await import("echarts/charts");
        const {
          DataZoomComponent,
          GridComponent,
          LegendComponent,
          MarkLineComponent,
          TooltipComponent,
        } = await import("echarts/components");
        const { CanvasRenderer } = await import("echarts/renderers");
        echarts.use([
          LineChart,
          GridComponent,
          TooltipComponent,
          LegendComponent,
          DataZoomComponent,
          MarkLineComponent,
          CanvasRenderer,
        ]);
        chart = echarts.init(chartEl.value);
        renderChart();
        // Keep the canvas in sync with its container. echarts doesn't
        // observe its own element, so without this the chart keeps its
        // initial pixel size when the column narrows (mobile rotation,
        // sidebar collapse, container resize) and renders off-canvas or
        // leaves dead space. ResizeObserver covers container-driven
        // changes; the window listener catches the cases where the
        // observer isn't supported / doesn't fire (older WebViews).
        const el = chartEl.value;
        window.addEventListener("resize", onResize);
        let ro: ResizeObserver | undefined;
        if (typeof ResizeObserver !== "undefined") {
          ro = new ResizeObserver(onResize);
          ro.observe(el);
        }
        resizeCleanup = () => {
          window.removeEventListener("resize", onResize);
          ro?.disconnect();
        };
      }
    });

    onUnmounted(() => {
      resizeCleanup?.();
      resizeCleanup = undefined;
      chart?.dispose();
      chart = null;
    });

    watch(() => props.pens, renderChart, { deep: true });

    return () => <div ref={chartEl} style={{ width: "100%", height: props.height }} />;
  },
});
