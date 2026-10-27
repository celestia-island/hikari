import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  useId,
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
  /** Optional opaque sRGB colour: #rgb/#rrggbb/#rrggbbaa, rgb()/rgba() or
   *  hsl()/hsla(). Canvas cannot resolve CSS custom properties or named
   *  colours reliably; unsupported/translucent values fall back to the
   *  inherited palette colour instead of corrupting the next cell. */
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

type RgbaChannels = [number, number, number, number];

function parseHexColor(raw: string): RgbaChannels | null {
  const value = raw.slice(1);
  if (![3, 6, 8].includes(value.length) || !/^[0-9a-f]+$/i.test(value)) return null;
  const expanded = value.length === 3
    ? value.split("").map((char) => char + char).join("")
    : value;
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
    value.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  ];
}

function numericChannel(raw: string): number | null {
  if (raw.endsWith("%")) {
    const percent = Number.parseFloat(raw.slice(0, -1));
    return Number.isFinite(percent) ? Math.min(255, Math.max(0, (percent / 100) * 255)) : null;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? Math.min(255, Math.max(0, value)) : null;
}

function hueToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = ((hue % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const [red, green, blue] = sector < 1
    ? [chroma, x, 0]
    : sector < 2
      ? [x, chroma, 0]
      : sector < 3
        ? [0, chroma, x]
        : sector < 4
          ? [0, x, chroma]
          : sector < 5
            ? [x, 0, chroma]
            : [chroma, 0, x];
  const match = lightness - chroma / 2;
  return [(red + match) * 255, (green + match) * 255, (blue + match) * 255];
}

function alphaComponent(raw: string | undefined): number | null {
  if (raw == null || raw === "") return 1;
  if (raw.endsWith("%")) {
    const percent = Number.parseFloat(raw.slice(0, -1));
    return Number.isFinite(percent) ? Math.min(1, Math.max(0, percent / 100)) : null;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;
}

function parseCssColor(raw: string): RgbaChannels | null {
  const value = raw.trim();
  if (value.startsWith("#")) return parseHexColor(value);
  const rgb = /^rgba?\((.*)\)$/i.exec(value);
  if (rgb) {
    const parts = rgb[1]!.split(/[\s,/]+/).filter((part) => part && part !== "none");
    if (parts.length < 3) return null;
    const channels = parts.slice(0, 3).map(numericChannel);
    if (channels.some((channel) => channel === null)) return null;
    const alpha = alphaComponent(parts[3]);
    if (alpha === null) return null;
    return [...(channels as [number, number, number]), alpha];
  }
  const hsl = /^hsla?\((.*)\)$/i.exec(value);
  if (hsl) {
    const parts = hsl[1]!.split(/[\s,/]+/).filter((part) => part && part !== "none");
    if (parts.length < 3) return null;
    const hue = Number.parseFloat(parts[0]!);
    const saturation = Number.parseFloat(parts[1]!);
    const lightness = Number.parseFloat(parts[2]!);
    if (![hue, saturation, lightness].every(Number.isFinite)) return null;
    const alpha = alphaComponent(parts[3]);
    if (alpha === null) return null;
    return [
      ...hueToRgb(
        hue,
        Math.min(1, Math.max(0, saturation / 100)),
        Math.min(1, Math.max(0, lightness / 100)),
      ),
      alpha,
    ];
  }
  return null;
}

function resolveOpaqueColor(raw: string, fallback: string): string {
  const channels = parseCssColor(raw);
  if (!channels || channels[3] < 0.999) return fallback;
  return `rgb(${Math.round(channels[0])} ${Math.round(channels[1])} ${Math.round(channels[2])})`;
}

/** Pick the higher-contrast label colour for an opaque CSS background. */
export function contrastTextColor(background: string): string {
  const channels = parseCssColor(background);
  if (!channels || channels[3] < 0.999) return "#fff";
  // sRGB relative luminance, with the standard gamma expansion. The two
  // candidate text colours (#fff / #0b1220) cross at luminance ~= 0.193.
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * linear(channels[0]) +
    0.7152 * linear(channels[1]) +
    0.0722 * linear(channels[2]);
  return luminance > 0.193 ? "#0b1220" : "#fff";
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
  const color = node.color
    ? resolveOpaqueColor(node.color, inheritedColor)
    : inheritedColor;
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
  itemStyle: { color: string; borderColor?: string };
  label: { color: string; textBorderColor: string };
  upperLabel: { color: string; textBorderColor: string };
  hkTreemap: HkTreemapChartMeta;
  children?: HkTreemapChartDatum[];
}

function toChartData(
  node: HkTreemapLayoutNode,
  formatValue: HkTreemapValueFormatter,
): HkTreemapChartDatum {
  const labelColor = contrastTextColor(node.color);
  const textBorderColor = labelColor === "#0b1220"
    ? "rgba(255, 255, 255, 0.6)"
    : "rgba(0, 0, 0, 0.45)";
  const isGroup = Boolean(node.children?.length);
  return {
    id: node.id,
    name: node.label,
    value: node.value,
    // ECharts paints a group's upperLabel band with the group's BORDER
    // colour. Keep that band the group's own colour so the contrast choice
    // above describes the pixels under the title (the series default is
    // white, which would produce white-on-white titles).
    itemStyle: isGroup
      ? { color: node.color, borderColor: node.color }
      : { color: node.color },
    label: { color: labelColor, textBorderColor },
    upperLabel: { color: labelColor, textBorderColor },
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
        // TreemapView reads SERIES animation, not the top-level option.
        animation: false,
        data: layout.nodes.map((node) => toChartData(node, formatValue)),
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        roam: false,
        nodeClick: false,
        // ECharts defaults to hiding cells below 10px²; our legend and
        // accessible summary describe every leaf, so the chart must too.
        visibleMin: 0,
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
          {
            // The virtual root is not a visible group: without this, ECharts
            // reserves a 24px white upperLabel band above the whole chart.
            upperLabel: { show: false },
            itemStyle: { borderWidth: 0, gapWidth: 0, borderColor: "transparent" },
          },
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
    // useId is SSR-safe and unique per component instance; a module counter
    // drifts between server and client hydration.
    const summaryId = `hk-treemap-summary-${useId()}`;
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
