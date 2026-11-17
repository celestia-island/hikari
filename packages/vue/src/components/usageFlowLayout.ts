// Pure layout for HkUsageFlow — the three-stage usage-distribution Sankey
// (caller → upstream → model). Kept dependency-free and framework-free so
// the component stays a thin renderer and every geometric claim is pinned
// by tests here (the HkBarChart/barChart.ts "pure logic module + thin
// component" line).
//
// Input = settled aggregate rows (the caller owns fetching/grouping):
//
//   { source: "arona-1a…9f3c", middle: "upstream-a", target: "model-x", value: 1200 }
//
// The layout turns them into three stacked columns of bars plus ribbon
// paths, with ONE shared value scale across the columns: a ribbon's
// thickness means the same thing at every stage and the columns always line
// up. A node's bar is `value × scale` floored at a visibility minimum; its
// ribbon stacks are the EXACT `value × scale` slots (never floored), so a
// bar can be slightly taller than its stacks but no stack ever overhangs
// its bar. Nodes beyond `maxNodes` in a column collapse into one synthetic
// "others" bucket BEFORE geometry runs, so the collapsed total still equals
// the column total (the conservation invariant the tests pin). The cap is
// also clamped to what the frame can actually stack, so a tall column never
// collapses every magnitude to the floor or escapes the viewBox.
//
// Colours: the last column (models) is the legend's colour source. A
// roster (`models`) fixes the colour order regardless of usage — so a
// registered model's swatch is stable across days/windows, and models with
// zero measured usage keep their slot. Without a roster the slots follow
// measured value, descending. Every fill is a theme token expression
// (`rgb(var(--color-*))` / `color-mix(...)`), so a scheme flip repaints
// without a re-render.
//
// AI-generated (DeepSeek V4.1 via DeepSeek Harness), 2026-11-17 — SySL-1.0 §2.3.

/** One settled aggregate flow row: caller → upstream → model. */
export interface HkUsageFlowRow {
  /** First column key: the caller attribution (masked API-key id, session
   *  id, …) exactly as the metering source records it. */
  source: string;
  /** Middle column key: the upstream / backend that served the request. */
  middle: string;
  /** Last column key: the model id the request asked for. */
  target: string;
  /** Metric magnitude for this triple (tokens / requests / cost — the host
   *  picks the metric; the layout is metric-agnostic). */
  value: number;
}

/** One entry of the complete registered-model roster. The colour is fixed
 *  by the entry's position so an idle model keeps its swatch. */
export interface HkUsageFlowRosterEntry {
  label: string;
  /** Optional explicit fill; absent = the palette slot for the position. */
  color?: string;
}

/** One laid-out node (bar) in a column. */
export interface HkUsageFlowNode {
  /** Stable DOM key: `<column>:<label>`. */
  key: string;
  label: string;
  /** Untruncated label (for `title` / hints). */
  fullLabel: string;
  /** 0 = caller, 1 = upstream, 2 = model. */
  column: number;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  /** True for the synthetic collapsed bucket (`othersLabel`). */
  others: boolean;
}

/** One ribbon between two adjacent columns. */
export interface HkUsageFlowLink {
  key: string;
  sourceKey: string;
  targetKey: string;
  value: number;
  /** Ribbon outline: a closed path (two cubic edges + two straight caps). */
  path: string;
  /** The TARGET node's fill — ribbons are read as "flow into X". */
  color: string;
  /** Ribbon thickness in layout units (exactly `value × scale`). */
  thickness: number;
  /** Source-side slot origin (the top edge on the source bar). */
  startY: number;
  /** Target-side slot origin (the top edge on the target bar). */
  endY: number;
}

/** One legend row: the measured total for a registered model (idle ones
 *  included) or for a model that served traffic but is not registered. */
export interface HkUsageFlowLegendRow {
  label: string;
  value: number;
  /** Share of the window total, 0–100 (one decimal precision kept in the
   *  number; the component formats the visible string). */
  percent: number;
  color: string;
  /** No measured usage: the registered-but-unused row (greyed by CSS). */
  idle: boolean;
  /** True for the synthetic collapsed bucket rather than a real model. */
  others: boolean;
}

