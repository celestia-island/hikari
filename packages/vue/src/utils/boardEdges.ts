/**
 * boardEdges.ts — pure anchor + path geometry for HkBoard edges.
 *
 * Edges connect node rects. The two independently-configurable halves of
 * that contract:
 *
 *  - ANCHOR MODE (`BoardAnchorMode`) — where on the node border an edge
 *    attaches:
 *      • "center"   — the border point the center→center ray exits through
 *                     (the classic mind-map / graph look);
 *      • "nearest"  — the border point closest to the other end;
 *      • "top"      — top-border midpoint (top-aligned columns, operations-style
 *                     vertical drops);
 *      • "bottom" / "left" / "right" — the other three border midpoints: a
 *                     flowchart leaves through the side its rank stack grows
 *                     toward and arrives through the opposite one, so every
 *                     arrow is head-on for the border it lands on;
 *      • "top-left" — the top-left corner (top-left aligned rows);
 *      • "fan"      — 天女散花: when one node feeds SEVERAL edges, the
 *                     attach points spread evenly across the exit border
 *                     instead of stacking on one dot (pass index/count).
 *
 *  - ROUTE STYLE (`BoardEdgeStyle`) — how the two anchors join:
 *      • "straight"   — a straight segment;
 *      • "bezier"     — a normal-tangent cubic (flowing curve): it leaves
 *                     and arrives ALONG the border normals of its anchors
 *                     (see "Route tangents" below);
 *      • "orthogonal" — strict elbow (H-V-H), the operations pipe discipline;
 *      • "spine"      — vertical-first elbow (V-H), for tree rails.
 *
 * Edges may also route THROUGH empty corner nodes: `boardViaPath` chains
 * the segment builders across the via points (the centers of invisible
 * junction nodes), which is how consumers bake a right-angle turn into
 * the graph itself.
 *
 * Pure functions only — path strings are world-space SVG `d` attributes.
 */

export interface BoardPoint {
  x: number;
  y: number;
}

/**
 * Fan ordinals for a set of edges: every edge sharing a `from` node gets
 * its `{ index, count }` slot in the 天女散花 spread across that node's
 * exit border. Two passes — totals first, then positions — so `count` is
 * the FINAL total per node (a running count would feed the first edges
 * count = 1 and collapse the whole fan onto one anchor point). Edges from
 * different nodes are counted independently.
 */
export function boardFanOrdinals(
  edges: ReadonlyArray<{ id: string; from: string }>,
): Map<string, { index: number; count: number }> {
  const totals = new Map<string, number>();
  for (const e of edges) totals.set(e.from, (totals.get(e.from) ?? 0) + 1);
  const seen = new Map<string, number>();
  const ordinals = new Map<string, { index: number; count: number }>();
  for (const e of edges) {
    const index = seen.get(e.from) ?? 0;
    seen.set(e.from, index + 1);
    ordinals.set(e.id, { index, count: totals.get(e.from)! });
  }
  return ordinals;
}

export interface BoardNodeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BoardAnchorMode = "center" | "nearest" | "top" | "bottom" | "left" | "right" | "top-left" | "fan";

export type BoardEdgeStyle = "straight" | "bezier" | "orthogonal" | "spine";

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Border point of `rect` where the ray from rect center toward `to`
 *  exits the rect. Falls back to the facing-border midpoint on degenerate
 *  (zero-size) rects. */
function centerExit(rect: BoardNodeRect, to: BoardPoint): BoardPoint {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = to.x - cx;
  const dy = to.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: rect.y };
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

/** Closest point of `rect` perimeter to `to`. */
function nearestPoint(rect: BoardNodeRect, to: BoardPoint): BoardPoint {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = to.x - cx;
  const dy = to.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: rect.y };
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  if (sx < sy) {
    return { x: cx + Math.sign(dx) * hw, y: Math.min(Math.max(to.y, rect.y), rect.y + rect.h) };
  }
  return { x: Math.min(Math.max(to.x, rect.x), rect.x + rect.w), y: cy + Math.sign(dy) * hh };
}

/**
 * Resolve the anchor point on `rect` for an edge toward `to`.
 * `index`/`count` only matter for "fan" (even spread along the exit
 * border; no-ops when count ≤ 1).
 */
export function boardAnchor(
  rect: BoardNodeRect,
  mode: BoardAnchorMode,
  to: BoardPoint,
  index = 0,
  count = 1,
): BoardPoint {
  switch (mode) {
    case "top":
      return { x: rect.x + rect.w / 2, y: rect.y };
    case "bottom":
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    case "left":
      return { x: rect.x, y: rect.y + rect.h / 2 };
    case "right":
      return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
    case "top-left":
      return { x: rect.x, y: rect.y };
    case "nearest":
      return nearestPoint(rect, to);
    case "fan": {
      const base = centerExit(rect, to);
      if (count <= 1) return base;
      // Spread along the exit border (whichever side centerExit left
      // through) between 1/(count+1) and count/(count+1) of the side.
      const t = (index + 1) / (count + 1);
      const dx = to.x - (rect.x + rect.w / 2);
      const dy = to.y - (rect.y + rect.h / 2);
      const vertical = Math.abs(dy) * rect.w >= Math.abs(dx) * rect.h;
      if (vertical) {
        const x = rect.x + rect.w * t;
        return { x, y: dy < 0 ? rect.y : rect.y + rect.h };
      }
      const y = rect.y + rect.h * t;
      return { x: dx < 0 ? rect.x : rect.x + rect.w, y };
    }
    case "center":
    default:
      return centerExit(rect, to);
  }
}

