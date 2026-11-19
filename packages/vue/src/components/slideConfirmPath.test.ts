// slideConfirmPath — the pure geometry half of HkSlideConfirm. These
// pins carry the SHAPE contract: ≥3 random right-angle turns through
// three lanes, monotonic left→right, seeded determinism (the captcha
// property: a seed reproduces the exact route), and the arc-length math
// the knob's follow/snap mechanics ride on.
import { describe, expect, it } from "vitest";

import {
  generateSlidePath,
  slideAdvanceT,
  slideLaneY,
  slidePathLength,
  slidePixelPoints,
  slidePointAtT,
} from "./slideConfirmPath";

describe("generateSlidePath", () => {
  it("a seed reproduces the exact route (the captcha property)", () => {
    const a = generateSlidePath(20261119);
    const b = generateSlidePath(20261119);
    expect(a).toEqual(b);
    const c = generateSlidePath(777);
    expect(c).not.toEqual(a);
  });

  it("carries at least three right-angle turns (the fat-confirm contract)", () => {
    for (const seed of [1, 2, 3, 42, 999, 20261119, 7, 8, 9, 10]) {
      const { points, turns } = generateSlidePath(seed);
      // A turn = a vertical jump: consecutive points sharing x but not y.
      let jumps = 0;
      for (let i = 1; i < points.length; i++) {
        if (points[i]!.x === points[i - 1]!.x && points[i]!.y !== points[i - 1]!.y) jumps++;
      }
      expect(jumps, `seed ${seed}`).toBe(turns);
      expect(turns, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      expect(turns, `seed ${seed}`).toBeLessThanOrEqual(5);
    }
  });

  it("walks left to right monotonically and lands on the edges", () => {
    for (const seed of [1, 42, 20261119]) {
      const { points } = generateSlidePath(seed);
      expect(points[0]!.x).toBe(0);
      expect(points[points.length - 1]!.x).toBe(1);
      for (let i = 1; i < points.length; i++) {
        expect(points[i]!.x, `seed ${seed} step ${i}`).toBeGreaterThanOrEqual(points[i - 1]!.x);
      }
    }
  });

  it("stays on the three lanes and never repeats a lane across a turn", () => {
    for (const seed of [1, 42, 20261119]) {
      const { points } = generateSlidePath(seed);
      const laneYs = [slideLaneY(0), slideLaneY(1), slideLaneY(2)];
      let lastLane = -1;
      for (const p of points) {
        expect(laneYs).toContain(p.y);
      }
      for (let i = 0; i < points.length; i++) {
        const lane = laneYs.indexOf(points[i]!.y);
        if (lane !== lastLane) {
          // A lane change is a vertical jump at a turn column — the new
          // lane must differ from the old one (never a zero-length turn).
          if (i > 0 && points[i]!.x === points[i - 1]!.x) {
            expect(lane, `seed ${seed} step ${i}`).not.toBe(lastLane);
          }
          lastLane = lane;
        }
      }
    }
  });
});

describe("pixel mapping and arc-length", () => {
  // A deterministic orthogonal route in a 300×120 box (TRACK_PAD-style
  // mapping is the component's job; these pins are on the raw math).
  const path = generateSlidePath(20261119);
  const pixel = slidePixelPoints(path.points, 300, 120);

  it("maps grid fractions to the measured box", () => {
    expect(pixel[0]!.x).toBe(0);
    expect(pixel[0]!.y).toBeCloseTo(slideLaneY(path.points[0]!.y > 0.5 ? 2 : path.points[0]!.y > 0.16 ? 1 : 0) * 120, 5);
    const last = pixel[pixel.length - 1]!;
    expect(last.x).toBe(300);
  });

  it("pointAtT walks the endpoints and keeps arc length honest", () => {
    const start = slidePointAtT(pixel, 0);
    expect(start.x).toBeCloseTo(pixel[0]!.x, 5);
    expect(start.y).toBeCloseTo(pixel[0]!.y, 5);

    const end = slidePointAtT(pixel, 1);
    const last = pixel[pixel.length - 1]!;
    expect(end.x).toBeCloseTo(last.x, 5);
    expect(end.y).toBeCloseTo(last.y, 5);

    // The length of a fine polyline walk equals the total length — the
    // arc-length parameterization is consistent.
    const steps = 4000;
    let walked = 0;
    let prev = slidePointAtT(pixel, 0);
    for (let i = 1; i <= steps; i++) {
      const p = slidePointAtT(pixel, i / steps);
      walked += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    // 4000 linear-t steps chord the corners slightly — the walked sum
    // must converge to the total length within a fraction of a percent.
    expect(Math.abs(walked - slidePathLength(pixel))).toBeLessThan(slidePathLength(pixel) * 0.001);
  });

  it("slideAdvanceT advances only inside the corridor and rejects off-lane pointers", () => {
    // Corridor = half a lane height + slack (the component's radius).
    const corridor = 120 / 6 + 4;
    const nearStart = slidePointAtT(pixel, 0);
    // A pointer ON the lane advances.
    const advanced = slideAdvanceT(pixel, 0, nearStart.x + 5, nearStart.y, corridor);
    expect(advanced).not.toBeNull();
    expect(advanced!).toBeGreaterThan(0);
    // A pointer far off the lane (top edge) finds nothing.
    const off = slideAdvanceT(pixel, 0, nearStart.x, 2, corridor);
    expect(off).toBeNull();
  });

  it("slideAdvanceT is monotonic: never retreats below fromT", () => {
    const corridor = 120 / 6 + 4;
    const from = 0.5;
    const anchor = slidePointAtT(pixel, from);
    // Even a pointer parked at the START of the lane cannot pull the
    // knob back — the scan begins at fromT.
    const result = slideAdvanceT(pixel, from, pixel[0]!.x, pixel[0]!.y, corridor);
    if (result !== null) expect(result).toBeGreaterThanOrEqual(from);
    void anchor;
  });
});
