/**
 * layout.ts — pure, deterministic layout for every MermaidDoc kind,
 * producing a board-ready node/edge model (x/y/w/h world rects plus the
 * payload the HkMermaidDiagram node slot renders).
 *
 * Determinism contract: same (doc, measure) in → same model out; stable
 * sorts only, no Date/random/canvas state beyond the injected measure.
 * The ranking math ports ratatui-markdown's `graph.rs` (`assign_layers`)
 * and adds barycenter ordering + pixel geometry the TUI renderer never
 * needed.
 *
 * Node ids are namespaced (`n:` graph/class nodes, `p:` participants,
 * `j:` junctions, `g:` gantt bars, `s:` section labels, `ax` the day
 * axis) so a doc can never collide two parts.
 */

import type {
  ClassMember,
  ClassRelationship,
  MermaidDoc,
  MermaidEdge,
  MermaidGraphDoc,
  MermaidDirection,
  MermaidGroup,
  MermaidNodeShape,
} from "./types";

// ── Model ────────────────────────────────────────────────────────────

export type MermaidNodeKind =
  | "shape" // graph node (shape + label via data)
  | "group" // subgraph cluster frame (paint-only, behind its members)
  | "participant"
  | "class"
  | "section"
  | "task"
  | "axis"
  | "pie"
  | "quadrant";

export interface LaidOutNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: MermaidNodeKind;
  /** Invisible junction — routes edges, paints nothing, no minimap box. */
  hidden?: boolean;
  /** Paint-only node: pointer gestures pass through to the board (cluster
   * frames must not eat the pan drag). */
  passthrough?: boolean;
  data: Record<string, unknown>;
}

/** The board anchor modes the mermaid layout asks for (a subset of the
 *  board's — see utils/boardEdges.ts BoardAnchorMode). */
export type MermaidAnchorMode = "center" | "nearest" | "top" | "bottom" | "left" | "right";

export interface LaidOutEdge {
  id: string;
  from: string;
  to: string;
  /** Board route style; bezier = mermaid flowchart feel. */
  style: "straight" | "bezier" | "orthogonal";
  /** Border anchors. A flow edge leaves through the side its source's rank
   *  stack grows toward and arrives through the opposite side of its target
   *  (a top-down flowchart: bottom → top), which is how mermaid.js docks
   *  them — and what keeps every arrowhead head-on for the border it lands
   *  on. An edge into a subgraph cluster lands on the frame's border
   *  (`nearest`), not on its center — the center sits behind the frame's own
   *  own members. */
  anchorFrom?: MermaidAnchorMode;
  anchorTo?: MermaidAnchorMode;
  dashed: boolean;
  arrow: "none" | "solid" | "open";
  label: string | null;
  via?: string[];
}

export interface MermaidBoardModel {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
  /** Suggested viewport height for auto-height hosts (clamped). */
  suggestedHeight: number;
}

export interface MeasureTextOpts {
  bold?: boolean;
  mono?: boolean;
}

export type MeasureText = (text: string, fontSize: number, opts?: MeasureTextOpts) => number;

// ── Text measurement ─────────────────────────────────────────────────

/** Char-class heuristic used when no 2D canvas exists (tests, SSR-ish
 * environments). Deliberately cheap and deterministic. */
export function heuristicTextWidth(text: string, fontSize: number, opts?: MeasureTextOpts): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const wide =
      (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
      (code >= 0x2e80 && code <= 0xa4cf) || // CJK radicals..Yi
      (code >= 0xac00 && code <= 0xd7a3) || // Hangul syllables
      (code >= 0xf900 && code <= 0xfaff) || // CJK compat ideographs
      (code >= 0xfe30 && code <= 0xfe4f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x3000 && code <= 0x303f);
    units += wide ? 1.0 : 0.55;
  }
  return units * fontSize * (opts?.bold ? 1.05 : 1);
}

/** Canvas-backed measure with heuristic fallback (happy-dom has no 2D
 * canvas → the fallback keeps tests deterministic). */
export function createCanvasMeasureText(): MeasureText {
  let ctx: CanvasRenderingContext2D | null | undefined;
  return (text, fontSize, opts) => {
    if (ctx === undefined) {
      try {
        ctx = document.createElement("canvas").getContext("2d");
      } catch {
        ctx = null;
      }
    }
    if (ctx) {
      ctx.font = `${opts?.bold ? "600 " : ""}${fontSize}px system-ui, sans-serif`;
      return ctx.measureText(text).width;
    }
    return heuristicTextWidth(text, fontSize, opts);
  };
}

// ── Shared geometry knobs ────────────────────────────────────────────

const NODE_FONT = 14;
const NODE_PAD_X = 16;
const NODE_PAD_Y = 11;
const GAP_SAME_RANK = 28;
const GAP_RANK = 56;
const MARGIN = 28;

const clampMin = (v: number, min: number): number => (v < min ? min : v);

function shapeSize(shape: MermaidNodeShape, labelWidth: number, textH: number): { w: number; h: number } {
  switch (shape) {
    case "circle":
      return { w: clampMin(labelWidth + 30, 56), h: clampMin(textH + 24, 56) };
    case "diamond":
      // The rotated square must contain the label box with margin.
      return { w: clampMin(labelWidth * 1.55 + 24, 72), h: clampMin(textH * 2.3 + 18, 56) };
    case "rounded":
    case "rect":
    default:
      return { w: clampMin(labelWidth + NODE_PAD_X * 2, 64), h: clampMin(textH + NODE_PAD_Y, 38) };
  }
}

// ── Graph-like layout (flowchart / state / class) ────────────────────

interface GraphItem {
  id: string;
  w: number;
  h: number;
  /** Original parse order — the stable tie-break everywhere. */
  order: number;
}

/** A rank member: a real node, or a VIRTUAL one — an invisible "lane" cell
 *  that an edge skipping ranks occupies in every rank between its ends (the
 *  dummy-node device dagre, and so mermaid.js, lay out with: the cell takes
 *  part in the ordering, so the real nodes of the ranks in between step
 *  aside and the edge runs down a clear lane). */
interface RankMember {
  id: string;
  w: number;
  h: number;
  order: number;
  virtual: null | {
    /** Index into the `edges` input. */
    edge: number;
    /** The lane's neighbours (lower visual rank first), by id and rank. */
    lower: { id: string; rank: number };
    upper: { id: string; rank: number };
  };
}

