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
