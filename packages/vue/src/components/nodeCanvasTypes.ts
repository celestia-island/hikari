/**
 * nodeCanvasTypes.ts — Shared types for the HkNodeCanvas rendering base.
 *
 * These types are consumed by views (network topology, ladder diagram,
 * mind map) that build on HkNodeCanvas. They are framework-agnostic
 * (no Vue imports) so they can be used in pure computation modules too.
 */

// ── Camera & Bounds (re-exported from the main component) ────────────────

export interface NodeCanvasCamera {
  /** Zoom factor (1 = 1:1). */
  k: number;
  /** Translation of the content origin, in screen pixels. */
  x: number;
  /** Translation of the content origin, in screen pixels. */
  y: number;
}

export interface NodeCanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NodeCanvasSlotProps {
  camera: NodeCanvasCamera;
  viewport: { width: number; height: number };
  contentBounds: NodeCanvasBounds | null;
}

// ── Level of Detail ──────────────────────────────────────────────────────

/** Level of detail, derived from the camera zoom factor. */
export type LodLevel = "high" | "medium" | "low";

/** Zoom thresholds: at or above `medium` shows full detail, at or above
 *  `low` shows outlines + labels, below `low` shows outlines only. */
export interface LodThresholds {
  medium: number;
  low: number;
}

export const LOD_DEFAULTS: LodThresholds = {
  medium: 0.45,
  low: 0.18,
};

/** Compute the LOD level from a zoom factor and thresholds. */
export function computeLod(k: number, t: LodThresholds): LodLevel {
  if (k >= t.medium) return "high";
  if (k >= t.low) return "medium";
  return "low";
}

// ── Canvas Painter ───────────────────────────────────────────────────────

/** Context passed to canvas painters and the onFrame callback each frame. */
export interface NodeCanvasFrameContext {
  camera: NodeCanvasCamera;
  viewport: { width: number; height: number };
  /** Milliseconds since the last frame (for animations). */
  dt: number;
  /** Current LOD level. */
  lod: LodLevel;
  /** The Canvas2D context, already transformed to world coordinates. */
  ctx: CanvasRenderingContext2D;
}

/** A canvas painter: called every frame while mounted. Painters draw
 *  strokes, grids, pipes, edges — anything that benefits from Canvas2D
 *  performance. They draw in WORLD coordinates (the camera transform
 *  is already applied to the context). */
export interface NodeCanvasPainter {
  /** Unique identifier for registration/removal. */
  id: string;
  /** Called every frame. Draw in world coordinates. */
  draw: (frame: NodeCanvasFrameContext) => void;
  /** Painters with smaller z are drawn first (default 0). */
  z?: number;
}

// ── Edges ────────────────────────────────────────────────────────────────

/** How an edge is routed from source to target. */
export type EdgeRouting = "bezier" | "orthogonal" | "direct";

/** The side of a node an edge anchor sits on (compass short-hand). */
export type EdgeSide = "N" | "S" | "E" | "W";

/**
 * One explicit subpath of an edge's visible geometry. Hosts that compute
 * their own geometry (a bundled bus: thin stubs + one thick trunk) hand
 * the renderer ready-made path data instead of a from/to pair; the
 * renderer draws each subpath with its own stroke, and (when the edge
 * layer is interactive) puts a fat hit stroke over every one of them so
 * hovering any part of the bundle lights the whole edge.
 */
export interface EdgeSubpath {
  /** SVG path data, in world coordinates. */
  d: string;
  /** Stroke width in world units (defaults to the edge's `width`). */
  width?: number;
  /** Dashed override (defaults to the edge's `dashed`). */
  dashed?: boolean;
}

/** An edge between two points (or two nodes, resolved by the host). */
export interface NodeCanvasEdge {
  id: string;
  /** Source point in world coordinates. */
  from: { x: number; y: number };
  /** Target point in world coordinates. */
  to: { x: number; y: number };
  /** Semantic type — views can use this for styling. */
  type?: string;
  /** Label rendered at the edge midpoint. */
  label?: string;
  /** Override the global routing strategy for this edge. */
  routing?: EdgeRouting;
  /** Stroke color (CSS color value or CSS variable name). */
  color?: string;
  /** Stroke width in world units. */
  width?: number;
  /** Dashed line. */
  dashed?: boolean;
  /** Side of the source the edge leaves from. When set, the routing's
   *  control geometry extends along that side's normal (a `fromSide: "S"`
   *  edge drops DOWN out of the anchor) instead of guessing from dx. */
  fromSide?: EdgeSide;
  /** Side of the target the edge arrives on (see `fromSide`). */
  toSide?: EdgeSide;
  /** Explicit visible geometry override (bus trunk + stubs, hand-routed
   *  runs, …). `from`/`to` remain authoritative for the label midpoint
   *  and any hit fallback. */
  subpaths?: EdgeSubpath[];
}

// ── Edge Geometry (pure functions) ───────────────────────────────────────

