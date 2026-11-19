import { describe, expect, it } from "vitest";

import {
  generateSerpentinePath,
  pathLength,
  projectOntoPath,
  type PathPoint,
} from "./serpentineGeometry";

describe("generateSerpentinePath", () => {
  const W = 560;
  const H = 96;

  it("produces 3 or 5 corners for many seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      const path = generateSerpentinePath(W, H, seed);
      const corners = path.points.length - 2; // interior vertices
      expect(corners).toBeGreaterThanOrEqual(3);
      expect(corners).toBeLessThanOrEqual(5);
    }
  });

  it("starts at the left edge, vertically centred", () => {
    const p = generateSerpentinePath(W, H, 7);
    const first = p.points[0]!;
    expect(first.x).toBeGreaterThanOrEqual(0);
    expect(first.x).toBeLessThan(W / 2);
    expect(first.y).toBeCloseTo(H / 2, 5);
  });

  it("ends at the right edge, vertically centred, travelling right", () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = generateSerpentinePath(W, H, seed);
      const pts = p.points;
      const last = pts[pts.length - 1]!;
      const prev = pts[pts.length - 2]!;
      expect(last.x).toBeGreaterThan(W / 2);
      expect(last.y).toBeCloseTo(H / 2, 5);
      // The final leg approaches horizontally (same y as the endpoint).
      expect(prev.y).toBeCloseTo(last.y, 5);
      expect(prev.x).toBeLessThan(last.x);
    }
  });

  it("alternates H and V segments (no two consecutive same-axis legs)", () => {
    for (let seed = 0; seed < 100; seed++) {
      const p = generateSerpentinePath(W, H, seed);
      const pts = p.points;
      for (let i = 2; i < pts.length; i++) {
        const a = pts[i - 2]!;
        const b = pts[i - 1]!;
        const c = pts[i]!;
        const hThenV = Math.abs(a.y - b.y) < 1e-6 && Math.abs(b.x - c.x) < 1e-6;
        const vThenH = Math.abs(a.x - b.x) < 1e-6 && Math.abs(b.y - c.y) < 1e-6;
        expect(hThenV || vThenH).toBe(true);
      }
    }
  });

  it("keeps every vertex inside the lane and off the centre line (except endpoints)", () => {
    for (let seed = 0; seed < 100; seed++) {
      const p = generateSerpentinePath(W, H, seed);
      for (const pt of p.points) {
        expect(pt.x).toBeGreaterThanOrEqual(0);
        expect(pt.x).toBeLessThanOrEqual(W);
        expect(pt.y).toBeGreaterThanOrEqual(0);
        expect(pt.y).toBeLessThanOrEqual(H);
      }
    }
  });

  it("is deterministic for a given seed and differs across seeds", () => {
    const a = generateSerpentinePath(W, H, 42);
    const b = generateSerpentinePath(W, H, 42);
    expect(a.points).toEqual(b.points);
    const c = generateSerpentinePath(W, H, 43);
    expect(a.points).not.toEqual(c.points);
  });

  it("reports a positive total length", () => {
    const p = generateSerpentinePath(W, H, 1);
    expect(p.totalLength).toBeGreaterThan(W);
  });

  // Regression pins for the leg-class variance: a generator that always
  // produced 4 legs (3 corners) would satisfy the per-path bounds above,
  // so the CLASSES themselves must be asserted to occur (the R2 mutation
  // that always returned 4 legs survived the whole suite otherwise).
  it("produces BOTH 3-corner and 5-corner lanes across seeds", () => {
    const counts = { 3: 0, 5: 0 };
    for (let seed = 0; seed < 200; seed++) {
      const corners = generateSerpentinePath(W, H, seed).points.length - 2;
      counts[corners as 3 | 5] = (counts[corners as 3 | 5] ?? 0) + 1;
    }
    expect(counts[3]).toBeGreaterThan(0);
    expect(counts[5]).toBeGreaterThan(0);
  });

  it("produces BOTH first-leg directions (up and down) across seeds", () => {
    let up = 0;
    let down = 0;
    for (let seed = 0; seed < 200; seed++) {
      const pts = generateSerpentinePath(W, H, seed).points;
      const firstTurnY = pts[1]!.y;
      if (firstTurnY < H / 2) up++;
      else if (firstTurnY > H / 2) down++;
    }
    expect(up).toBeGreaterThan(0);
    expect(down).toBeGreaterThan(0);
  });

  it("stays inside the canvas on narrow widths (the budget guard)", () => {
    for (const narrow of [120, 160, 240]) {
      for (let seed = 0; seed < 50; seed++) {
        const p = generateSerpentinePath(narrow, H, seed);
        for (const pt of p.points) {
          expect(pt.x).toBeLessThanOrEqual(narrow);
          expect(pt.y).toBeLessThanOrEqual(H);
        }
        // The final leg still lands on the right edge at the centre.
        const last = p.points[p.points.length - 1]!;
        expect(last.x).toBe(narrow);
        expect(last.y).toBeCloseTo(H / 2, 5);
      }
    }
  });
});

describe("pathLength / projectOntoPath", () => {
  const straight: PathPoint[] = [
    { x: 0, y: 48 },
    { x: 100, y: 48 },
  ];

  it("computes the polyline length", () => {
    expect(pathLength(straight)).toBe(100);
  });

  it("projects a distance onto the path (arc-length parameterisation)", () => {
    const at0 = projectOntoPath(straight, 0);
    expect(at0.x).toBe(0);
    const at50 = projectOntoPath(straight, 50);
    expect(at50.x).toBe(50);
    const beyond = projectOntoPath(straight, 500);
    expect(beyond.x).toBe(100);
  });

  it("clamps progress past the end", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 0, y: 40 },
      { x: 60, y: 40 },
    ];
    const at = projectOntoPath(pts, 1000);
    expect(at).toEqual({ x: 60, y: 40 });
  });
});
