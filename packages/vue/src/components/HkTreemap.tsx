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

import HkTooltip from "./HkTooltip";
import { squarify } from "./treemapSquarify";

import "./HkTreemap.scss";

export interface HkTreemapNode {
  id: string;
  label: string;
  /** Render the label in italics — used for an explicitly UNKNOWN /
   *  unattributed composition bucket, which must not read as a normal
   *  named category. Inherited by descendants. */
  labelItalic?: boolean;
  value: number;
  /** Optional opaque sRGB colour: #rgb/#rrggbb/#rrggbbaa, rgb()/rgba() or
   *  hsl()/hsla(). Cells are DOM-painted, so any CSS colour would work at
   *  render time — but the label's contrast text and the legend still need
   *  a parseable concrete value; unparseable/translucent values fall back
   *  to the inherited palette colour. */
  color?: string;
  children?: HkTreemapNode[];
}

export type HkTreemapValueFormatter = (value: number) => string;

/** A sanitized node. `percent` is a 0–100 percentage of all visible leaves. */
export interface HkTreemapLayoutNode {
  id: string;
  label: string;
  labelItalic?: boolean;
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

/** Strict decimal/scientific numeric parse — the WHOLE string must be one
 *  number, mirroring the Rust mirror's `str::parse::<f64>()` + `is_finite()`
 *  gate: trailing garbage ("10x") and inf/NaN spellings are rejected, not
 *  truncated. Returns NaN for anything that is not one number. */
const NUMERIC_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
function parseStrictNumber(raw: string): number {
  const value = raw.trim();
  return NUMERIC_PATTERN.test(value) ? Number(value) : Number.NaN;
}

function numericChannel(raw: string): number | null {
  if (raw.endsWith("%")) {
    const percent = parseStrictNumber(raw.slice(0, -1));
    return Number.isFinite(percent) ? Math.min(255, Math.max(0, (percent / 100) * 255)) : null;
  }
  const value = parseStrictNumber(raw);
  return Number.isFinite(value) ? Math.min(255, Math.max(0, value)) : null;
}

/** An hsl hue: a strict number with the optional `deg` suffix (all trailing
 *  repeats stripped, like the Rust mirror's `trim_end_matches("deg")`). */
function angleChannel(raw: string): number {
  return parseStrictNumber(raw.replace(/(?:deg)+$/, ""));
}

/** An hsl saturation/lightness: a strict number with an optional `%` suffix
 *  (CSS requires the percent, but both forms appear in the wild). */
function percentChannel(raw: string): number {
  return parseStrictNumber(raw.replace(/%+$/, ""));
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
    const percent = parseStrictNumber(raw.slice(0, -1));
    return Number.isFinite(percent) ? Math.min(1, Math.max(0, percent / 100)) : null;
  }
  const value = parseStrictNumber(raw);
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
    const hue = angleChannel(parts[0]!);
    const saturation = percentChannel(parts[1]!);
    const lightness = percentChannel(parts[2]!);
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

/** sRGB relative luminance (WCAG 2.x) of an opaque channel triple. */
function relativeLuminance(channels: RgbaChannels): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linear(channels[0]) +
    0.7152 * linear(channels[1]) +
    0.0722 * linear(channels[2])
  );
}

/** WCAG contrast ratio between two relative luminances. */
function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** The two inks a SOLID fill normally carries. The dark end is the family's
 *  near-black (a hair of blue keeps it from reading as dead #000 on the
 *  pale palette members). */
const SOLID_LIGHT_INK = "#fff";
const SOLID_DARK_INK = "#0b1220";

/** Last-resort ink: the softer pair leaves a narrow mid-tone dead zone
 *  (plate luminance in the open interval (0.1833, 0.2024)) where neither clears AA; there pure black
 *  is the higher-contrast choice that can reach the floor. Outside that band
 *  the softer pair is SELECTED even though black would beat the near-black on
 *  raw ratio everywhere — black stays a floor escape, not the normal ink. */
const SOLID_NEUTRAL_INK = "#000";

/** WCAG AA floor for the fully-opaque cell label; the meta line and the
 *  italic unknown label keep their pre-existing 0.85 / 0.9 opacity (a
 *  deliberate de-emphasis, not part of this contract). */
const AA_CONTRAST = 4.5;

/** Relative luminances of the candidate inks (white is the reference 1). */
const SOLID_DARK_INK_LUMINANCE = relativeLuminance(parseHexColor(SOLID_DARK_INK)!);
const SOLID_LIGHT_INK_LUMINANCE = 1;