/** The subset of an edge the geometry helpers actually read. */
export type EdgeGeomInput = Pick<NodeCanvasEdge, "from" | "to"> &
  Partial<Pick<NodeCanvasEdge, "fromSide" | "toSide" | "routing" | "subpaths">>;

const SIDE_NORMALS: Record<EdgeSide, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
};

/** Point `d` world units from `p` along a side's outward normal. */
export function sideOffset(
  p: { x: number; y: number },
  side: EdgeSide,
  d: number,
): { x: number; y: number } {
  const n = SIDE_NORMALS[side];
  return { x: p.x + n.x * d, y: p.y + n.y * d };
}

/** The entry side opposite an exit side (an `E` exit pairs with a `W` entry). */
export function oppositeSide(side: EdgeSide): EdgeSide {
  switch (side) {
    case "N": return "S";
    case "S": return "N";
    case "E": return "W";
    case "W": return "E";
  }
}

/** Compute an SVG path string for an edge using the given routing. */
export function edgePath(
  edge: EdgeGeomInput,
  routing: EdgeRouting,
): string {
  // An explicit geometry override wins over any routing.
  if (edge.subpaths && edge.subpaths.length > 0) return edge.subpaths[0].d;
  const { from, to } = edge;
  switch (routing) {
    case "direct":
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    case "orthogonal":
      return orthogonalPath(from, to, edge.fromSide, edge.toSide);
    case "bezier":
    default:
      return bezierPath(from, to, edge.fromSide, edge.toSide);
  }
}

/** Control-point extension along the flow axis, in world units. */
function sideExtent(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromSide: EdgeSide,
): number {
  const vertical = fromSide === "N" || fromSide === "S";
  const span = vertical ? Math.abs(to.y - from.y) : Math.abs(to.x - from.x);
  return Math.max(span * 0.4, 40);
}

/** Cubic bezier. Control points extend along the anchor side normals
 *  (default: the classic horizontal 40% offsets — identical geometry for
 *  unsided edges, so existing canvases do not move by a pixel). */
function bezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromSide?: EdgeSide,
  toSide?: EdgeSide,
): string {
  const fs = fromSide ?? "E";
  const ts = toSide ?? oppositeSide(fs);
  const d = sideExtent(from, to, fs);
  const cp1 = sideOffset(from, fs, d);
  const cp2 = sideOffset(to, ts, d);
  return `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
}

/** How far an orthogonal stub leaves its anchor along the side normal. */
export const ORTHO_STUB = 24;

/** Manhattan routing. Without sides: the classic horizontal → vertical →
 *  horizontal elbow (unchanged). With a vertical exit side the run drops
 *  out of the anchor first and elbows through the vertical midpoint
 *  instead — the shape a top-down layered graph reads best. */
function orthogonalPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromSide?: EdgeSide,
  toSide?: EdgeSide,
): string {
  const verticalFirst =
    fromSide === "N" || fromSide === "S" || toSide === "N" || toSide === "S";
  if (!verticalFirst) {
    const midX = (from.x + to.x) / 2;
    return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
  }
  const a = fromSide ? sideOffset(from, fromSide, ORTHO_STUB) : from;
  const b = toSide ? sideOffset(to, toSide, ORTHO_STUB) : to;
  const midY = (a.y + b.y) / 2;
  return [
    `M ${from.x} ${from.y}`,
    a === from ? "" : `L ${a.x} ${a.y}`,
    `L ${a.x} ${midY}`,
    `L ${b.x} ${midY}`,
    b === to ? "" : `L ${b.x} ${b.y}`,
    `L ${to.x} ${to.y}`,
  ].filter(Boolean).join(" ");
}

/**
 * Invisible hit-stroke width (world units) for an edge at camera zoom
 * `k`: never thinner than 2.5× the visible stroke, and never thinner
 * than ~10 SCREEN pixels once the camera zooms out (the SVG layer is
 * inside the camera transform, so world widths shrink on screen).
 */
export function edgeHitWidth(
  edge: Pick<NodeCanvasEdge, "width">,
  k: number,
): number {
  return Math.max((edge.width ?? 1.5) * 2.5, 10 / Math.max(k, 0.01));
}

/** Compute the midpoint of an edge (for label placement). */
export function edgeMidpoint(
  edge: Pick<NodeCanvasEdge, "from" | "to">,
  routing: EdgeRouting,
): { x: number; y: number } {
  const { from, to } = edge;
  if (routing === "orthogonal") {
    const midX = (from.x + to.x) / 2;
    return { x: midX, y: (from.y + to.y) / 2 };
  }
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

// ── Print ────────────────────────────────────────────────────────────────

export type PrintPaper = "a4-landscape" | "a3-landscape" | "auto";

/** Paper dimensions in CSS pixels at 96 DPI. */
export const PAPER_SIZES: Record<PrintPaper, { width: number; height: number } | null> = {
  "a4-landscape": { width: 1122.5, height: 793.7 },
  "a3-landscape": { width: 1587.4, height: 1122.5 },
  auto: null,
};
