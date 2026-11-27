import { describe, expect, it } from "vitest";

import {
  boardAnchor,
  boardAnchorNormal,
  boardEdgeMidpoint,
  boardEdgePath,
  boardFanOrdinals,
  boardViaPath,
  type BoardNodeRect,
} from "./boardEdges";

const rect: BoardNodeRect = { x: 100, y: 100, w: 120, h: 60 };
const rightTarget = { x: 400, y: 130 };
const belowTarget = { x: 160, y: 400 };

describe("boardEdges — anchor modes", () => {
  it("center exits through the facing border midpoint", () => {
    const a = boardAnchor(rect, "center", rightTarget);
    expect(a.y).toBe(130);
    expect(a.x).toBe(220);
  });

  it("bottom / left / right pin to those border midpoints", () => {
    expect(boardAnchor(rect, "bottom", rightTarget)).toEqual({ x: 160, y: 160 });
    expect(boardAnchor(rect, "left", rightTarget)).toEqual({ x: 100, y: 130 });
    expect(boardAnchor(rect, "right", rightTarget)).toEqual({ x: 220, y: 130 });
  });

  it("top pins to the top-border midpoint, top-left to the corner", () => {
    expect(boardAnchor(rect, "top", belowTarget)).toEqual({ x: 160, y: 100 });
    expect(boardAnchor(rect, "top-left", belowTarget)).toEqual({ x: 100, y: 100 });
  });

  it("nearest snaps to the closest perimeter point", () => {
    const a = boardAnchor(rect, "nearest", { x: 500, y: 105 });
    expect(a).toEqual({ x: 220, y: 105 });
  });

  it("fan spreads multiple edges along the exit border", () => {
    const first = boardAnchor(rect, "fan", rightTarget, 0, 3);
    const second = boardAnchor(rect, "fan", rightTarget, 1, 3);
    const third = boardAnchor(rect, "fan", rightTarget, 2, 3);
    expect(first.x).toBe(220);
    expect(first.y).toBeLessThan(second.y);
    expect(second.y).toBeLessThan(third.y);
    expect(new Set([first.y, second.y, third.y]).size).toBe(3);
  });
});

describe("boardEdges — fan ordinals", () => {
  it("gives a single edge the full fan (count = 1, no spread)", () => {
    const ord = boardFanOrdinals([{ id: "e1", from: "a" }]);
    expect(ord.get("e1")).toEqual({ index: 0, count: 1 });
  });

  it("spreads three edges from one node as {0,3} {1,3} {2,3}", () => {
    const ord = boardFanOrdinals([
      { id: "e1", from: "a" },
      { id: "e2", from: "a" },
      { id: "e3", from: "a" },
    ]);
    expect(ord.get("e1")).toEqual({ index: 0, count: 3 });
    expect(ord.get("e2")).toEqual({ index: 1, count: 3 });
    expect(ord.get("e3")).toEqual({ index: 2, count: 3 });
  });

  it("counts each source node independently", () => {
    const ord = boardFanOrdinals([
      { id: "e1", from: "a" },
      { id: "e2", from: "b" },
      { id: "e3", from: "a" },
    ]);
    expect(ord.get("e1")).toEqual({ index: 0, count: 2 });
    expect(ord.get("e2")).toEqual({ index: 0, count: 1 });
    expect(ord.get("e3")).toEqual({ index: 1, count: 2 });
  });

  it("returns an empty map for empty input", () => {
    expect(boardFanOrdinals([]).size).toBe(0);
  });
});

describe("boardEdges — route styles", () => {
  const a = { x: 220, y: 130 };
  const b = { x: 400, y: 260 };

  it("straight is a single segment", () => {
    expect(boardEdgePath(a, b, "straight")).toBe("M 220 130 L 400 260");
  });

  it("bezier without rect info follows the dominant travel axis", () => {
    // |dx| > |dy| here, so both tangents are horizontal; the handles sit
    // half a chord away from each end.
    expect(boardEdgePath(a, b, "bezier")).toContain("C 331 130, 289 260, 400 260");
    // A vertical route gets VERTICAL tangents — and a non-zero end tangent
    // (a zero one hands the arrowhead's orientation to the browser).
    expect(boardEdgePath({ x: 10, y: 0 }, { x: 10, y: 56 }, "bezier")).toBe("M 10 0 C 10 28, 10 28, 10 56");
  });

  it("orthogonal elbows through the mid X", () => {
    expect(boardEdgePath(a, b, "orthogonal")).toBe("M 220 130 H 310 V 260 H 400");
  });

  it("spine drops vertically first", () => {
    expect(boardEdgePath(a, b, "spine")).toBe("M 220 130 V 195 H 400 V 260");
  });
});