/** The full layout HkUsageFlow renders. */
export interface HkUsageFlowLayout {
  width: number;
  height: number;
  nodes: HkUsageFlowNode[];
  links: HkUsageFlowLink[];
  legend: HkUsageFlowLegendRow[];
  /** Sum of every positive row value (the metric's window total). */
  total: number;
  /** No positive rows: the component renders its empty state. */
  empty: boolean;
}

/** Tunables; the component passes its props, tests pass their own. */
export interface HkUsageFlowLayoutOptions {
  width?: number;
  height?: number;
  /** Per-column cap; beyond it the tail collapses into `othersLabel`.
   *  Clamped to ≥ 2 AND to what the frame can stack (a cap that would not
   *  fit silently shrinks rather than collapsing every magnitude into an
   *  invisible column). `0` / absent / non-finite = "as many as fit". */
  maxNodes?: number;
  othersLabel?: string;
  /** The complete registered roster. Roster order fixes the model colours
   *  (idle rows included), so a model's swatch is stable across windows. */
  models?: HkUsageFlowRosterEntry[];
  /** Colour ladder; defaults to the theme-token palette below. */
  colors?: string[];
  /** Label truncation budget in character units (CJK counts 2). */
  labelMaxChars?: number;
}

const COLUMN_COUNT = 3;
const PAD_X = 8;
const PAD_Y = 12;
const NODE_WIDTH = 14;
const NODE_GAP = 10;
const MIN_NODE_HEIGHT = 2;

/** The default categorical ladder — every entry a theme-token expression, so
 *  light/dark/brand-preset flips repaint the chart without JS. The five
 *  semantic slots come first; the seven mixes fill the long tail with
 *  distinguishable hues that still derive from the active theme. */
export const USAGE_FLOW_PALETTE: readonly string[] = [
  "rgb(var(--color-primary, 122 162 247))",
  "rgb(var(--color-info, 106 190 214))",
  "rgb(var(--color-success, 14 184 64))",
  "rgb(var(--color-warning, 238 214 119))",
  "rgb(var(--color-error, 247 118 142))",
  "color-mix(in srgb, rgb(var(--color-primary, 122 162 247)) 55%, rgb(var(--color-info, 106 190 214)))",
  "color-mix(in srgb, rgb(var(--color-info, 106 190 214)) 55%, rgb(var(--color-success, 14 184 64)))",
  "color-mix(in srgb, rgb(var(--color-success, 14 184 64)) 55%, rgb(var(--color-warning, 238 214 119)))",
  "color-mix(in srgb, rgb(var(--color-warning, 238 214 119)) 55%, rgb(var(--color-error, 247 118 142)))",
  "color-mix(in srgb, rgb(var(--color-error, 247 118 142)) 55%, rgb(var(--color-primary, 122 162 247)))",
  "color-mix(in srgb, rgb(var(--color-secondary, 81 154 115)) 65%, rgb(var(--color-primary, 122 162 247)))",
  "color-mix(in srgb, rgb(var(--color-accent, 247 181 0)) 65%, rgb(var(--color-error, 247 118 142)))",
];

/** Truncate a label to `maxChars` character units (CJK counts 2), adding an
 *  ellipsis. The full label always rides the node's `fullLabel`. */
export function truncateFlowLabel(label: string, maxChars: number): string {
  const budget = Math.max(4, Math.floor(maxChars));
  let units = 0;
  let out = "";
  for (const ch of label) {
    const width = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/u.test(ch)
      ? 2
      : 1;
    if (units + width > budget) {
      return out + "…";
    }
    units += width;
    out += ch;
  }
  return out;
}

/** One normalized flow after per-column label mapping. */
interface ResolvedFlow {
  source: string;
  middle: string;
  target: string;
  value: number;
}

