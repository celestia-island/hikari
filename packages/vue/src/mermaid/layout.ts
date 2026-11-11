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
  MermaidNodeShape,
} from "./types";

// ── Model ────────────────────────────────────────────────────────────

export type MermaidNodeKind =
  | "shape" // graph node (shape + label via data)
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
  data: Record<string, unknown>;
}

export interface LaidOutEdge {
  id: string;
  from: string;
  to: string;
  /** Board route style; bezier = mermaid flowchart feel. */
  style: "straight" | "bezier" | "orthogonal";
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

/** Longest-path ranking (Kahn order; cycle leftovers keep their current
 * rank) — a port of ratatui-markdown `assign_layers` with the same
 * "roots at 0, edge pushes target to max(cur, src+1)" semantics.
 * Self-edges are ignored, duplicate edges counted once. */
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
  direction: MermaidGraphDoc["direction"];
}

export interface GraphLayoutOutput {
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

/** Rank + barycenter-order + pixel-place a node-edge graph. */
export function layoutGraph(input: GraphLayoutInput): GraphLayoutOutput {
  const { items, edges, direction } = input;
  const horizontal = direction === "LR" || direction === "RL";
  const reversed = direction === "BT" || direction === "RL";

  const rank = rankNodes(
    items.map((i) => i.id),
    edges,
  );
  let maxRank = 0;
  for (const r of rank.values()) maxRank = Math.max(maxRank, r);
  const rankOf = (id: string): number => {
    const r = rank.get(id) ?? 0;
    return reversed ? maxRank - r : r;
  };

  // Group into ranks, keep parse order inside each rank.
  const rankMembers = new Map<number, GraphItem[]>();
  for (const item of items) {
    const r = rankOf(item.id);
    const bucket = rankMembers.get(r) ?? [];
    bucket.push(item);
    rankMembers.set(r, bucket);
  }

  // Barycenter ordering: for every rank ≥ 1 (in rank order), sort members
  // by the mean cross-position of their rank-1 neighbors (stable on
  // parse order). Two sweeps would be marginally better; one keeps the
  // code honest and is enough for report-sized diagrams.
  const crossPos = new Map<string, number>();
  const orderedRanks = [...rankMembers.keys()].sort((a, b) => a - b);
  for (const r of orderedRanks) {
    const members = (rankMembers.get(r) as GraphItem[]).slice().sort((a, b) => a.order - b.order);
    members.forEach((m, i) => crossPos.set(m.id, i));
  }
  const neighborsBelow = (id: string): string[] => {
    const out: string[] = [];
    for (const e of edges) {
      if (e.to === id && e.from !== id) out.push(e.from);
      if (e.from === id && e.to !== id) out.push(e.to);
    }
    return out;
  };
  for (const r of orderedRanks) {
    if (r === 0) continue;
    const members = (rankMembers.get(r) as GraphItem[]).slice().sort((a, b) => a.order - b.order);
    members.forEach((m, i) => crossPos.set(m.id, i));
    members.sort((a, b) => {
      const bary = (id: string): number => {
        const vals = neighborsBelow(id)
          .filter((nid) => rankOf(nid) === r - 1)
          .map((nid) => crossPos.get(nid))
          .filter((v): v is number => v !== undefined);
        return vals.length === 0 ? Number.MAX_SAFE_INTEGER : vals.reduce((s, v) => s + v, 0) / vals.length;
      };
      const ba = bary(a.id);
      const bb = bary(b.id);
      if (ba !== bb) return ba - bb;
      return a.order - b.order;
    });
    members.forEach((m, i) => crossPos.set(m.id, i));
    rankMembers.set(r, members);
  }

  // Pixel geometry: rank band = max main size + gap; each rank's block
  // centered on the cross axis.
  const mainSize = (i: GraphItem): number => (horizontal ? i.w : i.h);
  const crossSize = (i: GraphItem): number => (horizontal ? i.h : i.w);
  const crossSpanOf = (members: GraphItem[]): number =>
    members.reduce((s, m) => s + crossSize(m), 0) + GAP_SAME_RANK * Math.max(members.length - 1, 0);

  let totalCross = 0;
  for (const members of rankMembers.values()) totalCross = Math.max(totalCross, crossSpanOf(members));

  const positions = new Map<string, { x: number; y: number }>();
  let mainOffset = MARGIN;
  let width = 0;
  let height = 0;
  for (const r of orderedRanks) {
    const members = rankMembers.get(r) as GraphItem[];
    const rankMain = members.reduce((m, i) => Math.max(m, mainSize(i)), 0);
    let cross = MARGIN + (totalCross - crossSpanOf(members)) / 2;
    for (const m of members) {
      const mainLead = (rankMain - mainSize(m)) / 2;
      const p = horizontal
        ? { x: mainOffset + mainLead, y: cross }
        : { x: cross, y: mainOffset + mainLead };
      positions.set(m.id, { x: Math.round(p.x), y: Math.round(p.y) });
      cross += crossSize(m) + GAP_SAME_RANK;
      width = Math.max(width, p.x + m.w);
      height = Math.max(height, p.y + m.h);
    }
    mainOffset += rankMain + GAP_RANK;
  }

  return { positions, width: width + MARGIN, height: height + MARGIN };
}

// ── Flowchart / state ────────────────────────────────────────────────

function layoutGraphDoc(
  doc: MermaidGraphDoc,
  measure: MeasureText,
): { nodes: LaidOutNode[]; edges: LaidOutEdge[]; width: number; height: number } {
  const textH = measure("Ag", NODE_FONT) + 8;
  const items: GraphItem[] = doc.nodes.map((n, order) => {
    const { w, h } = shapeSize(n.shape, measure(n.label, NODE_FONT), textH);
    return { id: n.id, w, h, order };
  });
  const { positions, width, height } = layoutGraph({
    items,
    edges: doc.edges.map((e) => ({ from: e.source, to: e.target })),
    direction: doc.direction,
  });

  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const nodes: LaidOutNode[] = items.map((item) => {
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

  const edges: LaidOutEdge[] = doc.edges
    .filter((e) => e.source !== e.target)
    .map((e, i) => ({
      id: `e:${i}`,
      from: `n:${e.source}`,
      to: `n:${e.target}`,
      style: "bezier" as const,
      dashed: false,
      arrow: e.edgeType === "arrow" ? ("solid" as const) : ("none" as const),
      label: e.label,
    }));

  return { nodes, edges, width, height };
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

  const dashedRel = new Set(["dependency", "implements"]);
  const openRel = new Set(["aggregation", "implements"]);
  const noArrowRel = new Set(["association", "dependency"]);
  const arrowRel = new Set(["inheritance", "composition", "directed-association"]);
  const edges: LaidOutEdge[] = doc.relationships
    .filter((r: ClassRelationship) => known.has(r.from) && known.has(r.to) && r.from !== r.to)
    .map((r, i) => ({
      id: `e:${i}`,
      from: `n:${r.from}`,
      to: `n:${r.to}`,
      style: "bezier" as const,
      dashed: dashedRel.has(r.relType),
      arrow: noArrowRel.has(r.relType) ? ("none" as const) : openRel.has(r.relType) ? ("open" as const) : arrowRel.has(r.relType) ? ("solid" as const) : ("none" as const),
      label: r.label,
    }));

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
 * swallow a report (same spirit as the 62–70vh reading panes). */
function suggestHeight(contentH: number): number {
  return clampMin(Math.min(contentH + 24, 540), 200);
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