/** The theme text token — the ONLY ink source for a surface whose fill is
 *  translucent or unparseable: a see-through cell says nothing beyond
 *  "this theme is light / dark", so light-versus-dark is all it can carry. */
const THEME_CELL_INK = "rgb(var(--color-text, 30 30 30))";

/** Black scrim a group's header band paints over its plate, i.e. the
 *  `rgb(0 0 0 / 18%)` band in HkTreemap.scss / HkTreemapStage.scss. Exported
 *  so the band and the ink decision share one number: the components publish
 *  it as the `--hk-treemap-head-scrim` custom property those sheets read. */
export const HK_TREEMAP_HEAD_SCRIM = 0.18;

/**
 * Cell label colour.
 *
 * User direction 2026-11-10: a SOLID fill decides its own ink from its
 * luminance — the theme's light/dark flip is only for a TRANSPARENT surface
 * (that is the only signal a see-through background carries). The previous
 * rule (2026-10-28) followed the theme token on every cell, which painted
 * large saturated blocks with black ink in the light theme.
 *
 * `scrim` is the black overlay the text actually sits on — the group header
 * band darkens its plate, so pass it and the decision is made against the
 * composited surface rather than the plate underneath.
 */
export function contrastTextColor(background: string, scrim = 0): string {
  const channels = parseCssColor(background);
  if (!channels || channels[3] < 0.999) return THEME_CELL_INK;
  const shade = 1 - Math.min(1, Math.max(0, scrim));
  const effective: RgbaChannels = [
    channels[0] * shade,
    channels[1] * shade,
    channels[2] * shade,
    1,
  ];
  const luminance = relativeLuminance(effective);
  const dark = contrastRatio(luminance, SOLID_DARK_INK_LUMINANCE);
  const light = contrastRatio(luminance, SOLID_LIGHT_INK_LUMINANCE);
  const best = Math.max(dark, light);
  // Neither softer ink clears the floor -> pure black, which is strictly the
  // higher-contrast choice inside that band (see SOLID_NEUTRAL_INK).
  if (best < AA_CONTRAST) return SOLID_NEUTRAL_INK;
  return dark >= light ? SOLID_DARK_INK : SOLID_LIGHT_INK;
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
  labelItalic?: boolean;
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
  inheritedItalic = false,
): NumericLayoutNode | null {
  const color = node.color
    ? resolveOpaqueColor(node.color, inheritedColor)
    : inheritedColor;
  const labelItalic = node.labelItalic ?? inheritedItalic;
  if (node.children && node.children.length > 0) {
    const children = node.children
      .map((child) => normalizeNode(child, color, labelItalic))
      .filter((child): child is NumericLayoutNode => child !== null);
    if (children.length === 0) return null;

    const value = children.reduce((sum, child) => sum + child.value, 0);
    // Finite inputs can still overflow when summed. Such a group cannot be
    // represented truthfully, so omit it rather than emitting Infinity/NaN.
    if (!isVisibleValue(value)) return null;
    return {
      id: node.id,
      label: node.label,
      ...(labelItalic ? { labelItalic: true } : {}),
      value,
      color,
      children,
    };
  }

  if (!isVisibleValue(node.value)) return null;
  return {
    id: node.id,
    label: node.label,
    ...(labelItalic ? { labelItalic: true } : {}),
    value: node.value,
    color,
  };
}

function visitLeaves(nodes: NumericLayoutNode[], visit: (leaf: NumericLayoutNode) => void): void {
  for (const node of nodes) {
    if (node.children) visitLeaves(node.children, visit);
    else visit(node);
  }
}

/**
 * Converts caller input into the only numeric model used by the chart,
 * legend, tooltip and accessible summary. Invalid leaves are removed before
 * any sums or percentages are calculated; caller-provided parent values are
 * ignored.
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

// ── the native layout: squarified rects in canvas space ────────────────

/** Group header band height (px) and the group's inner padding (px). */
export const HK_TREEMAP_GROUP_HEADER_PX = 22;
export const HK_TREEMAP_GROUP_PAD_PX = 2;

export interface HkTreemapCell {
  node: HkTreemapLayoutNode;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Laid-out children (groups only). Empty when the group's inner box is
   *  too small to subdivide (the group then renders as a plain cell). */
  children: HkTreemapCell[];
}

/**
 * Recursively squarify a normalized layout into canvas-space cells.
 * Groups reserve a header band; their children subdivide the remainder.
 * Pure — pinned by the layout tests.
 */