// ── Route tangents ────────────────────────────────────────────────────

/**
 * Unit travel directions at the two ends of a route: what a bezier leaves
 * `a` along, and what it arrives at `b` along.
 *
 * WHY THIS EXISTS (measured on docs.celestia.world 2026-11-27): an SVG
 * `orient="auto"` arrowhead rotates to the path's END TANGENT. The bezier
 * used to leave and arrive horizontally no matter where its anchors sat,
 * so every arrow of a top-down flowchart pointed LEFT or RIGHT — and since
 * a path ends ON the node border, the half of that sideways triangle that
 * stuck out above the node was all the reader saw. (A cubic whose last
 * control point coincides with its end has a ZERO tangent; Chrome 155 orients
 * that marker at 180° — also sideways.) A route therefore has to arrive
 * along the border normal of the node it enters, which only the caller
 * knows: it owns the rects. Callers pass them in; without them the tangent
 * falls back to the route's dominant travel axis.
 */
export interface BoardTangents {
  /** Unit direction the route leaves its first point along. */
  from?: BoardPoint;
  /** Unit direction the route arrives at its last point along. */
  to?: BoardPoint;
}

/** Below this half-distance the handle shrinks with the leg (no bulge on
 *  tiny gaps); above `MAX` long legs keep a straight-ish middle. */
const BEZIER_HANDLE_MIN = 12;
const BEZIER_HANDLE_MAX = 120;

const unit = (v: BoardPoint): BoardPoint => {
  const len = Math.hypot(v.x, v.y);
  return len > 1e-9 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
};

/**
 * Fallback tangent: the dominant travel axis of `a → b` (vertical when the
 * route climbs or drops at least as much as it strafes). A zero-length
 * leg has no travel to read — it returns the x axis.
 */
export function boardAxisTangent(a: BoardPoint, b: BoardPoint): BoardPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return { x: 1, y: 0 };
  if (Math.abs(dy) >= Math.abs(dx)) return { x: 0, y: dy >= 0 ? 1 : -1 };
  return { x: dx >= 0 ? 1 : -1, y: 0 };
}

/**
 * Outward unit normal of the border `point` sits on, or `null` when the
 * point is on none of the rect's borders (inside, outside, or a degenerate
 * junction rect — every border of a zero-size rect is the same dot).
 *
 * `outward` breaks a corner tie: at a corner two borders qualify, and the
 * one whose normal points most along `outward` is the side the route is
 * really using. For the route's FIRST point pass its travel direction (the
 * route leaves along the normal); for its LAST point pass the negated
 * travel direction (the route arrives against the normal).
 */
export function boardAnchorNormal(
  rect: BoardNodeRect,
  point: BoardPoint,
  outward?: BoardPoint,
  tol = 0.75,
): BoardPoint | null {
  if (rect.w <= 0 || rect.h <= 0) return null;
  const sides = [
    { d: Math.abs(point.y - rect.y), n: { x: 0, y: -1 } },
    { d: Math.abs(point.y - (rect.y + rect.h)), n: { x: 0, y: 1 } },
    { d: Math.abs(point.x - rect.x), n: { x: -1, y: 0 } },
    { d: Math.abs(point.x - (rect.x + rect.w)), n: { x: 1, y: 0 } },
  ].filter((side) => side.d <= tol);
  if (sides.length === 0) return null;
  if (sides.length === 1 || !outward) return sides[0].n;
  let best = sides[0];
  for (const side of sides.slice(1)) {
    const gain = side.n.x * outward.x + side.n.y * outward.y - (best.n.x * outward.x + best.n.y * outward.y);
    if (gain > 1e-9) best = side;
  }
  return best.n;
}

interface Cubic {
  c1: BoardPoint;
  c2: BoardPoint;
}

/** One bezier leg `p → q` leaving along `t` and arriving along `u` (both
 *  unit). Returns the control points so the midpoint can be derived from
 *  the very same geometry the path draws. */
function cubicLeg(p: BoardPoint, t: BoardPoint, q: BoardPoint, u: BoardPoint): Cubic {
  const half = Math.hypot(q.x - p.x, q.y - p.y) / 2;
  const k = half < BEZIER_HANDLE_MIN ? half : Math.min(half, BEZIER_HANDLE_MAX);
  return {
    c1: { x: p.x + t.x * k, y: p.y + t.y * k },
    c2: { x: q.x - u.x * k, y: q.y - u.y * k },
  };
}

