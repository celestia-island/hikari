import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type PropType,
} from "vue";

// Keep echarts out of the initial bundle. Only the type imports are static;
// the renderer and the treemap implementation are loaded after mount.
import type { ECharts, EChartsCoreOption } from "echarts/core";

import "./HkTreemap.scss";

export interface HkTreemapNode {
  id: string;
  label: string;
  value: number;
  color?: string;
  children?: HkTreemapNode[];
}

export type HkTreemapValueFormatter = (value: number) => string;

/** A sanitized node. `percent` is a 0–100 percentage of all visible leaves. */
export interface HkTreemapLayoutNode {
  id: string;
  label: string;
  value: number;
  color: string;
  percent: number;
  children?: HkTreemapLayoutNode[];
}

export interface HkTreemapLayout {
  nodes: HkTreemapLayoutNode[];
  total: number;
}

/** Pick a readable label colour for an arbitrary host-supplied background. */
export function contrastTextColor(background: string): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(background.trim());
  if (!match) return "#fff";
  const raw = match[1]!.length === 3
    ? match[1]!.split("").map((char) => char + char).join("")
    : match[1]!;
  const red = Number.parseInt(raw.slice(0, 2), 16);
  const green = Number.parseInt(raw.slice(2, 4), 16);
  const blue = Number.parseInt(raw.slice(4, 6), 16);
  // sRGB relative luminance, with the standard gamma expansion. The
  // threshold favours dark text earlier than a raw YIQ average would; the
  // pale members of the default palette are otherwise the worst offenders.
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
  return luminance > 0.42 ? "#111827" : "#fff";
}

export const HK_TREEMAP_DEFAULT_COLORS = [
  "#4e79a7",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc948",
  "#b07aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ab",
] as const;

const defaultValueFormatter: HkTreemapValueFormatter = (value) => String(value);
let nextSummaryId = 0;

interface NumericLayoutNode {
  id: string;
  label: string;
  value: number;
  color: string;
  children?: NumericLayoutNode[];
}