export function layoutHkTreemapCells(
  nodes: readonly HkTreemapLayoutNode[],
  x: number,
  y: number,
  w: number,
  h: number,
): HkTreemapCell[] {
  if (w <= 0 || h <= 0 || nodes.length === 0) return [];
  const byId = new Map(nodes.map((node) => [node.id, node] as const));
  return squarify(
    nodes.map((node) => ({ id: node.id, value: node.value })),
    x,
    y,
    w,
    h,
  ).map((rect) => {
    const node = byId.get(rect.id)!;
    if (node.children && node.children.length > 0) {
      const innerW = rect.w - HK_TREEMAP_GROUP_PAD_PX * 2;
      const innerH = rect.h - HK_TREEMAP_GROUP_HEADER_PX - HK_TREEMAP_GROUP_PAD_PX * 2;
      const children = innerW > 8 && innerH > 8
        ? layoutHkTreemapCells(
            node.children,
            rect.x + HK_TREEMAP_GROUP_PAD_PX,
            rect.y + HK_TREEMAP_GROUP_HEADER_PX + HK_TREEMAP_GROUP_PAD_PX,
            innerW,
            innerH,
          )
        : [];
      return { node, x: rect.x, y: rect.y, w: rect.w, h: rect.h, children };
    }
    return { node, x: rect.x, y: rect.y, w: rect.w, h: rect.h, children: [] };
  });
}

/** Flattened leaf-path text exposes nested data for screen readers. */
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

