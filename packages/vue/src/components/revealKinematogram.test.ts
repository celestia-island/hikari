import { describe, expect, it, vi } from "vitest";

import {
  BACKGROUND_DRIFT_PX_S,
  FILTER_DRIFT_PX_S,
  layoutRevealGlyphs,
  NOISE_TILE_W,
  RevealFilterPainter,
  RevealNoisePainter,
  sweepWindow,
  SWEEP_END_PAUSE_S,
  SWEEP_SPEED_CSS_PX_S,
  wrapDrift,
} from "./revealKinematogram";

/**
 * Pure-contract tests for the noise kinematogram behind the password
 * reveal pass: drift wrapping/accumulation (the background
 * motion beside the boiling glyph noise) and the glyph layout math
 * (the mask that must stay still). The screenshot-safety invariant
 * itself — no glyph ever drawn on the visible canvas while the noise
 * strategy is active — is pinned in HkInput.password.test.tsx.
 */

describe("wrapDrift", () => {
  it("folds any accumulator into [0, tile) and stays periodic", () => {
    for (const px of [0, 5, 511.5, 512, 1024.25, -1, -13, -40.75, -2048]) {
      const w = wrapDrift(px, NOISE_TILE_W);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThan(NOISE_TILE_W);
      expect(w).toBeCloseTo(((px % NOISE_TILE_W) + NOISE_TILE_W) % NOISE_TILE_W, 10);
    }
    expect(wrapDrift(13, NOISE_TILE_W)).toBe(wrapDrift(13 + NOISE_TILE_W * 7, NOISE_TILE_W));
    // The background drifts towards -∞: its wrap must stay positive.
    expect(wrapDrift(-13, NOISE_TILE_W)).toBe(NOISE_TILE_W - 13);
  });
});

describe("layoutRevealGlyphs", () => {
  // Per-glyph advance = measured 10px × the 1.2 letter-spacing factor.
  const measure10 = (_ch: string, _px: number) => 10;

  it("keeps surrogate pairs as single glyphs", () => {
    const l = layoutRevealGlyphs(Array.from("😀ab"), measure10, 300, 40, 2);
    expect(l.glyphs.map((g) => g.ch)).toEqual(["😀", "a", "b"]);
  });

  it("centers a fitting row without scaling (device-px coordinates)", () => {
    // basePx clamps to 22 at a 40px-tall box (0.62 band); advances are
    // 10 × 1.2 letter-spacing = 12 CSS px; raw 36 < avail 272 → no
    // shrink; the row is centered and advances are dpr-scaled.
    const l = layoutRevealGlyphs(["a", "b", "c"], measure10, 300, 40, 2);
    expect(l.fontPx).toBe(44);
    expect(l.glyphs.map((g) => g.x)).toEqual([264, 288, 312]);
    expect(l.glyphs.every((g) => g.advance === 24)).toBe(true);
  });

  it("adds letter-spacing to every advance", () => {
    // The spacing is what separates packed password characters at noise
    // resolutions — pin the factor itself so a "simplification" back to
    // the raw advance goes red.
    const l = layoutRevealGlyphs(["a", "b"], measure10, 300, 40, 1);
    expect(l.glyphs[0]!.advance).toBeCloseTo(12, 10);
  });

  it("scales an overflowing row down with a 0.5 floor", () => {
    const narrow = layoutRevealGlyphs(
      Array.from("x".repeat(40)),
      measure10,
      300,
      40,
      1,
    );
    // raw 480 > avail 272 → scale 0.5667.
    expect(narrow.fontPx).toBeCloseTo(22 * (272 / 480), 10);
    const extreme = layoutRevealGlyphs(
      Array.from("x".repeat(200)),
      measure10,
      300,
      40,
      1,
    );
    expect(extreme.fontPx).toBeCloseTo(22 * 0.5, 10);
  });

  it("keeps the visual size band regardless of box height", () => {
    const tiny = layoutRevealGlyphs(["a"], measure10, 300, 8, 1);
    const huge = layoutRevealGlyphs(["a"], measure10, 300, 400, 1);
    expect(tiny.fontPx).toBe(13);
    expect(huge.fontPx).toBe(22);
  });

  it("returns an empty layout for an empty row", () => {
    const l = layoutRevealGlyphs([], measure10, 300, 40, 2);
    expect(l.glyphs).toEqual([]);
  });
});