/** Cross-axis footprint of a lane cell, world px. */
const LANE_CROSS = 12;
/** Cross-axis clearance a lane cell keeps to its rank neighbours — a lane
 *  is not a box, it only needs the edge's stroke (and the arrowhead's
 *  width) to clear its neighbours. */
const LANE_GAP = 16;

interface RankedEdge {
  index: number;
  from: string;
  to: string;
}

/**
 * The edges to read AGAINST their direction so the graph becomes a DAG (a
 * feedback arc set), found by a depth-first search: an edge leading back
 * to a node still on the search stack closes a cycle. The search starts
 * from the true sources (fewest incoming edges first), then follows parse
 * order — a cluster's members are parsed before the node that feeds them,
 * and starting THERE turns the feeding edge into the "back" one (the
 * audit corpus 2026-11-27: `A --> B` came out below B).
 *
 * WHY (measured on the same corpus): the previous ranking ran Kahn's
 * algorithm on the raw graph, and Kahn's queue never reaches a node that
 * sits in or after a cycle — `Start → Is it? → OK → Rethink → Is it?`
 * ranked Start, OK, Rethink and End all at 0 and drew the decision diamond
 * BELOW its own outputs. Reading one edge of every cycle backwards is what
 * dagre (mermaid.js's engine) does; that edge is still DRAWN forwards
 * afterwards, docked around the side of the stack (see `flowAnchors`).
 * Returns the indexes of the edges to read backwards.
 */
export function feedbackArcSet(items: GraphItem[], edges: RankedEdge[]): Set<number> {
  const adjacency = new Map<string, RankedEdge[]>(items.map((i) => [i.id, []]));
  const indegree = new Map<string, number>(items.map((i) => [i.id, 0]));
  for (const e of edges) {
    adjacency.get(e.from)?.push(e);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(items.map((i) => [i.id, WHITE]));
  const back = new Set<number>();
  const roots = items.slice().sort((a, b) => (indegree.get(a.id) ?? 0) - (indegree.get(b.id) ?? 0) || a.order - b.order);
  for (const root of roots) {
    if (color.get(root.id) !== WHITE) continue;
    const stack: { id: string; next: number }[] = [{ id: root.id, next: 0 }];
    color.set(root.id, GRAY);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const row = adjacency.get(top.id) ?? [];
      if (top.next < row.length) {
        const e = row[top.next];
        top.next += 1;
        const c = color.get(e.to);
        if (c === WHITE) {
          color.set(e.to, GRAY);
          stack.push({ id: e.to, next: 0 });
        } else if (c === GRAY) {
          back.add(e.index);
        }
      } else {
        color.set(top.id, BLACK);
        stack.pop();
      }
    }
  }
  return back;
}

/** Longest-path ranking over a DAG (Kahn order): roots sit at 0, every
 *  edge pushes its target to `max(cur, src + 1)`. Same edge/duplicate
 *  semantics as the ratatui-markdown `assign_layers` it ports — on a graph
 *  that still has cycles the queue stalls (see `feedbackArcSet`). Self-edges
 *  and duplicate edges are ignored. */
function rankNodes(ids: string[], edges: Array<{ from: string; to: string }>): Map<string, number> {
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  const seen = new Set<string>();
  for (const e of edges) {
    const key = `${e.from}\u0000${e.to}`;
    if (seen.has(key) || e.from === e.to) continue;
    seen.add(key);
    adj.get(e.from)?.push(e.to);
    const d = indeg.get(e.to);
    if (d !== undefined) indeg.set(e.to, d + 1);
  }
  const queue: string[] = ids.filter((id) => (indeg.get(id) ?? 0) === 0);
  const queued = new Set(queue);
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const next of adj.get(cur) ?? []) {
      const nextRank = (rank.get(cur) ?? 0) + 1;
      if ((rank.get(next) ?? 0) < nextRank) rank.set(next, nextRank);
      const d = (indeg.get(next) ?? 1) - 1;
      indeg.set(next, d);
      if (d === 0 && !queued.has(next)) {
        queued.add(next);
        queue.push(next);
      }
    }
  }
  return rank;
}

export interface GraphLayoutInput {
  /** World-rect size per node id (already includes card chrome). */
  items: GraphItem[];
  edges: Array<{ from: string; to: string }>;
  direction: MermaidDirection;
  /** Cross-axis gap between same-rank siblings, world px. Cluster frames pad
   *  their members on both sides (and reserve a caption band on the stacked
   *  axis), so a grouped graph widens this budget — `GROUP_CROSS_GAP_H` for
   *  TD/BT, `GROUP_CROSS_GAP_V` for LR/RL — or neighbouring frames would
   *  touch and overlap. */
  crossGap?: number;
}

export interface GraphLane {
  /** Index into the `edges` input. */
  edge: number;
  /** The lane's world centers, from the rank after the lower end to the
   *  rank before the upper end (visual order). */
  points: Array<{ x: number; y: number }>;
}

export interface GraphLayoutOutput {
  positions: Map<string, { x: number; y: number }>;
  /** FLOW rank per node id — 0 is where the flow starts (the bottom for BT,
   *  the right for RL). An edge toward a higher flow rank points down the
   *  stack and docks on the stack-growing sides (see `flowAnchors`). */
  ranks: Map<string, number>;
  width: number;
  height: number;
  /** Lane cells, one entry per edge that skips ranks (edges read against
   *  their direction by the cycle breaker get none — they loop around the
   *  side instead). */
  lanes: GraphLane[];
  /** Indexes of the `edges` input the cycle breaker reads AGAINST their
   *  direction (the feedback arc set). The ranker never sees such an edge,
   *  so its source always lands in a HIGHER flow rank than its target —
   *  which is what makes it a back edge for docking. */
  backEdges: number[];
}

