import { describe, expect, it } from "vitest";

import {
  boardAnchor,
  boardEdgePath,
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

describe("boardEdges — route styles", () => {
  const a = { x: 220, y: 130 };
  const b = { x: 400, y: 260 };

  it("straight is a single segment", () => {
    expect(boardEdgePath(a, b, "straight")).toBe("M 220 130 L 400 260");
  });

  it("bezier is a horizontal-tangent cubic", () => {
    const d = boardEdgePath(a, b, "bezier");
    expect(d).toContain("C 310 130, 310 260, 400 260");
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