describe("boardEdges — via (empty corner nodes)", () => {
  const a = { x: 0, y: 0 };
  const corner = { x: 200, y: 200 };
  const b = { x: 400, y: 200 };

  it("chains orthogonal legs through the via point", () => {
    const d = boardViaPath(a, [corner], b, "orthogonal");
    // leg1: M 0 0 H 100 V 200 ; leg2: H 300 V 200 H 400 — a clean Z
    expect(d).toContain("H 100 V 200");
    expect(d).toContain("V 200 H 400");
  });

  it("chains straight legs as a polyline through the via point", () => {
    const d = boardViaPath(a, [corner], b, "straight");
    expect(d).toBe("M 0 0 L 200 200 L 400 200");
  });

  it("smooths multi-via bezier chains", () => {
    const d = boardViaPath(a, [{ x: 100, y: 300 }, { x: 300, y: 300 }], b, "bezier");
    expect(d.startsWith("M 0 0 C ")).toBe(true);
    expect(d).toContain("400 200");
  });
});

/**
 * An `orient="auto"` arrowhead rotates to the path's END TANGENT. These
 * pins are the contract that every arrow lands head-on: the route leaves
 * and arrives along the border normals the caller names, and the end
 * tangent is never zero (the 2026-11-27 docs-site defect — every top-down
 * arrow pointing sideways, half hidden under its target).
 *
 * MUT: revert `cubicLeg` to horizontal handles — "uses the caller's border
 * normals for both handles", "a three-leg via chain…" and the component
 * pins in HkBoard.arrows.test.tsx all turn red; the scan catches the shape.
 */