describe("RevealNoisePainter", () => {
  it("seeds the background drift phase from randomness at each hold", () => {
    const p = new RevealNoisePainter();
    const rand = vi.spyOn(Math, "random").mockReturnValue(0.25);
    try {
      p.beginHold([220, 10, 15]);
      // One phase draw before retile; happy-dom has no 2d context, so
      // the tile build bails before consuming any more randomness. The
      // glyph region has NO phase accumulator — its boiling phase is a
      // fresh random draw per paint frame.
      expect(p.peekDrift().background).toBeCloseTo(0.25 * NOISE_TILE_W, 10);
    } finally {
      rand.mockRestore();
    }
  });

  it("accumulates the background drift in device px", () => {
    const p = new RevealNoisePainter();
    p.beginHold([220, 10, 15]);
    const before = p.peekDrift();
    p.advance(0.25, 2);
    const mid = p.peekDrift();
    expect(mid.background - before.background).toBeCloseTo(
      BACKGROUND_DRIFT_PX_S * 2 * 0.25,
      10,
    );
    p.advance(0.25, 2);
    const after = p.peekDrift();
    expect(after.background - mid.background).toBeCloseTo(BACKGROUND_DRIFT_PX_S * 0.5, 10);
  });

  it("never throws without a 2d context and stays unusable (fallback path)", () => {
    const p = new RevealNoisePainter();
    expect(() => p.beginHold([220, 10, 15])).not.toThrow();
    expect(p.available).toBe(false);
  });
});

describe("RevealFilterPainter", () => {
  it("seeds both layer phases from randomness at each hold", () => {
    const p = new RevealFilterPainter();
    const rand = vi.spyOn(Math, "random").mockReturnValue(0.25);
    try {
      p.beginHold("dark");
      // Drift-sign draw, then one phase draw per layer before retile;
      // happy-dom has no 2d context, so the tile builds bail before
      // consuming any more randomness.
      const d = p.peekDrift();
      expect(d.background).toBeCloseTo(0.25 * NOISE_TILE_W, 10);
      expect(d.ink).toBeCloseTo(0.25 * NOISE_TILE_W, 10);
    } finally {
      rand.mockRestore();
    }
  });

  it("drifts the two layers in OPPOSITE directions at equal speed", () => {
    // The segregation cue IS the 180° direction difference: a mutation
    // sending both layers the same way (or at unequal speeds) must go
    // red here.
    const p = new RevealFilterPainter();
    const rand = vi.spyOn(Math, "random").mockReturnValue(0.25); // driftSign = +1
    try {
      p.beginHold("dark");
      const before = p.peekDrift();
      p.advance(0.25, 2);
      const after = p.peekDrift();
      const step = FILTER_DRIFT_PX_S * 2 * 0.25;
      expect(after.background - before.background).toBeCloseTo(step, 10);
      expect(after.ink - before.ink).toBeCloseTo(-step, 10);
    } finally {
      rand.mockRestore();
    }
  });

  it("flips both drift directions when the per-hold draw says so", () => {
    const p = new RevealFilterPainter();
    const rand = vi.spyOn(Math, "random").mockReturnValue(0.75); // driftSign = -1
    try {
      p.beginHold("dark");
      const before = p.peekDrift();
      p.advance(0.25, 2);
      const after = p.peekDrift();
      const step = FILTER_DRIFT_PX_S * 2 * 0.25;
      expect(after.background - before.background).toBeCloseTo(-step, 10);
      expect(after.ink - before.ink).toBeCloseTo(step, 10);
    } finally {
      rand.mockRestore();
    }
  });

  it("never throws without a 2d context and stays unusable (fallback path)", () => {
    const p = new RevealFilterPainter();
    expect(() => p.beginHold("dark")).not.toThrow();
    expect(p.available).toBe(false);
  });
});

describe("sweepWindow", () => {
  const dpr = 1;
  // A 100px travel at 220 CSS px/s ≈ 0.4545s of movement per cycle.
  const start = 100;
  const end = 200;
  const winW = 60;

  it("starts the window center at the span start and moves right", () => {
    expect(sweepWindow(start, end, winW, 0, dpr).x).toBe(start);
    const mid = sweepWindow(start, end, winW, 0.2, dpr);
    expect(mid.x).toBeGreaterThan(start);
    expect(mid.x).toBeLessThan(end);
  });

  it("reaches the span end and dwells there for the pause", () => {
    const moveT = (end - start) / SWEEP_SPEED_CSS_PX_S;
    expect(sweepWindow(start, end, winW, moveT, dpr).x).toBe(end);
    // Mid-dwell: still at the end, not yet looping.
    expect(sweepWindow(start, end, winW, moveT + SWEEP_END_PAUSE_S / 2, dpr).x).toBe(end);
  });

  it("loops with a period of travel + pause, phase-aligned", () => {
    const cycle = (end - start) / SWEEP_SPEED_CSS_PX_S + SWEEP_END_PAUSE_S;
    const a = sweepWindow(start, end, winW, 0.1, dpr);
    const b = sweepWindow(start, end, winW, 0.1 + cycle, dpr);
    expect(b.x).toBeCloseTo(a.x, 10);
    // Negative t folds into the same cycle (defensive modulo).
    expect(sweepWindow(start, end, winW, 0.1 - cycle, dpr).x).toBeCloseTo(a.x, 10);
  });

  it("carries the window width through and survives a degenerate span", () => {
    expect(sweepWindow(start, end, winW, 0.1, dpr).w).toBe(winW);
    // start == end: travel clamps to >=1, never divides by zero.
    expect(() => sweepWindow(50, 50, winW, 0.1, dpr)).not.toThrow();
    expect(sweepWindow(50, 50, winW, 0.1, dpr).x).toBeGreaterThanOrEqual(50);
  });
});