/** Rank + barycenter-order + pixel-place a node-edge graph. */
export function layoutGraph(input: GraphLayoutInput): GraphLayoutOutput {
  const { items, edges, direction, crossGap = GAP_SAME_RANK } = input;
  const horizontal = direction === "LR" || direction === "RL";
  const reversed = direction === "BT" || direction === "RL";

  const known = new Set(items.map((i) => i.id));
  const ranked: RankedEdge[] = [];
  edges.forEach((e, index) => {
    if (known.has(e.from) && known.has(e.to) && e.from !== e.to) ranked.push({ index, from: e.from, to: e.to });
  });
  const back = feedbackArcSet(items, ranked);
  const rank = rankNodes(
    items.map((i) => i.id),
    ranked.filter((e) => !back.has(e.index)),
  );
  let maxRank = 0;
  for (const r of rank.values()) maxRank = Math.max(maxRank, r);
  const visualRank = (id: string): number => (reversed ? maxRank - (rank.get(id) ?? 0) : (rank.get(id) ?? 0));

  // Lane cells for every edge that skips a rank.
  const members: RankMember[] = items.map((i) => ({ ...i, virtual: null }));
  const lanes: GraphLane[] = [];
  for (const e of ranked) {
    if (back.has(e.index)) continue;
    const ra = visualRank(e.from);
    const rb = visualRank(e.to);
    const lo = Math.min(ra, rb);
    const span = Math.abs(rb - ra);
    if (span <= 1) continue;
    const chain: Array<{ id: string; rank: number }> = [{ id: ra < rb ? e.from : e.to, rank: lo }];
    for (let k = 1; k < span; k += 1) chain.push({ id: `v:${e.index}:${k}`, rank: lo + k });
    chain.push({ id: ra < rb ? e.to : e.from, rank: lo + span });
    for (let k = 1; k < span; k += 1) {
      members.push({
        id: chain[k].id,
        w: LANE_CROSS,
        h: LANE_CROSS,
        order: items.length + e.index,
        virtual: { edge: e.index, lower: chain[k - 1], upper: chain[k + 1] },
      });
    }
    lanes.push({ edge: e.index, points: [] });
  }
  const laneOfEdge = new Map<number, GraphLane>(lanes.map((lane) => [lane.edge, lane]));

  // Group into ranks; keep parse order inside each rank.
  const rankMembers = new Map<number, RankMember[]>();
  const rankOfMember = new Map<string, number>();
  for (const m of members) {
    const r = m.virtual ? m.virtual.lower.rank + 1 : visualRank(m.id);
    rankOfMember.set(m.id, r);
    const bucket = rankMembers.get(r) ?? [];
    bucket.push(m);
    rankMembers.set(r, bucket);
  }
  const orderedRanks = [...rankMembers.keys()].sort((a, b) => a - b);

  // Ordering adjacency: an edge ties its two ends (or, when it has a lane,
  // the cells of its lane, end to end); a member's barycenter is the mean
  // position of its neighbours in the rank the sweep looks at.
  const neighbors = new Map<string, string[]>(members.map((m) => [m.id, []]));
  const link = (a: string, b: string): void => {
    neighbors.get(a)?.push(b);
    neighbors.get(b)?.push(a);
  };
  for (const e of ranked) if (!laneOfEdge.has(e.index)) link(e.from, e.to);
  for (const m of members) {
    if (m.virtual) {
      link(m.id, m.virtual.lower.id);
      link(m.id, m.virtual.upper.id);
    }
  }
  const crossPos = new Map<string, number>();
  for (const r of orderedRanks) {
    const list = (rankMembers.get(r) as RankMember[]).sort((a, b) => a.order - b.order);
    list.forEach((m, i) => crossPos.set(m.id, i));
  }
  const bary = (id: string, toward: number): number | null => {
    const r = rankOfMember.get(id) ?? 0;
    const vals = (neighbors.get(id) ?? [])
      .filter((n) => rankOfMember.get(n) === r + toward)
      .map((n) => crossPos.get(n) ?? 0);
    return vals.length === 0 ? null : vals.reduce((sum, v) => sum + v, 0) / vals.length;
  };
  /** One barycenter sweep. A member with no neighbour on that side holds
   *  its slot (its current index is its own barycenter). */
  const sweep = (ranks: number[], toward: number): void => {
    for (const r of ranks) {
      const list = rankMembers.get(r) as RankMember[];
      list.sort((a, b) => {
        const ba = bary(a.id, toward) ?? crossPos.get(a.id) ?? 0;
        const bb = bary(b.id, toward) ?? crossPos.get(b.id) ?? 0;
        if (ba !== bb) return ba - bb;
        return a.order - b.order;
      });
      list.forEach((m, i) => crossPos.set(m.id, i));
    }
  };
  // Down, up, down: the first pass drags every rank under its upper
  // neighbour, the second pulls roots above their children, the third
  // settles the lanes straight.
  sweep(orderedRanks.slice(1), -1);
  sweep([...orderedRanks.slice(0, -1)].reverse(), 1);
  sweep(orderedRanks.slice(1), -1);

  // Pixel geometry: rank band = max main size + gap; each rank's block
  // centered on the cross axis.
  const mainSize = (m: RankMember): number => (horizontal ? m.w : m.h);
  const crossSize = (m: RankMember): number => (horizontal ? m.h : m.w);
  const gapBetween = (a: RankMember, b: RankMember): number => (a.virtual || b.virtual ? Math.min(LANE_GAP, crossGap) : crossGap);
  const crossSpanOf = (list: RankMember[]): number =>
    list.reduce((sum, m, i) => sum + crossSize(m) + (i < list.length - 1 ? gapBetween(m, list[i + 1]) : 0), 0);

  let totalCross = 0;
  for (const list of rankMembers.values()) totalCross = Math.max(totalCross, crossSpanOf(list));

  const positions = new Map<string, { x: number; y: number }>();
  let mainOffset = MARGIN;
  let width = 0;
  let height = 0;
  for (const r of orderedRanks) {
    const list = rankMembers.get(r) as RankMember[];
    const rankMain = list.reduce((m, i) => (i.virtual ? m : Math.max(m, mainSize(i))), 0);
    let cross = MARGIN + (totalCross - crossSpanOf(list)) / 2;
    for (let i = 0; i < list.length; i += 1) {
      const m = list[i];
      const mainLead = (rankMain - mainSize(m)) / 2;
      const p = horizontal
        ? { x: mainOffset + mainLead, y: cross }
        : { x: cross, y: mainOffset + mainLead };
      if (m.virtual) {
        const lane = laneOfEdge.get(m.virtual.edge);
        if (lane) {
          // The cell's center on BOTH axes: the main axis at the band's
          // middle (the cell has no extent there), the cross axis mid-slot.
          lane.points.push(
            horizontal
              ? { x: Math.round(mainOffset + rankMain / 2), y: Math.round(cross + crossSize(m) / 2) }
              : { x: Math.round(cross + crossSize(m) / 2), y: Math.round(mainOffset + rankMain / 2) },
          );
        }
      } else {
        positions.set(m.id, { x: Math.round(p.x), y: Math.round(p.y) });
        width = Math.max(width, p.x + m.w);
        height = Math.max(height, p.y + m.h);
      }
      cross += crossSize(m) + (i < list.length - 1 ? gapBetween(m, list[i + 1]) : 0);
    }
    mainOffset += rankMain + GAP_RANK;
  }

  const ranks = new Map<string, number>();
  for (const item of items) ranks.set(item.id, rank.get(item.id) ?? 0);
  return {
    positions,
    ranks,
    lanes,
    backEdges: ranked.filter((e) => back.has(e.index)).map((e) => e.index),
    width: width + MARGIN,
    height: height + MARGIN,
  };
}