interface CollapsedColumn {
  /** Raw labels kept as-is (value desc). */
  kept: Set<string>;
  /** Raw label → display label (identity for kept labels). */
  display: Map<string, string>;
}

/** Collapse one column's labels: keep the top `maxNodes-1` and fold the
 *  rest into the synthetic bucket. `maxNodes <= 0` means "no cap". */
function collapseColumn(
  values: Map<string, number>,
  maxNodes: number,
  othersLabel: string,
): CollapsedColumn {
  const display = new Map<string, string>();
  const kept = new Set<string>();
  const entries = [...values.entries()];
  for (const [label] of entries) {
    display.set(label, label);
    kept.add(label);
  }
  if (maxNodes <= 0 || entries.length <= maxNodes) {
    return { kept, display };
  }
  const cap = Math.max(2, Math.floor(maxNodes));
  const ranked = entries
    .map(([label, value], index) => ({ label, value, index }))
    .sort((a, b) => (b.value - a.value) || (a.label < b.label ? -1 : a.label > b.label ? 1 : a.index - b.index));
  const keep = new Set(ranked.slice(0, cap - 1).map((e) => e.label));
  for (const [label] of entries) {
    if (!keep.has(label)) {
      display.set(label, othersLabel);
    }
  }
  return { kept: keep, display };
}

/** Add `value` to a map bucket. */
function addValue(map: Map<string, number>, label: string, value: number): void {
  map.set(label, (map.get(label) ?? 0) + value);
}

/** Rank labels by value descending, ties broken by label ascending. */
function rankLabels(values: Map<string, number>): string[] {
  return [...values.entries()]
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([label]) => label);
}