const bezierTail = (q: BoardPoint, c: Cubic): string =>
  `C ${r1(c.c1.x)} ${r1(c.c1.y)}, ${r1(c.c2.x)} ${r1(c.c2.y)}, ${r1(q.x)} ${r1(q.y)}`;

const resolveTangents = (a: BoardPoint, b: BoardPoint, tangents?: BoardTangents): BoardTangents => {
  const axis = boardAxisTangent(a, b);
  return {
    from: tangents?.from && (tangents.from.x !== 0 || tangents.from.y !== 0) ? unit(tangents.from) : axis,
    to: tangents?.to && (tangents.to.x !== 0 || tangents.to.y !== 0) ? unit(tangents.to) : axis,
  };
};

/** Segment WITHOUT the leading "M x y" — the drawable tail from `a` into
 *  `b`, so multi-leg paths can chain tails end to end. */
function segmentTail(a: BoardPoint, b: BoardPoint, style: BoardEdgeStyle, tangents?: BoardTangents): string {
  switch (style) {
    case "bezier": {
      const t = resolveTangents(a, b, tangents);
      return bezierTail(b, cubicLeg(a, t.from as BoardPoint, b, t.to as BoardPoint));
    }
    case "orthogonal": {
      const midX = r1((a.x + b.x) / 2);
      return `H ${midX} V ${r1(b.y)} H ${r1(b.x)}`;
    }
    case "spine": {
      const midY = r1((a.y + b.y) / 2);
      return `V ${midY} H ${r1(b.x)} V ${r1(b.y)}`;
    }
    case "straight":
    default:
      return `L ${r1(b.x)} ${r1(b.y)}`;
  }
}

/** One edge between two anchor points. */
export function boardEdgePath(a: BoardPoint, b: BoardPoint, style: BoardEdgeStyle, tangents?: BoardTangents): string {
  return `M ${r1(a.x)} ${r1(a.y)} ${segmentTail(a, b, style, tangents)}`;
}

/** Per-point unit tangents of a polyline `pts` (length ≥ 2): the ends use
 *  the route's own directions, interior points the standard (P[i+1] −
 *  P[i−1]) direction of a smooth chain. */
function chainTangents(pts: BoardPoint[], tangents?: BoardTangents): BoardPoint[] {
  return pts.map((p, i) => {
    if (i === 0) return resolveTangents(p, pts[1], tangents).from as BoardPoint;
    if (i === pts.length - 1) return resolveTangents(pts[i - 1], p, tangents).to as BoardPoint;
    return unit({ x: pts[i + 1].x - pts[i - 1].x, y: pts[i + 1].y - pts[i - 1].y });
  });
}

/**
 * One edge routed THROUGH via points (the centers of empty corner/junction
 * nodes). The style applies to every leg; orthogonal legs chain into clean
 * right angles, straight legs chain into a polyline, bezier legs chain
 * with a tangent per point so long vias read as one flowing curve — and so
 * the LAST leg still arrives along its tangent (a midpoint-derived control
 * point would sit on the end point and zero the end tangent).
 */
export function boardViaPath(
  a: BoardPoint,
  via: BoardPoint[],
  b: BoardPoint,
  style: BoardEdgeStyle,
  tangents?: BoardTangents,
): string {
  const pts = [a, ...via, b];
  if (pts.length < 2) return "";
  if (style === "bezier" && pts.length > 2) {
    const tans = chainTangents(pts, tangents);
    let d = `M ${r1(pts[0].x)} ${r1(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` ${bezierTail(pts[i], cubicLeg(pts[i - 1], tans[i - 1], pts[i], tans[i]))}`;
    }
    return d;
  }
  let d = `M ${r1(pts[0].x)} ${r1(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) {
    // `tangents` only matters to the bezier tail (a two-point bezier route
    // lands here); the other styles ignore it.
    d += ` ${segmentTail(pts[i - 1], pts[i], style, tangents)}`;
  }
  return d;
}

/**
 * Where a route's caption belongs: on the bezier itself (its parametric
 * midpoint — for opposing border normals that is the chord midpoint, for
 * an elbow it is the bend), on the middle via point when the route bends
 * through junctions, else on the chord midpoint.
 */
export function boardEdgeMidpoint(
  a: BoardPoint,
  via: BoardPoint[],
  b: BoardPoint,
  style: BoardEdgeStyle,
  tangents?: BoardTangents,
): BoardPoint {
  if (via.length > 0) return via[Math.floor((via.length - 1) / 2)];
  if (style === "bezier") {
    const t = resolveTangents(a, b, tangents);
    const { c1, c2 } = cubicLeg(a, t.from as BoardPoint, b, t.to as BoardPoint);
    return { x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8, y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8 };
  }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