// ── Subgraph clusters ────────────────────────────────────────────────

/** Padding between a cluster's frame and the content inside it, world px. */
const GROUP_PAD = 18;
/** Caption band reserved at the top of a cluster frame, world px. */
const GROUP_HEADER = 26;
/** Same-rank gap used when the graph has clusters — DIRECTION-AWARE, because
 *  the frame is not symmetric: it pads `GROUP_PAD` on every side and reserves
 *  `GROUP_HEADER` on top. Two TD siblings sit side by side, so they need
 *  `2 × GROUP_PAD` of channel; two LR/RL siblings sit one under the other and
 *  eat `2 × GROUP_PAD + GROUP_HEADER` (the upper frame's header band plus both
 *  pads). The plain 28px same-rank budget leaves either pair INSIDE each
 *  other, hence the extra 12px of visible channel on top of the real cost. */
const GROUP_CROSS_GAP_H = GROUP_PAD * 2 + 12; // 48 — TD / BT (side by side)
const GROUP_CROSS_GAP_V = GROUP_PAD * 2 + GROUP_HEADER + 12; // 74 — LR / RL (stacked)

interface Rect { x: number; y: number; w: number; h: number }

/** Depth of a cluster in the nesting chain (0 = top level). */
function groupDepth(groups: MermaidGroup[], id: string): number {
  let depth = 0;
  let cursor = groups.find((g) => g.id === id)?.parent ?? null;
  const seen = new Set<string>([id]);
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    depth += 1;
    cursor = groups.find((g) => g.id === cursor)?.parent ?? null;
  }
  return depth;
}

/**
 * Frame rects for every cluster that has content: the union of its member
 * rects (and its nested clusters' frames, computed first), padded, with a
 * caption band on top. `memberRects` is keyed by BOARD node id (`n:<id>`),
 * the same namespace the edges use; frames are keyed by cluster id.
 */
function layoutGroupFrames(
  groups: MermaidGroup[],
  memberRects: Map<string, Rect>,
): Map<string, Rect> {
  const frames = new Map<string, Rect>();
  // Deepest first: an outer frame unions the inner frame's rect, so nesting
  // widens the shell instead of drawing the two frames on top of each other.
  const ordered = [...groups].sort((a, b) => groupDepth(groups, b.id) - groupDepth(groups, a.id));
  for (const group of ordered) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const absorb = (r: Rect | undefined): void => {
      if (!r || r.w <= 0 || r.h <= 0) return;
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    };
    for (const member of group.members) absorb(memberRects.get(`n:${member}`));
    for (const child of groups) {
      if (child.parent === group.id) absorb(frames.get(child.id));
    }
    if (!Number.isFinite(minX)) continue;
    frames.set(group.id, {
      x: Math.round(minX - GROUP_PAD),
      y: Math.round(minY - GROUP_PAD - GROUP_HEADER),
      w: Math.round(maxX - minX + GROUP_PAD * 2),
      h: Math.round(maxY - minY + GROUP_PAD * 2 + GROUP_HEADER),
    });
  }
  return frames;
}

// ── Flowchart / state ──────────────────────────────────────────────────

/** The side of a node the rank stack grows toward, per flow direction: an
 *  edge toward a later rank LEAVES through it. */
const STACK_AHEAD: Record<MermaidDirection, MermaidAnchorMode> = {
  TD: "bottom",
  BT: "top",
  LR: "right",
  RL: "left",
};
/** The side an edge toward a later rank ARRIVES through (the target's side
 *  facing back up the stack). */
const STACK_BEHIND: Record<MermaidDirection, MermaidAnchorMode> = {
  TD: "top",
  BT: "bottom",
  LR: "left",
  RL: "right",
};
/** Cross-axis side a back edge loops around when its source has no free
 *  side to prefer (see `backEdgeSide`). */
const BACK_EDGE_SIDE: Record<MermaidDirection, MermaidAnchorMode> = {
  TD: "left",
  BT: "left",
  LR: "top",
  RL: "top",
};

/** How far a self-loop's corners stand off the node border (world px, along
 *  the border normal) and half the loop's length along the border. */
const SELF_LOOP_OUT = 26;
const SELF_LOOP_ALONG = 15;

