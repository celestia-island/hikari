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
 *      • "top"      — top-border midpoint (top-aligned columns, SCADA-style
 *                     vertical drops);
 *      • "top-left" — the top-left corner (top-left aligned rows);
 *      • "fan"      — 天女散花: when one node feeds SEVERAL edges, the
 *                     attach points spread evenly across the exit border
 *                     instead of stacking on one dot (pass index/count).
 *
 *  - ROUTE STYLE (`BoardEdgeStyle`) — how the two anchors join:
 *      • "straight"   — a straight segment;
 *      • "bezier"     — a horizontal-tangent cubic (flowing curve);
 *      • "orthogonal" — strict elbow (H-V-H), the SCADA pipe discipline;
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

export interface BoardNodeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BoardAnchorMode = "center" | "nearest" | "top" | "top-left" | "fan";

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

/** Segment WITHOUT the leading "M x y" — the drawable tail from `a` into
 *  `b`, so multi-leg paths can chain tails end to end. */
function segmentTail(a: BoardPoint, b: BoardPoint, style: BoardEdgeStyle): string {
  switch (style) {
    case "bezier": {
      const dx = (b.x - a.x) / 2;
      return `C ${r1(a.x + dx)} ${r1(a.y)}, ${r1(b.x - dx)} ${r1(b.y)}, ${r1(b.x)} ${r1(b.y)}`;
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
export function boardEdgePath(a: BoardPoint, b: BoardPoint, style: BoardEdgeStyle): string {
  return `M ${r1(a.x)} ${r1(a.y)} ${segmentTail(a, b, style)}`;
}

/**
 * One edge routed THROUGH via points (the centers of empty corner/junction
 * nodes). The style applies to every leg; orthogonal legs chain into clean
 * right angles, straight legs chain into a polyline, bezier legs chain
 * with smooth midpoints so long vias read as one flowing curve.
 */
export function boardViaPath(
  a: BoardPoint,
  via: BoardPoint[],
  b: BoardPoint,
  style: BoardEdgeStyle,
): string {
  const pts = [a, ...via, b];
  if (pts.length < 2) return "";
  if (style === "bezier" && pts.length > 2) {
    // Smooth chain: cubic legs with tangents from the neighbor midpoints.
    let d = `M ${r1(pts[0].x)} ${r1(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const next = pts[Math.min(i + 1, pts.length - 1)];
      const t1 = i === 1 ? prev : { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 };
      const t2 = i === pts.length - 1 ? cur : { x: (cur.x + next.x) / 2, y: (cur.y + next.y) / 2 };
      d += ` C ${r1(t1.x)} ${r1(t1.y)}, ${r1(t2.x)} ${r1(t2.y)}, ${r1(cur.x)} ${r1(cur.y)}`;
    }
    return d;
  }
  let d = `M ${r1(pts[0].x)} ${r1(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` ${segmentTail(pts[i - 1], pts[i], style)}`;
  }
  return d;
}