/** Round a coordinate to two decimals so float noise never reaches the DOM. */
function px(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The ribbon outline: right edge of the source bar → left edge of the
 *  target bar, thick end caps and two mirrored cubic edges. */
function ribbonPath(x0: number, y0: number, x1: number, y1: number, thickness: number): string {
  // The drawn thickness IS the scaled slot: flooring it here would let a
  // dense stack overhang its bar without the geometry saying so.
  const t = Math.max(0, thickness);
  const bend = Math.max(8, (x1 - x0) * 0.5);
  const a = `${px(x0)} ${px(y0)}`;
  const b = `${px(x1)} ${px(y1)}`;
  const c0 = `${px(x0 + bend)} ${px(y0)}`;
  const c1 = `${px(x1 - bend)} ${px(y1)}`;
  const d0 = `${px(x1)} ${px(y1 + t)}`;
  const d1 = `${px(x0)} ${px(y0 + t)}`;
  const e0 = `${px(x1 - bend)} ${px(y1 + t)}`;
  const e1 = `${px(x0 + bend)} ${px(y0 + t)}`;
  return `M ${a} C ${c0}, ${c1}, ${b} L ${d0} C ${e0}, ${e1}, ${d1} Z`;
}

/**
 * Lay out the three-stage usage flow.
 *
 * Invariants (pinned by usageFlowLayout.test.ts):
 *   * a column's node values sum to the same total at every stage;
 *   * a node's height equals its value × the shared scale (floored at the
 *     visibility minimum), and the incoming/outgoing ribbon stacks exactly
 *     fill the bar's height;
 *   * the legend carries EVERY roster entry (idle ones included) plus any
 *     unregistered model that served traffic;
 *   * the same input yields the same geometry and colours.
 */
export function usageFlowLayout(
  rows: readonly HkUsageFlowRow[],
  options: HkUsageFlowLayoutOptions = {},
): HkUsageFlowLayout {
  const finite = (value: number | undefined, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const width = Math.max(320, finite(options.width, 960));
  const height = Math.max(180, finite(options.height, 420));
  const requestedMax = finite(options.maxNodes, 0);
  const othersLabel = options.othersLabel?.trim() || "Others";
  const labelChars = finite(options.labelMaxChars, 28);
  const labelMaxChars = labelChars > 0 ? labelChars : 28;
  const palette = options.colors && options.colors.length > 0 ? options.colors : USAGE_FLOW_PALETTE;
  const roster = options.models ?? [];

  // ── Normalize: drop non-positive / non-finite rows, sum duplicates. ──
  const raw = new Map<string, ResolvedFlow>();
  for (const row of rows) {
    if (!row) continue;
    const value = row.value;
    if (!Number.isFinite(value) || value <= 0) continue;
    const source = String(row.source ?? "");
    const middle = String(row.middle ?? "");
    const target = String(row.target ?? "");
    const key = `${source}\u0000${middle}\u0000${target}`;
    const previous = raw.get(key);
    if (previous) {
      previous.value += value;
      // A summed overflow (two absurd magnitudes, or a host feeding
      // ±Infinity-ish values) must drop the row: an Infinity total makes
      // `scale` zero and `value × scale` NaN, which poisons every later
      // node in the column.
      if (!Number.isFinite(previous.value)) raw.delete(key);
    } else {
      raw.set(key, { source, middle, target, value });
    }
  }

  const empty = raw.size === 0;

  // ── Per-column totals before collapsing. ──
  const columnValues: Array<Map<string, number>> = [
    new Map<string, number>(),
    new Map<string, number>(),
    new Map<string, number>(),
  ];
  for (const flow of raw.values()) {
    addValue(columnValues[0], flow.source, flow.value);
    addValue(columnValues[1], flow.middle, flow.value);
    addValue(columnValues[2], flow.target, flow.value);
  }

  // ── Collapse each column, then re-key the flows onto display labels.
  //    The cap is clamped to what the frame can stack: each extra node
  //    costs `MIN_NODE_HEIGHT` plus a `NODE_GAP`, and the usable band is
  //    `height - 2 × PAD_Y` — a cap beyond that would leave `scale` at 0
  //    (every bar at the floor) and paint below the viewBox. ──
  const fitCount = Math.max(
    2,
    Math.floor((height - PAD_Y * 2 + NODE_GAP) / (MIN_NODE_HEIGHT + NODE_GAP)),
  );
  const maxNodes =
    requestedMax > 0 ? Math.max(2, Math.min(Math.floor(requestedMax), fitCount)) : fitCount;
  const collapsed = columnValues.map((values) => collapseColumn(values, maxNodes, othersLabel));
  const flows = new Map<string, ResolvedFlow>();
  for (const flow of raw.values()) {
    const source = collapsed[0].display.get(flow.source) ?? othersLabel;
    const middle = collapsed[1].display.get(flow.middle) ?? othersLabel;
    const target = collapsed[2].display.get(flow.target) ?? othersLabel;
    const key = `${source}\u0000${middle}\u0000${target}`;
    const previous = flows.get(key);
    if (previous) {
      previous.value += flow.value;
    } else {
      flows.set(key, { source, middle, target, value: flow.value });
    }
  }

  // ── Node values after collapsing (conserved: same total per column). ──
  const nodeValues: Array<Map<string, number>> = [
    new Map<string, number>(),
    new Map<string, number>(),
    new Map<string, number>(),
  ];
  let total = 0;
  for (const flow of flows.values()) {
    total += flow.value;
    addValue(nodeValues[0], flow.source, flow.value);
    addValue(nodeValues[1], flow.middle, flow.value);
    addValue(nodeValues[2], flow.target, flow.value);
  }

  const columns = nodeValues.map((values) => rankLabels(values));

  // ── Colour assignment ──
  // Model (last-column) colours follow roster order when a roster is given
  // (stable across windows, idle included); otherwise value rank. Extra
  // models with traffic but no roster row take the slots after the roster.
  const modelColor = new Map<string, string>();
  const rosterIndex = new Map<string, number>();
  roster.forEach((entry) => {
    const label = entry.label;
    if (rosterIndex.has(label)) return;
    // The slot is the ASSIGNED position, not the raw array index: a
    // duplicated roster row must not skip a palette slot (which would
    // hand two different models the same colour).
    const slot = rosterIndex.size;
    rosterIndex.set(label, slot);
    modelColor.set(label, entry.color ?? palette[slot % palette.length]);
  });
  const unregistered = columns[2].filter((label) => !rosterIndex.has(label));
  unregistered.forEach((label, rank) => {
    modelColor.set(label, palette[(rosterIndex.size + rank) % palette.length]);
  });

  const sourceColor = new Map<string, string>();
  columns[0].forEach((label, rank) => sourceColor.set(label, palette[rank % palette.length]));
  const middleColor = new Map<string, string>();
  columns[1].forEach((label, rank) => middleColor.set(label, palette[rank % palette.length]));

  // ── Vertical scale: one scale for all three columns. ──
  const maxCount = Math.max(1, ...columns.map((labels) => labels.length));
  // Always ≥ 1: the fit clamp above guarantees the column fits, and the
  // 1-unit floor keeps `scale` strictly positive for any non-empty input.
  const usable = Math.max(
    1,
    height - PAD_Y * 2 - (maxCount - 1) * NODE_GAP - maxCount * MIN_NODE_HEIGHT,
  );
  const scale = total > 0 && Number.isFinite(total) ? usable / total : 0;

  const xForColumn = (column: number): number => {
    if (column === 0) return PAD_X;
    if (column === COLUMN_COUNT - 1) return width - PAD_X - NODE_WIDTH;
    return Math.round((width - NODE_WIDTH) / 2);
  };

  const nodes: HkUsageFlowNode[] = [];
  const nodeByColumn: Array<Map<string, HkUsageFlowNode>> = [
    new Map(),
    new Map(),
    new Map(),
  ];
  for (let column = 0; column < COLUMN_COUNT; column += 1) {
    const labels = columns[column];
    const x = xForColumn(column);
    let cursor = PAD_Y;
    for (const label of labels) {
      const value = nodeValues[column].get(label) ?? 0;
      const nodeHeight = Math.max(MIN_NODE_HEIGHT, value * scale);
      const node: HkUsageFlowNode = {
        key: `${column}:${label}`,
        label: truncateFlowLabel(label, labelMaxChars),
        fullLabel: label,
        column,
        value,
        x,
        y: px(cursor),
        width: NODE_WIDTH,
        height: px(nodeHeight),
        color:
          column === 2
            ? (modelColor.get(label) ?? palette[0])
            : column === 0
              ? (sourceColor.get(label) ?? palette[0])
              : (middleColor.get(label) ?? palette[0]),
        others: label === othersLabel && !collapsed[column].kept.has(label),
      };
      nodes.push(node);
      nodeByColumn[column].set(label, node);
      cursor += nodeHeight + NODE_GAP;
    }
  }

  // ── Ribbons: stack each node's links in the neighbour's vertical order so
  //    crossing is minimised, then accumulate the two sides independently
  //    (each side's stack sums to the node height — the conservation
  //    invariant). ──
  const links: HkUsageFlowLink[] = [];
  for (let stage = 0; stage < COLUMN_COUNT - 1; stage += 1) {
    const pairs = new Map<string, { left: string; right: string; value: number }>();
    for (const flow of flows.values()) {
      const left = stage === 0 ? flow.source : flow.middle;
      const right = stage === 0 ? flow.middle : flow.target;
      const key = `${left}\u0000${right}`;
      const previous = pairs.get(key);
      if (previous) {
        previous.value += flow.value;
      } else {
        pairs.set(key, { left, right, value: flow.value });
      }
    }
    const sourceNodes = nodeByColumn[stage];
    const targetNodes = nodeByColumn[stage + 1];
    const outgoing = new Map<string, Array<{ left: string; right: string; value: number }>>();
    const incoming = new Map<string, Array<{ left: string; right: string; value: number }>>();
    for (const pair of pairs.values()) {
      if (!outgoing.has(pair.left)) outgoing.set(pair.left, []);
      outgoing.get(pair.left)!.push(pair);
      if (!incoming.has(pair.right)) incoming.set(pair.right, []);
      incoming.get(pair.right)!.push(pair);
    }
    const startCursor = new Map<string, number>();
    for (const [label, node] of sourceNodes) {
      const items = (outgoing.get(label) ?? []).sort((a, b) => {
        const ay = targetNodes.get(a.right)?.y ?? 0;
        const by = targetNodes.get(b.right)?.y ?? 0;
        return ay - by;
      });
      let cursor = node.y;
      for (const item of items) {
        startCursor.set(`${item.left}\u0000${item.right}`, cursor);
        // The slot is the EXACT scaled value — never the floored bar
        // height — so the stack sums to `value × scale` on both sides.
        cursor += item.value * scale;
      }
    }
    const endCursor = new Map<string, number>();
    for (const [label, node] of targetNodes) {
      const items = (incoming.get(label) ?? []).sort((a, b) => {
        const ay = sourceNodes.get(a.left)?.y ?? 0;
        const by = sourceNodes.get(b.left)?.y ?? 0;
        return ay - by;
      });
      let cursor = node.y;
      for (const item of items) {
        endCursor.set(`${item.left}\u0000${item.right}`, cursor);
        cursor += item.value * scale;
      }
    }
    const ordered = [...pairs.values()].sort((a, b) => {
      const ay = sourceNodes.get(a.left)?.y ?? 0;
      const by = sourceNodes.get(b.left)?.y ?? 0;
      if (ay !== by) return ay - by;
      const at = targetNodes.get(a.right)?.y ?? 0;
      const bt = targetNodes.get(b.right)?.y ?? 0;
      if (at !== bt) return at - bt;
      return a.right < b.right ? -1 : a.right > b.right ? 1 : 0;
    });
    for (const pair of ordered) {
      const source = sourceNodes.get(pair.left);
      const target = targetNodes.get(pair.right);
      if (!source || !target) continue;
      const thickness = pair.value * scale;
      const y0 = startCursor.get(`${pair.left}\u0000${pair.right}`) ?? source.y;
      const y1 = endCursor.get(`${pair.left}\u0000${pair.right}`) ?? target.y;
      links.push({
        key: `${source.key}->${target.key}`,
        sourceKey: source.key,
        targetKey: target.key,
        value: pair.value,
        path: ribbonPath(source.x + source.width, y0, target.x, y1, thickness),
        color: target.color,
        thickness,
        startY: px(y0),
        endY: px(y1),
      });
    }
  }

  // ── Legend: roster order first (idle rows included), then unregistered
  //    models that served traffic, then the collapsed bucket. ──
  const targetValues = nodeValues[2];
  const legend: HkUsageFlowLegendRow[] = [];
  const seen = new Set<string>();
  for (const entry of roster) {
    const label = entry.label;
    if (seen.has(label)) continue;
    seen.add(label);
    const value = targetValues.get(label) ?? 0;
    legend.push({
      label,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
      color: modelColor.get(label) ?? palette[(rosterIndex.get(label) ?? 0) % palette.length],
      idle: value <= 0,
      others: false,
    });
  }
  const extra = columns[2]
    .filter((label) => !seen.has(label))
    .sort((a, b) => (targetValues.get(b) ?? 0) - (targetValues.get(a) ?? 0) || (a < b ? -1 : a > b ? 1 : 0));
  for (const label of extra) {
    const value = targetValues.get(label) ?? 0;
    legend.push({
      label,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
      color: modelColor.get(label) ?? palette[0],
      idle: value <= 0,
      // Same guard as the node path: a kept model that happens to be
      // labelled like the fold bucket is a REAL model, not the bucket.
      others: label === othersLabel && !collapsed[2].kept.has(label),
    });
  }

  return { width, height, nodes, links, legend, total, empty };
}

/** Share as the visible string: whole percents, with `<1%` for a real but
 *  sub-percent slice and `0%` for nothing. */
export function formatFlowPercent(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return "0%";
  if (percent < 1) return "<1%";
  return `${Math.round(percent)}%`;
}