describe("boardEdges — route tangents", () => {
  const rect: BoardNodeRect = { x: 0, y: 0, w: 100, h: 40 };

  it("uses the caller's border normals for both handles", () => {
    // a bottom-border exit at x=300 into a top-border entry at x=120:
    // both control points keep their own end's x
    const d = boardEdgePath({ x: 300, y: 100 }, { x: 120, y: 200 }, "bezier", { from: { x: 0, y: 1 }, to: { x: 0, y: 1 } });
    expect(d).toBe("M 300 100 C 300 203, 120 97, 120 200");
  });

  it("normalizes a non-unit tangent", () => {
    const d = boardEdgePath({ x: 0, y: 0 }, { x: 0, y: 56 }, "bezier", { from: { x: 0, y: 9 }, to: { x: 0, y: 0.5 } });
    expect(d).toBe("M 0 0 C 0 28, 0 28, 0 56");
  });

  it("shrinks the handle with a tiny leg instead of overshooting it", () => {
    expect(boardEdgePath({ x: 0, y: 0 }, { x: 0, y: 10 }, "bezier")).toBe("M 0 0 C 0 5, 0 5, 0 10");
  });

  it("boardAnchorNormal names the border an anchor sits on", () => {
    expect(boardAnchorNormal(rect, { x: 50, y: 0 })).toEqual({ x: 0, y: -1 });
    expect(boardAnchorNormal(rect, { x: 50, y: 40 })).toEqual({ x: 0, y: 1 });
    expect(boardAnchorNormal(rect, { x: 0, y: 20 })).toEqual({ x: -1, y: 0 });
    expect(boardAnchorNormal(rect, { x: 100, y: 20 })).toEqual({ x: 1, y: 0 });
    // inside the rect, off its border, or a zero-size junction: no normal
    expect(boardAnchorNormal(rect, { x: 50, y: 20 })).toBeNull();
    expect(boardAnchorNormal(rect, { x: 50, y: -4 })).toBeNull();
    expect(boardAnchorNormal({ x: 5, y: 5, w: 0, h: 0 }, { x: 5, y: 5 })).toBeNull();
  });

  it("boardAnchorNormal breaks a corner tie toward the side the route uses", () => {
    // arriving at the top-left corner travelling right: it comes in through
    // the LEFT border (the normal pointing against the travel)
    expect(boardAnchorNormal(rect, { x: 0, y: 0 }, { x: -1, y: -0.3 })).toEqual({ x: -1, y: 0 });
    // travelling down: it comes in through the TOP border
    expect(boardAnchorNormal(rect, { x: 0, y: 0 }, { x: -0.2, y: -1 })).toEqual({ x: 0, y: -1 });
  });

  it("a via chain keeps a non-zero end tangent (the last handle is never the end point)", () => {
    const a = { x: 0, y: 0 };
    const corner = { x: 100, y: 0 };
    const b = { x: 100, y: 100 };
    const d = boardViaPath(a, [corner], b, "bezier", { from: { x: 1, y: 0 }, to: { x: 0, y: 1 } });
    const legs = d.match(/C [^C]+/g)!.map((leg) => leg.slice(2).replace(/,/g, "").trim().split(/\s+/).map(Number));
    expect(legs).toHaveLength(2);
    // first leg leaves straight along +x: its first control point shares the start's y
    expect(legs[0][0]).toBe(50);
    expect(legs[0][1]).toBe(0);
    // last leg arrives straight down: its second control point shares the end's x
    // and sits above it — equal coordinates would zero the tangent
    expect(legs[1][4] - legs[1][2]).toBe(0);
    expect(legs[1][5] - legs[1][3]).toBeGreaterThan(0);
  });

  it("a three-leg via chain: every interior point turns on its neighbours' direction, the last leg still arrives along `to`", () => {
    // a ──▶ p1      tangents: a leaves along +x, b arrives travelling UP
    //      │         p1 turns from "toward p2" …
    //      ▼ p2      … p2 from "away from p1" toward b
    //      ◀── b
    const a = { x: 0, y: 0 };
    const p1 = { x: 100, y: 0 };
    const p2 = { x: 100, y: 100 };
    const b = { x: 0, y: 100 };
    const d = boardViaPath(a, [p1, p2], b, "bezier", { from: { x: 1, y: 0 }, to: { x: 0, y: -1 } });
    // Handle length is half of each 100px leg. The interior tangents are
    // (next − previous) per point — (0.707, 0.707) at p1 and (−0.707,
    // 0.707) at p2 — which is what keeps the chain smooth; the last leg's
    // second handle sits 50px BELOW b (the route travels up into it).
    expect(d).toBe(
      "M 0 0 C 50 0, 64.6 -35.4, 100 0 C 135.4 35.4, 135.4 64.6, 100 100 C 64.6 135.4, 0 150, 0 100",
    );
  });

  it("without a caller tangent the fallback follows the route's travel: a drop into a junction ends travelling DOWN", () => {
    // The end is a zero-size junction, so HkBoard passes no `to` normal:
    // the axis fallback must be the direction of travel, not its opposite.
    const d = boardEdgePath({ x: 10, y: 0 }, { x: 30, y: 80 }, "bezier", { from: { x: 0, y: 1 } });
    const n = d.slice(d.indexOf("C") + 2).replace(/,/g, "").trim().split(/\s+/).map(Number);
    expect(n[3]).toBeLessThan(n[5]); // control point 2 above the end ⇒ end tangent points down
    expect(n[2]).toBe(n[4]); // …and straight above it: the travel axis is vertical here
    expect(n[1]).toBeGreaterThan(0); // the first handle still follows the caller's +y
    expect(boardEdgePath({ x: 10, y: 0 }, { x: 10, y: 56 }, "bezier")).toBe("M 10 0 C 10 28, 10 28, 10 56");
  });

  it("boardEdgeMidpoint sits on the bezier, and via routes keep the middle junction", () => {
    expect(boardEdgeMidpoint({ x: 0, y: 0 }, [], { x: 0, y: 56 }, "bezier")).toEqual({ x: 0, y: 28 });
    // bottom-exit into a top-entry at another x: opposing normals still
    // put the parametric midpoint on the chord's midpoint
    const s = boardEdgeMidpoint({ x: 0, y: 0 }, [], { x: 80, y: 56 }, "bezier", { from: { x: 0, y: 1 }, to: { x: 0, y: 1 } });
    expect(s.x).toBe(40);
    expect(s.y).toBe(28);
    expect(boardEdgeMidpoint({ x: 0, y: 0 }, [{ x: 40, y: 8 }], { x: 80, y: 0 }, "bezier")).toEqual({ x: 40, y: 8 });
  });
});