/**
 * HkTreemap — the family's native squarified treemap.
 *
 * DOM-rendered (no chart library): cell mortar reads the theme background,
 * so light/dark follows the workspace automatically — the old canvas
 * renderer painted fixed light chrome (white mortar, white-bordered
 * labels) that read blinding in dark mode. Every cell carries the
 * standard HkTooltip (hover AND focus, the same component the rest of the
 * family uses — the old renderer shipped the chart library's own foreign
 * tooltip). Overflowing labels ellipsize via CSS from the first clipped
 * character — a tiny cell degrades to its ellipsized label rather than
 * reading as a hard cut, and cells too small for any text stay silent
 * colour blocks with the tooltip carrying the full description.
 *
 * The visible detail ladders with cell size: a tall cell shows label +
 * value + share, a shorter one label only, a tiny one nothing but colour.
 * The a11y summary and the tooltip always describe every leaf regardless
 * of what fits on screen.
 *
 * Cell ink is derived from each SOLID plate's own luminance (WCAG
 * contrast), because a big opaque block is the background that matters;
 * only a transparent/unparseable fill defers to the theme text token. The
 * mid-tone band where neither the white nor the family near-black clears AA
 * falls back to pure black.
 */
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
    const chartEl = ref<HTMLElement | null>(null);
    // useId is SSR-safe and unique per component instance; a module counter
    // drifts between server and client hydration.
    const summaryId = `hk-treemap-summary-${useId()}`;
    const size = ref<{ w: number; h: number } | null>(null);
    let observer: ResizeObserver | undefined;
    let resizeCleanup: (() => void) | undefined;

    const layout = computed(() => buildHkTreemapLayout(props.nodes));
    const hasData = computed(() => layout.value.nodes.length > 0);
    const formatValue = (value: number) =>
      (props.valueFormatter ?? defaultValueFormatter)(value);
    const summary = computed(() => createHkTreemapSummary(layout.value, formatValue));
    const rootStyle = computed(() => ({
      width: "100%",
      height: typeof props.height === "number" ? `${props.height}px` : props.height,
      // The header band's CSS and the ink decision read ONE number.
      "--hk-treemap-head-scrim": `${HK_TREEMAP_HEAD_SCRIM * 100}%`,
    }));
    const cells = computed(() => {
      const dims = size.value;
      if (!dims || !hasData.value) return [];
      return layoutHkTreemapCells(layout.value.nodes, 0, 0, dims.w, dims.h);
    });

    function measure() {
      const el = chartEl.value;
      if (!el) return;
      // LOCAL layout px (clientWidth/Height), NOT getBoundingClientRect:
      // gBCR answers in DRAWN pixels — under the app's root CSS zoom
      // (dpiPrefs writes `html { zoom: 100–300% }`) a 2× root reports a
      // 2× box while the cells' inline px render in LOCAL space, so a
      // gBCR-measured layout paints zoom× oversized and clips (R2 S1;
      // the old canvas renderer sized from clientWidth for the same
      // reason — see hikari runtime/tooltipPosition's ancestor-zoom
      // division for the same lesson).
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        size.value = { w, h };
      }
    }

    onMounted(() => {
      const el = chartEl.value;
      if (!el) return;
      measure();
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(measure);
        observer.observe(el);
      } else {
        window.addEventListener("resize", measure);
        resizeCleanup = () => window.removeEventListener("resize", measure);
      }
    });
    onBeforeUnmount(() => {
      observer?.disconnect();
      observer = undefined;
      resizeCleanup?.();
      resizeCleanup = undefined;
    });

    // A same-size container whose DATA changed needs no resize event to
    // invalidate the memoized cells — re-measure on input changes too.
    watch([layout, () => props.valueFormatter], measure);

    function cellText(node: HkTreemapLayoutNode): string {
      return `${node.label}: ${formatValue(node.value)} · ${formatHkTreemapPercent(node.percent)}`;
    }

    // The render model is a FLAT list in one canvas coordinate space:
    // groups contribute a colour plate + a header band, leaves a cell.
    // Depth order is the paint order — children ride above their group's
    // plate without any z-index bookkeeping.
    interface RenderEntry {
      key: string;
      kind: "plate" | "head" | "leaf";
      cell: HkTreemapCell;
    }
    const renderEntries = computed<RenderEntry[]>(() => {
      const out: RenderEntry[] = [];
      function walk(cells: HkTreemapCell[], prefix: string): void {
        for (const cell of cells) {
          const key = `${prefix}/${cell.node.id}`;
          const isGroup = cell.children.length > 0;
          if (isGroup) {
            out.push({ key, kind: "plate", cell });
            out.push({ key: `${key}#head`, kind: "head", cell });
            walk(cell.children, key);
          } else {
            out.push({ key, kind: "leaf", cell });
          }
        }
      }
      walk(cells.value, "root");
      return out;
    });

    function renderEntry(entry: RenderEntry) {
      const { node, x, y, w, h } = entry.cell;
      // The detail ladder: the label+meta stack (2 lines × 12px ×1.3
      // + gap + padding) needs ~40px, the label alone ~18px; below that
      // the cell is a pure colour block (the tooltip speaks).
      const showValue = h >= 40 && w >= 56;
      const showLabel = h >= 18 && w >= 24;
      if (entry.kind === "plate") {
        return (
          <div
            key={entry.key}
            class="hk-treemap__cell hk-treemap__cell--plate"
            aria-hidden="true"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${w}px`,
              height: `${h}px`,
              background: node.color,
            }}
          />
        );
      }
      const head = entry.kind === "head";
      const bandH = Math.min(22, Math.max(0, h));
      // The tooltip wrapper IS the absolute cell frame. Its trigger fills
      // that frame, so the wrapper both establishes the correct containing
      // block and reports the visible cell's rect to tooltipPosition. The
      // old shape positioned the trigger inside a zero-sized inline wrapper
      // (wrong origin + chart-edge clipping + every tooltip at the top-left).
      const frameStyle = {
        position: "absolute" as const,
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${head ? bandH : h}px`,
      };
      const cellStyle = {
        inset: "0px",
        background: node.color,
        // A header band sits on the scrimmed plate, a leaf body on the plate
        // itself — the ink follows the surface the glyphs actually sit on.
        "--hk-treemap-fg": contrastTextColor(
          node.color,
          head ? HK_TREEMAP_HEAD_SCRIM : 0,
        ),
      };
      const label = showLabel || head ? node.label : null;
      const meta = showValue
        ? `${formatValue(node.value)} · ${formatHkTreemapPercent(node.percent)}`
        : null;
      return (
        <HkTooltip key={entry.key} text={cellText(node)} placement="bottom" style={frameStyle}>
          {() => (
            <div
              class={{
                "hk-treemap__cell": true,
                "hk-treemap__cell--group": head,
              }}
              style={cellStyle}
              role="img"
              aria-label={cellText(node)}
            >
              {head ? (
                <span class="hk-treemap__group-head">
                  <span
                    class={{
                      "hk-treemap__label": true,
                      "hk-treemap__label--group": true,
                      "hk-treemap__label--unknown": node.labelItalic,
                    }}
                  >{label}</span>
                  {meta && <span class="hk-treemap__meta">{meta}</span>}
                </span>
              ) : (
                label && (
                  <span class="hk-treemap__leaf-body">
                    <span
                      class={{
                        "hk-treemap__label": true,
                        "hk-treemap__label--unknown": node.labelItalic,
                      }}
                    >{label}</span>
                    {meta && <span class="hk-treemap__meta">{meta}</span>}
                  </span>
                )
              )}
            </div>
          )}
        </HkTooltip>
      );
    }

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
                  <span
                    class={{
                      "hk-treemap__legend-label": true,
                      "hk-treemap__label--unknown": node.labelItalic,
                    }}
                  >{node.label}</span>
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
          >
            {renderEntries.value.map((entry) => renderEntry(entry))}
          </div>
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