function layoutGraphDoc(
  doc: MermaidGraphDoc,
  measure: MeasureText,
): { nodes: LaidOutNode[]; edges: LaidOutEdge[]; width: number; height: number } {
  const textH = measure("Ag", NODE_FONT) + 8;
  const items: GraphItem[] = doc.nodes.map((n, order) => {
    const { w, h } = shapeSize(n.shape, measure(n.label, NODE_FONT), textH);
    return { id: n.id, w, h, order };
  });
  const groups = doc.groups ?? [];
  const horizontal = doc.direction === "LR" || doc.direction === "RL";
  // Ranking edges: an edge that addresses a cluster stands for an edge to
  // (or from) every node inside it — `C --> G` orders C before G's members
  // and `G --> D` after them, which is what a cluster edge means in
  // mermaid.js. (Fed to the ranker raw, the cluster id matches no node, the
  // edge vanishes from the ranking, and the node AFTER the cluster climbs
  // into the top rank — measured on the audit corpus 2026-11-27.)
  const endpointsOf = (id: string): string[] => {
    const group = groups.find((g) => g.id === id);
    return group ? group.members : [id];
  };
  const rankEdges: Array<{ from: string; to: string }> = [];
  /** For each doc edge, the rank edge that carries its lane (the first one
   *  it expanded to). */
  const rankEdgeOfDoc: number[] = [];
  doc.edges.forEach((e, i) => {
    for (const from of endpointsOf(e.source)) {
      for (const to of endpointsOf(e.target)) {
        if (from === to) continue;
        rankEdgeOfDoc[i] ??= rankEdges.length;
        rankEdges.push({ from, to });
      }
    }
  });
  const { positions, ranks, lanes, backEdges, width, height } = layoutGraph({
    items,
    edges: rankEdges,
    direction: doc.direction,
    ...(groups.length > 0
      ? { crossGap: horizontal ? GROUP_CROSS_GAP_V : GROUP_CROSS_GAP_H }
      : {}),
  });
  const laneOfRankEdge = new Map(lanes.map((lane) => [lane.edge, lane]));

  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const memberNodes: LaidOutNode[] = items.map((item) => {
    const p = positions.get(item.id) as { x: number; y: number };
    const meta = byId.get(item.id) as MermaidGraphDoc["nodes"][number];
    return {
      id: `n:${item.id}`,
      x: p.x,
      y: p.y,
      w: item.w,
      h: item.h,
      kind: "shape",
      data: { shape: meta.shape, label: meta.label },
    };
  });

  const frames = layoutGroupFrames(
    groups,
    new Map(memberNodes.map((n) => [n.id, { x: n.x, y: n.y, w: n.w, h: n.h }])),
  );

  // Shift everything right/down when a frame runs off the world origin. What
  // clips is the edge SVG: the board anchors it at (0,0) with the content
  // box's width/height, so a negative-coordinate path (or the frame shell
  // itself) is cut off. A cluster on the top rank starts `GROUP_PAD +
  // GROUP_HEADER` above its members, which is more than the layout's own
  // MARGIN.
  let shiftX = 0;
  let shiftY = 0;
  for (const frame of frames.values()) {
    shiftX = Math.max(shiftX, -frame.x);
    shiftY = Math.max(shiftY, -frame.y);
  }
  shiftX += shiftX > 0 ? MARGIN : 0;
  shiftY += shiftY > 0 ? MARGIN : 0;
  if (shiftX !== 0 || shiftY !== 0) {
    for (const n of memberNodes) {
      n.x += shiftX;
      n.y += shiftY;
    }
    for (const lane of lanes) {
      for (const pt of lane.points) {
        pt.x += shiftX;
        pt.y += shiftY;
      }
    }
    for (const [id, frame] of frames) {
      frames.set(id, { ...frame, x: frame.x + shiftX, y: frame.y + shiftY });
    }
  }

  // Frames paint BEHIND everything else: the board renders nodes in array
  // order, so outer clusters come first and nested ones follow.
  const groupNodes: LaidOutNode[] = [...groups]
    .filter((g) => frames.has(g.id))
    .sort((a, b) => groupDepth(groups, a.id) - groupDepth(groups, b.id))
    .map((g) => {
      const frame = frames.get(g.id) as Rect;
      return {
        id: `g:${g.id}`,
        x: frame.x,
        y: frame.y,
        w: frame.w,
        h: frame.h,
        kind: "group",
        passthrough: true,
        data: { label: g.label },
      };
    });

  // Invisible junctions the edges route through: the cells of every edge
  // lane, and the two corners of every self-loop.
  const junctions: LaidOutNode[] = [];
  const junction = (id: string, x: number, y: number): string => {
    junctions.push({ id, x: Math.round(x), y: Math.round(y), w: 0, h: 0, kind: "shape", hidden: true, data: {} });
    return id;
  };

  const nodes: LaidOutNode[] = [...groupNodes, ...memberNodes];

  // An edge may address a cluster (`C --> G`): mermaid paints the arrow onto
  // the frame, so redirect it to the frame's board node.
  const endpoint = (id: string): string => (frames.has(id) ? `g:${id}` : `n:${id}`);
  const ahead: MermaidAnchorMode = STACK_AHEAD[doc.direction];
  const behind: MermaidAnchorMode = STACK_BEHIND[doc.direction];
  const readBackwards = new Set(backEdges);
  /** Is doc edge `i` a BACK edge — one the cycle breaker reads against its
   *  direction? Docked on the stack-growing sides it would run straight
   *  through every rank between its ends, so it loops around the side
   *  instead (`backEdgeSide`), the way mermaid.js routes a retry. Membership
   *  in the feedback arc set IS the definition; "target in an earlier flow
   *  rank" is only the fallback for an edge that expanded to no rank edge. */
  const isBackEdge = (i: number, source: string, target: string): boolean => {
    const rankEdge = rankEdgeOfDoc[i];
    if (rankEdge !== undefined) return readBackwards.has(rankEdge);
    return (ranks.get(target) ?? 0) < (ranks.get(source) ?? 0);
  };
  /** Docking for an edge between two plain nodes, from the two ends' FLOW
   *  ranks. A back edge gets no stack docking — `backEdgeSide` picks its
   *  side. */
  const flowAnchors = (source: string, target: string): Pick<LaidOutEdge, "anchorFrom" | "anchorTo"> => {
    const rs = ranks.get(source);
    const rt = ranks.get(target);
    if (rs === undefined || rt === undefined) return {};
    if (rt > rs) return { anchorFrom: ahead, anchorTo: behind };
    if (rt < rs) return {};
    // Same rank: leave and arrive on the cross-axis sides that face each other.
    const a = positions.get(source);
    const b = positions.get(target);
    if (!a || !b) return {};
    return horizontal
      ? a.y <= b.y
        ? { anchorFrom: "bottom", anchorTo: "top" }
        : { anchorFrom: "top", anchorTo: "bottom" }
      : a.x <= b.x
        ? { anchorFrom: "right", anchorTo: "left" }
        : { anchorFrom: "left", anchorTo: "right" };
  };
  /** A self-loop (`A --> A`) leaves and re-enters the same border midpoint,
   *  around two corners standing off it. The route's end tangents are the
   *  border normal (HkBoard docks them), so both ends stay head-on. */
  const selfLoop = (i: number, rect: Rect): Pick<LaidOutEdge, "anchorFrom" | "anchorTo" | "via"> => {
    const side: MermaidAnchorMode = horizontal ? "bottom" : "right";
    const s = side === "right" ? { x: rect.x + rect.w, y: rect.y + rect.h / 2 } : { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    const n = side === "right" ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const t = side === "right" ? { x: 0, y: 1 } : { x: 1, y: 0 };
    const a = junction(`j:loop:${i}:a`, s.x + n.x * SELF_LOOP_OUT - t.x * SELF_LOOP_ALONG, s.y + n.y * SELF_LOOP_OUT - t.y * SELF_LOOP_ALONG);
    const b = junction(`j:loop:${i}:b`, s.x + n.x * SELF_LOOP_OUT + t.x * SELF_LOOP_ALONG, s.y + n.y * SELF_LOOP_OUT + t.y * SELF_LOOP_ALONG);
    return { anchorFrom: side, anchorTo: side, via: [a, b] };
  };
  const rectOf = new Map(memberNodes.map((n) => [n.id.slice(2), n]));
  /** The cross-axis side a back edge loops around: the one its SOURCE has
   *  free. A node with a same-rank sibling on its left loops right (and
   *  vice versa), so the loop clears the sibling — `wait` sitting beside
   *  `run` loops around `wait`'s outside, not through `run` (the audit
   *  corpus 2026-11-27; mermaid.js routes it the same way). */
  const backEdgeSide = (source: string): MermaidAnchorMode => {
    const r = ranks.get(source);
    const p = positions.get(source);
    if (r === undefined || !p) return BACK_EDGE_SIDE[doc.direction];
    let lower = false;
    let higher = false;
    for (const [other, q] of positions) {
      if (other === source || ranks.get(other) !== r) continue;
      if (horizontal ? q.y < p.y : q.x < p.x) lower = true;
      else higher = true;
    }
    if (horizontal) {
      if (lower && !higher) return "bottom";
      if (higher && !lower) return "top";
      return BACK_EDGE_SIDE[doc.direction];
    }
    if (lower && !higher) return "right";
    if (higher && !lower) return "left";
    return BACK_EDGE_SIDE[doc.direction];
  };
  const edges: LaidOutEdge[] = doc.edges.map((e, i) => {
    const back = isBackEdge(i, e.source, e.target);
    const loop = e.source === e.target && !frames.has(e.source) ? rectOf.get(e.source) : undefined;
    if (loop) {
      return {
        id: `e:${i}`,
        from: `n:${e.source}`,
        to: `n:${e.source}`,
        style: "bezier" as const,
        ...selfLoop(i, { x: loop.x, y: loop.y, w: loop.w, h: loop.h }),
        dashed: false,
        arrow: e.edgeType === "arrow" ? ("solid" as const) : ("none" as const),
        label: e.label,
      };
    }
    // An edge skipping ranks runs down its lane (the cells the ranker reserved
    // for it), unless an end is a cluster frame — a frame's `nearest` dock
    // sits on the frame border, not on the lane's end. A back edge has no
    // lane: the ranker never saw it.
    const rankEdge = rankEdgeOfDoc[i];
    const lane = rankEdge === undefined ? undefined : laneOfRankEdge.get(rankEdge);
    const via = lane && !frames.has(e.source) && !frames.has(e.target)
      ? lane.points.map((pt, k) => junction(`j:e${i}:${k}`, pt.x, pt.y))
      : undefined;
    return {
      id: `e:${i}`,
      from: endpoint(e.source),
      to: endpoint(e.target),
      style: "bezier" as const,
      ...flowAnchors(e.source, e.target),
      ...(back && !frames.has(e.source) && !frames.has(e.target)
        ? { anchorFrom: backEdgeSide(e.source), anchorTo: backEdgeSide(e.source) }
        : {}),
      ...(frames.has(e.source) ? { anchorFrom: "nearest" as const } : {}),
      ...(frames.has(e.target) ? { anchorTo: "nearest" as const } : {}),
      ...(via && via.length > 0 ? { via } : {}),
      dashed: false,
      arrow: e.edgeType === "arrow" ? ("solid" as const) : ("none" as const),
      label: e.label,
    };
  });

  junctions.forEach((j) => nodes.push(j));

  // The frames extend past the member bbox the graph pass measured.
  let outWidth = width;
  let outHeight = height;
  for (const frame of frames.values()) {
    outWidth = Math.max(outWidth, frame.x + frame.w + MARGIN);
    outHeight = Math.max(outHeight, frame.y + frame.h + MARGIN);
  }

  return { nodes, edges, width: outWidth, height: outHeight };
}

// ── Sequence ─────────────────────────────────────────────────────────

const SEQ_HEADER_H = 40;
const SEQ_COL_GAP = 48;
const SEQ_ROW_STEP = 44;

function layoutSequence(
  doc: Extract<MermaidDoc, { kind: "sequence" }>,
  measure: MeasureText,
): { nodes: LaidOutNode[]; edges: LaidOutEdge[]; width: number; height: number } {
  const centerX = new Map<string, number>();
  let x = MARGIN;
  const headerNodes: LaidOutNode[] = [];
  for (const p of doc.participants) {
    const w = clampMin(measure(p, NODE_FONT, { bold: true }) + 36, 96);
    centerX.set(p, x + w / 2);
    headerNodes.push({ id: `p:${p}`, x, y: MARGIN, w, h: SEQ_HEADER_H, kind: "participant", data: { label: p } });
    x += w + SEQ_COL_GAP;
  }
  const width = x - SEQ_COL_GAP + MARGIN;

  const nodes = [...headerNodes];
  const edges: LaidOutEdge[] = [];
  const firstRowY = MARGIN + SEQ_HEADER_H + 34;
  const bottomY = firstRowY + Math.max(doc.messages.length - 1, 0) * SEQ_ROW_STEP + MARGIN;

  // Lifelines: a dashed vertical edge under every header. The SVG edge
  // layer paints UNDER the node shells, so the segment inside the header
  // box is covered and the visible line starts at the header's foot.
  for (const p of doc.participants) {
    const cx = centerX.get(p) as number;
    nodes.push({ id: `j:life:${p}`, x: cx, y: bottomY, w: 0, h: 0, kind: "participant", hidden: true, data: {} });
    edges.push({ id: `e:life:${p}`, from: `p:${p}`, to: `j:life:${p}`, style: "straight", dashed: true, arrow: "none", label: null });
  }

  doc.messages.forEach((msg, i) => {
    const fromX = centerX.get(msg.from) ?? MARGIN;
    const toX = centerX.get(msg.to) ?? MARGIN;
    const rowY = firstRowY + i * SEQ_ROW_STEP;
    const dashed = msg.arrowKind === "dotted" || msg.arrowKind === "dotted-open";
    const arrow = msg.arrowKind === "solid" || msg.arrowKind === "dotted" ? "solid" : "open";
    if (msg.from === msg.to) {
      // Self-message loop: junctions jog right of the lane and back.
      const jog = 44;
      nodes.push(
        { id: `j:m:${i}:a`, x: fromX + jog, y: rowY - 16, w: 0, h: 0, kind: "participant", hidden: true, data: {} },
        { id: `j:m:${i}:b`, x: fromX + jog, y: rowY + 16, w: 0, h: 0, kind: "participant", hidden: true, data: {} },
        { id: `j:m:${i}:f`, x: fromX, y: rowY, w: 0, h: 0, kind: "participant", hidden: true, data: {} },
      );
      edges.push({
        id: `e:m:${i}`,
        from: `j:m:${i}:f`,
        to: `j:m:${i}:f`,
        style: "straight",
        dashed,
        arrow,
        label: msg.text,
        via: [`j:m:${i}:a`, `j:m:${i}:b`],
      });
    } else {
      nodes.push(
        { id: `j:m:${i}:f`, x: fromX, y: rowY, w: 0, h: 0, kind: "participant", hidden: true, data: {} },
        { id: `j:m:${i}:t`, x: toX, y: rowY, w: 0, h: 0, kind: "participant", hidden: true, data: {} },
      );
      edges.push({ id: `e:m:${i}`, from: `j:m:${i}:f`, to: `j:m:${i}:t`, style: "straight", dashed, arrow, label: msg.text });
    }
  });

  return { nodes, edges, width, height: bottomY + MARGIN };
}

// ── Class ────────────────────────────────────────────────────────────

const CLASS_MEMBER_FONT = 12.5;
const CLASS_LINE_H = 20;

const memberLine = (m: ClassMember): string =>
  m.isMethod
    ? m.typeInfo ? `${m.name}(): ${m.typeInfo}` : `${m.name}()`
    : m.typeInfo ? `${m.name}: ${m.typeInfo}` : m.name;

function layoutClass(
  doc: Extract<MermaidDoc, { kind: "class" }>,
  measure: MeasureText,
): { nodes: LaidOutNode[]; edges: LaidOutEdge[]; width: number; height: number } {
  const cards = doc.classes.map((cls) => {
    const lines = [...cls.attributes, ...cls.methods].map(memberLine);
    const textW = Math.max(
      measure(cls.name, NODE_FONT, { bold: true }),
      ...(lines.length > 0 ? lines.map((l) => measure(l, CLASS_MEMBER_FONT, { mono: true })) : [0]),
      88,
    );
    return { cls, w: Math.ceil(textW) + 28, h: 36 + lines.length * CLASS_LINE_H + 12 };
  });

  const cardById = new Map(cards.map((c) => [c.cls.name, c]));
  const items: GraphItem[] = cards.map((c, order) => ({ id: c.cls.name, w: c.w, h: c.h, order }));
  const { positions, width, height } = layoutGraph({ items, edges: doc.relationships, direction: "TD" });

  const known = new Set(cards.map((c) => c.cls.name));
  const nodes: LaidOutNode[] = cards
    .filter((c) => positions.has(c.cls.name))
    .map((c) => {
      const p = positions.get(c.cls.name) as { x: number; y: number };
      return { id: `n:${c.cls.name}`, x: p.x, y: p.y, w: c.w, h: c.h, kind: "class" as const, data: { cls: c.cls } };
    });

  // Adornment semantics (R4 finding 2): mermaid puts the `<|`/`*`/`o`/
  // `<` glyphs at the FROM class — the rendered edge SWAPS its ends for
  // arrowAt === "from" so marker-end lands there, while the RANKING
  // above keeps the parsed from→to direction (parent above child).
  const dashedRel = new Set(["dependency", "implements"]);
  const openAdorn = new Set(["inheritance", "aggregation", "implements", "dependency"]);
  const edges: LaidOutEdge[] = doc.relationships
    .filter((r: ClassRelationship) => known.has(r.from) && known.has(r.to) && r.from !== r.to)
    .map((r, i) => {
      const swap = r.arrowAt === "from";
      const arrow: LaidOutEdge["arrow"] =
        r.arrowAt === "none" ? "none" : openAdorn.has(r.relType) ? "open" : "solid";
      return {
        id: `e:${i}`,
        from: swap ? `n:${r.to}` : `n:${r.from}`,
        to: swap ? `n:${r.from}` : `n:${r.to}`,
        style: "bezier" as const,
        dashed: dashedRel.has(r.relType),
        arrow,
        label: r.label,
      };
    });

  return { nodes, edges, width, height };
}

// ── Gantt ────────────────────────────────────────────────────────────

function parseDays(duration: string | null): number {
  if (!duration) return 1;
  const m = /^(\d+(?:\.\d+)?)([hdw])$/.exec(duration.trim());
  if (!m) return 1;
  const v = Number(m[1]);
  if (m[2] === "h") return Math.max(v / 24, 0.2);
  if (m[2] === "w") return v * 7;
  return v;
}

function layoutGantt(
  doc: Extract<MermaidDoc, { kind: "gantt" }>,
  measure: MeasureText,
): { nodes: LaidOutNode[]; edges: LaidOutEdge[]; width: number; height: number } {
  const dayW = 30;
  const rowH = 34;
  const nameFont = 13;

  // Earliest-start scheduling: deps push the start; a task without deps
  // continues its section cursor (mermaid's implicit sequencing).
  const ends = new Map<string, number>();
  let maxDay = 0;
  interface Row {
    section: string;
    name: string;
    start: number;
    days: number;
    id: string | null;
    deps: string[];
  }
  const rows: Row[] = [];
  for (const sec of doc.sections) {
    let cursor = 0;
    for (const task of sec.tasks) {
      const key = task.id ?? task.name;
      let start = cursor;
      for (const dep of task.deps) {
        const depEnd = ends.get(dep);
        if (depEnd !== undefined) start = Math.max(start, depEnd);
      }
      const days = parseDays(task.duration);
      const end = start + days;
      ends.set(key, end);
      maxDay = Math.max(maxDay, end);
      rows.push({ section: sec.name, name: task.name, start, days, id: task.id, deps: task.deps });
      cursor = end;
    }
  }

  const nameCol = clampMin(Math.max(...rows.map((r) => measure(r.name, nameFont)), 80) + 20, 120);
  const axisH = 30;
  const nodes: LaidOutNode[] = [];
  const edges: LaidOutEdge[] = [];

  // Day axis: one custom node; tick cadence clamped so the axis stays
  // readable for long charts.
  const totalDays = Math.max(Math.ceil(maxDay), 1);
  const ticks: number[] = [];
  const step = Math.max(1, Math.ceil(totalDays / 12));
  for (let d = 0; d <= totalDays; d += step) ticks.push(d);
  const axisW = Math.max(totalDays * dayW, 60);

  // Chart title (when present) as a spanning header row above the axis —
  // the Rust renderer paints it too, and a titled chart losing its title
  // reads as data loss (R2 finding 7).
  let topY = MARGIN;
  if (doc.title !== null) {
    nodes.push({ id: "gt", x: MARGIN, y: topY, w: nameCol + axisW - 10, h: 26, kind: "section", data: { label: doc.title, header: true } });
    topY += 32;
  }
  nodes.push({ id: "ax", x: nameCol, y: topY, w: axisW, h: axisH, kind: "axis", data: { ticks, dayW, unit: "d" } });

  // Rows: a header line whenever the section changes, then the task bar.
  let y = topY + axisH;
  let lastSection: string | null = null;
  rows.forEach((r, i) => {
    if (r.section !== lastSection) {
      lastSection = r.section;
      if (r.section !== "") {
        nodes.push({
          id: `s:${i}`,
          x: MARGIN,
          y,
          w: nameCol + axisW - 10,
          h: 24,
          kind: "section",
          data: { label: r.section, header: true },
        });
        y += 30;
      }
    }
    nodes.push({
      id: `g:name:${i}`,
      x: MARGIN,
      y: y + 3,
      w: nameCol - MARGIN - 10,
      h: 24,
      kind: "section",
      data: { label: r.name, subtle: true },
    });
    nodes.push({
      id: `g:${i}`,
      x: nameCol + r.start * dayW,
      y,
      w: Math.max(r.days * dayW, 22),
      h: rowH - 8,
      kind: "task",
      data: { label: r.days >= 1 ? `${r.days}d` : r.name, name: r.name, start: r.start, days: r.days },
    });
    y += rowH;
  });

  // Dependency arrows: bar end → dependent bar start.
  rows.forEach((r, i) => {
    for (const dep of r.deps) {
      const depRow = rows.findIndex((o, oi) => oi !== i && (o.id ?? o.name) === dep);
      if (depRow >= 0) {
        edges.push({ id: `e:dep:${i}:${dep}`, from: `g:${depRow}`, to: `g:${i}`, style: "bezier", dashed: true, arrow: "solid", label: null });
      }
    }
  });

  const width = nameCol + axisW + MARGIN;
  return { nodes, edges, width, height: y + MARGIN };
}

// ── Pie & quadrant (single custom-painter cards) ─────────────────────

function layoutPie(doc: Extract<MermaidDoc, { kind: "pie" }>): { nodes: LaidOutNode[]; width: number; height: number } {
  const w = 560;
  const h = clampMin(52 + doc.slices.length * 24 + 16, 240);
  return {
    nodes: [{ id: "pie", x: MARGIN, y: MARGIN, w, h, kind: "pie", data: { doc } }],
    width: w + MARGIN * 2,
    height: h + MARGIN * 2,
  };
}

function layoutQuadrant(doc: Extract<MermaidDoc, { kind: "quadrant" }>): { nodes: LaidOutNode[]; width: number; height: number } {
  const w = 540;
  const h = 420;
  return {
    nodes: [{ id: "quad", x: MARGIN, y: MARGIN, w, h, kind: "quadrant", data: { doc } }],
    width: w + MARGIN * 2,
    height: h + MARGIN * 2,
  };
}

// ── Entry ────────────────────────────────────────────────────────────

/** Suggested component height: tall enough to read, short enough not to
 * swallow a report (same spirit as the 62–70vh reading panes).
 *
 * The 720px ceiling is a READABILITY floor in disguise: the board fits the
 * whole diagram into whatever height it is given, and the old 540px cap
 * parked the ten-node top-down flowchart of docs.celestia.world at 62% —
 * its 14px labels drawn at 8.7px, next to the real mermaid.js lane
 * rendering the same source at 100% (measured 2026-11-27, 786px card).
 * 720px lifts that card to 80% (11.2px labels); anything taller is a
 * scroll-or-zoom decision the reader can still make on the board itself. */
const SUGGESTED_HEIGHT_MAX = 720;
function suggestHeight(contentH: number): number {
  return clampMin(Math.min(contentH + 24, SUGGESTED_HEIGHT_MAX), 200);
}

export function buildBoardModel(doc: MermaidDoc, measure: MeasureText): MermaidBoardModel {
  switch (doc.kind) {
    case "graph": {
      const { nodes, edges, width, height } = layoutGraphDoc(doc, measure);
      return { nodes, edges, width, height, suggestedHeight: suggestHeight(height) };
    }
    case "sequence": {
      const { nodes, edges, width, height } = layoutSequence(doc, measure);
      return { nodes, edges, width, height, suggestedHeight: suggestHeight(height) };
    }
    case "class": {
      const { nodes, edges, width, height } = layoutClass(doc, measure);
      return { nodes, edges, width, height, suggestedHeight: suggestHeight(height) };
    }
    case "gantt": {
      const { nodes, edges, width, height } = layoutGantt(doc, measure);
      return { nodes, edges, width, height, suggestedHeight: suggestHeight(height) };
    }
    case "pie": {
      const { nodes, width, height } = layoutPie(doc);
      return { nodes, edges: [], width, height, suggestedHeight: suggestHeight(height) };
    }
    case "quadrant": {
      const { nodes, width, height } = layoutQuadrant(doc);
      return { nodes, edges: [], width, height, suggestedHeight: suggestHeight(height) };
    }
  }
}
