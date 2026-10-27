import { describe, expect, it } from "vitest";

import { squarify, worstAspectRatio, type SquarifyInput } from "./treemapSquarify";

const IN = (pairs: Array<[string, number]>): SquarifyInput[] =>
  pairs.map(([id, value]) => ({ id, value }));

describe("squarify — the pure layout core", () => {
  it("every value maps to its exact area share (area truth)", () => {
    const rects = squarify(IN([["a", 6], ["b", 6], ["c", 3], ["d", 3]]), 0, 0, 200, 100);
    const total = 18;
    for (const [id, value] of [["a", 6], ["b", 6], ["c", 3], ["d", 3]] as const) {
      const rect = rects.find((r) => r.id === id)!;
      expect(rect.w * rect.h).toBeCloseTo((value / total) * 200 * 100, 6);
    }
  });

  it("the rectangles tile the canvas exactly (no gaps, no overlap)", () => {
    const rects = squarify(IN([["a", 30], ["b", 20], ["c", 15], ["d", 10], ["e", 8], ["f", 7]]), 0, 0, 320, 240);
    const area = rects.reduce((sum, r) => sum + r.w * r.h, 0);
    expect(area).toBeCloseTo(320 * 240, 6);
    // Pairwise overlap check on this small set.
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlap =
          Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
          Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        expect(overlap).toBe(0);
      }
    }
  });

  it("stays squarish — the worst aspect is bounded (the slice-and-dice killer)", () => {
    // Slice-and-dice on sorted input at 320×240 produces ~12:1 slivers;
    // squarify keeps this set under 4.
    const rects = squarify(IN([["a", 30], ["b", 20], ["c", 15], ["d", 10], ["e", 8], ["f", 7]]), 0, 0, 320, 240);
    expect(worstAspectRatio(rects)).toBeLessThanOrEqual(4);
  });

  it("a single value takes the whole canvas", () => {
    const rects = squarify(IN([["only", 42]]), 0, 0, 100, 60);
    expect(rects).toEqual([{ id: "only", x: 0, y: 0, w: 100, h: 60 }]);
  });

  it("drops non-positive and non-finite weights (defense in depth)", () => {
    const rects = squarify(IN([["a", 5], ["bad0", 0], ["badNeg", -3], ["badNaN", Number.NaN]]), 0, 0, 100, 100);
    expect(rects.map((r) => r.id)).toEqual(["a"]);
  });

  it("degenerates safely on zero-size canvases", () => {
    expect(squarify(IN([["a", 1]]), 0, 0, 0, 100)).toEqual([]);
    expect(squarify(IN([["a", 1]]), 0, 0, 100, 0)).toEqual([]);
  });

  it("is deterministic: the same input lays out identically twice", () => {
    const input = IN([["a", 3], ["b", 2], ["c", 2], ["d", 1]]);
    expect(squarify(input, 0, 0, 180, 90)).toEqual(squarify(input, 0, 0, 180, 90));
  });
});