function isVisibleValue(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * A node with a non-empty children array is a group: its own value is never
 * trusted, and it survives only when at least one valid descendant leaf does.
 * An empty children array is equivalent to no children and therefore a leaf.
 */
function normalizeNode(
  node: HkTreemapNode,
  inheritedColor: string,
): NumericLayoutNode | null {
  const color = node.color || inheritedColor;
  if (node.children && node.children.length > 0) {
    const children = node.children
      .map((child) => normalizeNode(child, color))
      .filter((child): child is NumericLayoutNode => child !== null);
    if (children.length === 0) return null;

    const value = children.reduce((sum, child) => sum + child.value, 0);
    // Finite inputs can still overflow when summed. Such a group cannot be
    // represented truthfully, so omit it rather than emitting Infinity/NaN.
    if (!isVisibleValue(value)) return null;
    return { id: node.id, label: node.label, value, color, children };
  }

  if (!isVisibleValue(node.value)) return null;
  return { id: node.id, label: node.label, value: node.value, color };
}

function visitLeaves(nodes: NumericLayoutNode[], visit: (leaf: NumericLayoutNode) => void): void {
  for (const node of nodes) {
    if (node.children) visitLeaves(node.children, visit);
    else visit(node);
  }
}

/**
 * Converts caller input into the only numeric model used by the chart, legend,
 * tooltip and accessible summary. Invalid leaves are removed before any sums
 * or percentages are calculated; caller-provided parent values are ignored.
 */
export function buildHkTreemapLayout(nodes: readonly HkTreemapNode[]): HkTreemapLayout {
  const normalized = nodes
    .map((node, index) =>
      normalizeNode(
        node,
        HK_TREEMAP_DEFAULT_COLORS[index % HK_TREEMAP_DEFAULT_COLORS.length]!,
      ),
    )
    .filter((node): node is NumericLayoutNode => node !== null);

  let total = 0;
  visitLeaves(normalized, (leaf) => {
    total += leaf.value;
  });
  if (!isVisibleValue(total)) return { nodes: [], total: 0 };

  function addPercentages(node: NumericLayoutNode): HkTreemapLayoutNode {
    return {
      ...node,
      percent: (node.value / total) * 100,
      children: node.children?.map(addPercentages),
    };
  }

  return { nodes: normalized.map(addPercentages), total };
}

/** One decimal place, trimmed for whole numbers, without rounding tiny shares to zero. */
export function formatHkTreemapPercent(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return "0%";
  if (percent < 0.1) return "<0.1%";
  return `${Number(percent.toFixed(1))}%`;
}

interface HkTreemapChartMeta {
  label: string;
  valueText: string;
  percentText: string;
}

interface HkTreemapChartDatum {
  id: string;
  name: string;
  value: number;
  itemStyle: { color: string };
  label: { color: string };
  upperLabel: { color: string };
  hkTreemap: HkTreemapChartMeta;
  children?: HkTreemapChartDatum[];
}

function toChartData(
  node: HkTreemapLayoutNode,
  formatValue: HkTreemapValueFormatter,
): HkTreemapChartDatum {
  const labelColor = contrastTextColor(node.color);
  return {
    id: node.id,
    name: node.label,
    value: node.value,
    itemStyle: { color: node.color },
    label: { color: labelColor },
    upperLabel: { color: labelColor },
    hkTreemap: {
      label: node.label,
      valueText: formatValue(node.value),
      percentText: formatHkTreemapPercent(node.percent),
    },
    children: node.children?.map((child) => toChartData(child, formatValue)),
  };
}

function chartMeta(params: unknown): HkTreemapChartMeta | null {
  const data = (params as { data?: Partial<HkTreemapChartDatum> } | null)?.data;
  return data?.hkTreemap ?? null;
}

function leafLabelFormatter(params: unknown): string {
  const meta = chartMeta(params);
  return meta ? `${meta.label}\n${meta.valueText} · ${meta.percentText}` : "";
}

function groupLabelFormatter(params: unknown): string {
  const meta = chartMeta(params);
  return meta ? `${meta.label} · ${meta.valueText} · ${meta.percentText}` : "";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

function tooltipFormatter(params: unknown): string {
  const meta = chartMeta(params);
  if (!meta) return "";
  return `<strong>${escapeHtml(meta.label)}</strong><br/>${escapeHtml(meta.valueText)} · ${escapeHtml(meta.percentText)}`;
}

/** Pure echarts option construction, exported for focused contract tests. */
export function createHkTreemapOption(
  layout: HkTreemapLayout,
  formatValue: HkTreemapValueFormatter = defaultValueFormatter,
): EChartsCoreOption {
  return {
    animation: false,
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: tooltipFormatter,
    },
    series: [
      {
        type: "treemap",
        data: layout.nodes.map((node) => toChartData(node, formatValue)),
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: {
          show: true,
          formatter: leafLabelFormatter,
          color: "#fff",
          fontSize: 12,
          lineHeight: 17,
          overflow: "truncate",
          textBorderColor: "rgba(0, 0, 0, 0.35)",
          textBorderWidth: 2,
        },
        upperLabel: {
          show: true,
          formatter: groupLabelFormatter,
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
          height: 24,
          overflow: "truncate",
          textBorderColor: "rgba(0, 0, 0, 0.35)",
          textBorderWidth: 2,
        },
        itemStyle: {
          borderColor: "#fff",
          borderWidth: 1,
          gapWidth: 1,
        },
        levels: [
          { itemStyle: { borderWidth: 0, gapWidth: 0 } },
          { itemStyle: { borderWidth: 2, gapWidth: 3 } },
          { itemStyle: { borderWidth: 1, gapWidth: 2 } },
          { itemStyle: { borderWidth: 1, gapWidth: 1 } },
        ],
      },
    ],
  };
}

/** Flattened leaf-path text exposes nested data that a canvas cannot announce. */
export function createHkTreemapSummary(
  layout: HkTreemapLayout,
  formatValue: HkTreemapValueFormatter = defaultValueFormatter,
): string {
  const entries: string[] = [];
  function walk(nodes: HkTreemapLayoutNode[], parents: string[]): void {
    for (const node of nodes) {
      const path = [...parents, node.label];
      if (node.children) walk(node.children, path);
      else {
        entries.push(
          `${path.join(" / ")}: ${formatValue(node.value)} (${formatHkTreemapPercent(node.percent)})`,
        );
      }
    }
  }
  walk(layout.nodes, []);
  return entries.join("; ");
}

export default defineComponent({
  name: "HkTreemap",
  props: {
    nodes: { type: Array as PropType<HkTreemapNode[]>, default: () => [] },
    height: { type: [String, Number], default: "320px" },
    showLegend: { type: Boolean, default: true },
    valueFormatter: { type: Function as PropType<HkTreemapValueFormatter>, default: undefined },
    emptyText: { type: String, default: "No data" },
    ariaLabel: { type: String, default: "Treemap" },
  },
  setup(props) {
    const chartEl = ref<HTMLElement>();
    const summaryId = `hk-treemap-summary-${++nextSummaryId}`;
    let chart: ECharts | null = null;
    let resizeCleanup: (() => void) | undefined;
    let unmounted = false;

    const layout = computed(() => buildHkTreemapLayout(props.nodes));
    const hasData = computed(() => layout.value.nodes.length > 0);
    const formatValue = (value: number) =>
      (props.valueFormatter ?? defaultValueFormatter)(value);
    const summary = computed(() => createHkTreemapSummary(layout.value, formatValue));
    const rootStyle = computed(() => ({
      width: "100%",
      height: typeof props.height === "number" ? `${props.height}px` : props.height,
    }));

    function renderChart() {
      if (!chart) return;
      if (!hasData.value) {
        // Data can become empty during a streaming update. Remove the previous
        // option so a later reveal can never expose stale rectangles.
        chart.clear();
        return;
      }
      chart.setOption(createHkTreemapOption(layout.value, formatValue), { notMerge: true });
    }

    function onResize() {
      chart?.resize();
    }

    onMounted(async () => {
      const el = chartEl.value;
      if (!el) return;

      const [echarts, { TreemapChart }, { TooltipComponent }, { CanvasRenderer }] =
        await Promise.all([
          import("echarts/core"),
          import("echarts/charts"),
          import("echarts/components"),
          import("echarts/renderers"),
        ]);

      // Dynamic imports may resolve after the host has unmounted. Never init
      // against a detached (or subsequently replaced) element.
      if (unmounted || chartEl.value !== el) return;

      echarts.use([TreemapChart, TooltipComponent, CanvasRenderer]);
      chart = echarts.init(el);
      renderChart();

      window.addEventListener("resize", onResize);
      let observer: ResizeObserver | undefined;
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(onResize);
        observer.observe(el);
      }
      resizeCleanup = () => {
        window.removeEventListener("resize", onResize);
        observer?.disconnect();
      };
    });

    onUnmounted(() => {
      unmounted = true;
      resizeCleanup?.();
      resizeCleanup = undefined;
      chart?.dispose();
      chart = null;
    });

    watch([layout, () => props.valueFormatter], renderChart);

    return () => (
      <div class="hk-treemap" style={rootStyle.value}>
        {props.showLegend && hasData.value && (
          <ul class="hk-treemap__legend">
            {layout.value.nodes.map((node) => {
              const valueText = formatValue(node.value);
              const percentText = formatHkTreemapPercent(node.percent);
              return (
                <li
                  class="hk-treemap__legend-item"
                  key={node.id}
                  title={`${node.label}: ${valueText} (${percentText})`}
                >
                  <span
                    class="hk-treemap__legend-swatch"
                    style={{ backgroundColor: node.color }}
                    aria-hidden="true"
                  />
                  <span class="hk-treemap__legend-label">{node.label}</span>
                  <span class="hk-treemap__legend-value">{valueText}</span>
                  <span class="hk-treemap__legend-percent">{percentText}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div class="hk-treemap__body">
          <div
            ref={chartEl}
            class="hk-treemap__chart"
            role="img"
            aria-label={props.ariaLabel}
            aria-describedby={hasData.value ? summaryId : undefined}
            aria-hidden={!hasData.value}
            style={{ visibility: hasData.value ? "visible" : "hidden" }}
          />
          {!hasData.value && <div class="hk-treemap__empty">{props.emptyText}</div>}
        </div>
        {hasData.value && (
          <p id={summaryId} class="hk-treemap__a11y-summary">
            {summary.value}
          </p>
        )}
      </div>
    );
  },
});
