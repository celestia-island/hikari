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
  /** SVG path data, in world coordinates. MUST start with an absolute
   *  `M` command — subpaths are concatenated into ONE element for hit
   *  testing, where a relative `m` would chain off the previous
   *  subpath's endpoint instead of its own origin. */
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

// ── Camera bounds clamp ──────────────────────────────────────────────────

/** How far past the content hull the camera may push it, as a fraction of
 *  the viewport size per axis (0.5 = the hull may leave at most half a
 *  viewport of itself past the visible edge — no farther). */
export const CANVAS_BOUNDS_MARGIN = 0.5;

/** Clamp a camera so the content cannot be dragged out of reach.
 *
 *  The binding geometry is the content hull — the axis-aligned envelope of
 *  every component on the canvas (the hull's x/y extremes are exactly what
 *  a pure translation can bind against). The camera is clamped so the
 *  viewport's world window keeps intersecting that hull expanded by
 *  `marginFactor` viewport sizes per axis: at the limit the hull itself
 *  sits exactly `marginFactor` of a viewport outside the visible edge, and
 *  past that the outward drag is refused.
 *
 *  Degenerate inputs pass the camera through unchanged: no bounds (the
 *  host gave none), a non-finite or empty hull, an unmeasured viewport, a
 *  non-finite zoom, or a coordinate combination whose clamp range is not
 *  finite (an astronomically placed hull) — a clamped camera is only ever
 *  returned finite, because the browser drops the whole transform
 *  otherwise. */
export function clampCameraToBounds(
  camera: NodeCanvasCamera,
  bounds: NodeCanvasBounds | null,
  viewport: { width: number; height: number },
  marginFactor: number = CANVAS_BOUNDS_MARGIN,
): NodeCanvasCamera {
  if (
    !bounds ||
    !(bounds.width > 0) ||
    !(bounds.height > 0) ||
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.y) ||
    !(viewport.width > 0) ||
    !(viewport.height > 0)
  ) {
    return camera;
  }
  const { k } = camera;
  if (!Number.isFinite(k) || k <= 0) return camera;
  if (!Number.isFinite(camera.x) || !Number.isFinite(camera.y)) return camera;
  // The viewport's world window is [-x/k, (W-x)/k]; "keep intersecting the
  // hull expanded by (f·W/k, f·H/k) world units" solves to these
  // translation ranges. The viewport fraction cancels the zoom — the
  // margin is a SCREEN distance (half a viewport) at any k.
  const xLow = -k * (bounds.x + bounds.width) - marginFactor * viewport.width;
  const xHigh = viewport.width - k * bounds.x + marginFactor * viewport.width;
  const yLow = -k * (bounds.y + bounds.height) - marginFactor * viewport.height;
  const yHigh = viewport.height - k * bounds.y + marginFactor * viewport.height;
  // bounds.width/height > 0 keeps both intervals non-empty (dust aside);
  // the finiteness guard refuses a hull so far out the range overflows —
  // a non-finite translation would drop the whole transform.
  if (!(xLow <= xHigh) || !(yLow <= yHigh)) return camera;
  if (
    !Number.isFinite(xLow) || !Number.isFinite(xHigh)
    || !Number.isFinite(yLow) || !Number.isFinite(yHigh)
  ) {
    return camera;
  }
  return {
    k,
    x: Math.min(xHigh, Math.max(xLow, camera.x)),
    y: Math.min(yHigh, Math.max(yLow, camera.y)),
  };
}

// ── Print ────────────────────────────────────────────────────────────────

export type PrintPaper = "a4-landscape" | "a3-landscape" | "auto";

/** Paper dimensions in CSS pixels at 96 DPI. */
export const PAPER_SIZES: Record<PrintPaper, { width: number; height: number } | null> = {
  "a4-landscape": { width: 1122.5, height: 793.7 },
  "a3-landscape": { width: 1587.4, height: 1122.5 },
  auto: null,
};
