import { describe, expect, it } from "vitest";

import {
  edgeHitWidth,
  edgeMidpoint,
  edgePath,
  oppositeSide,
  sideOffset,
  type EdgeGeomInput,
} from "./nodeCanvasTypes";

/**
 * Side-aware edge geometry — the routing upgrade layered topology
 * canvases build on. Contract under test:
 *
 *  1. UNSIDED edges keep the classic geometry byte-for-byte (existing
 *     canvases must not move by a pixel);
 *  2. sided edges bend along the anchor side normals (a `fromSide: "S"`
 *     edge drops DOWN out of its anchor);
 *  3. an explicit subpath override wins over every routing;
 *  4. the hit width keeps a fat target at any camera zoom.
 */
describe("nodeCanvasTypes side-aware routing", () => {
  const from = { x: 100, y: 100 };
  const to = { x: 400, y: 300 };

  it("keeps the classic horizontal bezier for unsided edges", () => {
    const d = edgePath({ from, to }, "bezier");
    // dx = 300 → cp = 120; control points along x at each endpoint's y.
    expect(d).toBe("M 100 100 C 220 100, 280 300, 400 300");
  });

  it("keeps the classic orthogonal elbow for unsided edges", () => {
    const d = edgePath({ from, to }, "orthogonal");
    const midX = (100 + 400) / 2;
    expect(d).toBe(`M 100 100 L ${midX} 100 L ${midX} 300 L 400 300`);
  });

  it("bends a vertical-sided bezier along the side normals", () => {
    const d = edgePath({ from, to, fromSide: "S", toSide: "N" }, "bezier");
    // Vertical flow: span = |300-100| = 200 → extent 80.
    // cp1 = from + (0, 80), cp2 = to + (0, -80).
    expect(d).toBe("M 100 100 C 100 180, 400 220, 400 300");
  });

  it("defaults the entry side opposite the exit side", () => {
    // fromSide E alone ⇒ toSide W: identical to the unsided horizontal run.
    const sided = edgePath({ from, to, fromSide: "E" }, "bezier");
    const unsided = edgePath({ from, to }, "bezier");
    expect(sided).toBe(unsided);
  });

  it("routes a sided orthogonal run vertical-first", () => {
    const d = edgePath(
      { from: { x: 0, y: 0 }, to: { x: 200, y: 100 }, fromSide: "S", toSide: "N" },
      "orthogonal",
    );
    // Stubs: a=(0,24), b=(200,76); midY = 50.
    expect(d).toBe("M 0 0 L 0 24 L 0 50 L 200 50 L 200 76 L 200 100");
  });

  it("lets an explicit subpath override win over any routing", () => {
    const edge: EdgeGeomInput = {
      from,
      to,
      subpaths: [
        { d: "M 0 0 L 10 10", width: 6 },
        { d: "M 10 10 L 20 0", width: 3 },
      ],
    };
    expect(edgePath(edge, "bezier")).toBe("M 0 0 L 10 10");
    expect(edgePath(edge, "orthogonal")).toBe("M 0 0 L 10 10");
    expect(edgePath(edge, "direct")).toBe("M 0 0 L 10 10");
  });

  it("maps every side to its opposite and offsets along its normal", () => {
    expect(oppositeSide("N")).toBe("S");
    expect(oppositeSide("S")).toBe("N");
    expect(oppositeSide("E")).toBe("W");
    expect(oppositeSide("W")).toBe("E");
    expect(sideOffset({ x: 10, y: 10 }, "N", 5)).toEqual({ x: 10, y: 5 });
    expect(sideOffset({ x: 10, y: 10 }, "S", 5)).toEqual({ x: 10, y: 15 });
    expect(sideOffset({ x: 10, y: 10 }, "W", 5)).toEqual({ x: 5, y: 10 });
    expect(sideOffset({ x: 10, y: 10 }, "E", 5)).toEqual({ x: 15, y: 10 });
  });

  it("keeps a usable hit width at every zoom", () => {
    // Thick edge at 1:1: 2.5× the visible stroke.
    expect(edgeHitWidth({ width: 4 }, 1)).toBeCloseTo(10);
    // Thin edge zoomed out 10×: the 10-screen-px floor dominates.
    expect(edgeHitWidth({ width: 1.5 }, 0.1)).toBeCloseTo(100);
    // Zoomed in, the floor still rules until 2.5× the stroke passes it.
    expect(edgeHitWidth({}, 2)).toBeCloseTo(5);
    expect(edgeHitWidth({ width: 10 }, 1)).toBeCloseTo(25);
  });

  it("reports the from/to midpoint for labels", () => {
    expect(edgeMidpoint({ from, to }, "bezier")).toEqual({ x: 250, y: 200 });
  });
});
