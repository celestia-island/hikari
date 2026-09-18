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
}

// ── Edge Geometry (pure functions) ───────────────────────────────────────

/** Compute an SVG path string for an edge using the given routing. */
export function edgePath(
  edge: Pick<NodeCanvasEdge, "from" | "to">,
  routing: EdgeRouting,
): string {
  const { from, to } = edge;
  switch (routing) {
    case "direct":
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    case "orthogonal":
      return orthogonalPath(from, to);
    case "bezier":
    default:
      return bezierPath(from, to);
  }
}

/** Cubic bezier: control points at 40% horizontal offset. */
function bezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dx = Math.abs(to.x - from.x);
  const cp = Math.max(dx * 0.4, 40);
  return `M ${from.x} ${from.y} C ${from.x + cp} ${from.y}, ${to.x - cp} ${to.y}, ${to.x} ${to.y}`;
}

/** Manhattan routing: horizontal → vertical → horizontal. */
function orthogonalPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
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
