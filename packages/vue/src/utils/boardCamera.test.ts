import { describe, expect, it } from "vitest";

import {
  BOARD_FIT_CAP,
  BOARD_K_MAX,
  BOARD_ZOOM_FACTOR,
  boardBBox,
  boardClampPan,
  boardEaseOutCubic,
  boardFit,
  boardFitPercent,
  boardLevelOf,
  boardStepRung,
  boardToScreen,
  boardTweenCam,
  boardToWorld,
  boardZoomAt,
  quantizeBoardK,
  quantizeBoardPercentK,
  quantizeBoardStep,
} from "./boardCamera";

describe("boardCamera — 5% geometric ladder", () => {
  it("snaps arbitrary zooms onto 1.05ⁿ rungs", () => {
    expect(quantizeBoardK(1)).toBe(1);
    expect(quantizeBoardK(1.02)).toBe(1);
    expect(quantizeBoardK(1.04)).toBeCloseTo(1.05, 5);
    expect(quantizeBoardK(BOARD_ZOOM_FACTOR ** 3)).toBeCloseTo(BOARD_ZOOM_FACTOR ** 3, 5);
  });

  it("clamps to the global zoom bounds", () => {
    expect(quantizeBoardK(0.01)).toBeLessThanOrEqual(0.2);
    expect(quantizeBoardK(99)).toBeGreaterThanOrEqual(4);
  });

  it("quantizes a pinch step relative to its base", () => {
    const base = 0.8;
    // a pinch whose raw target is exactly two rungs above the base lands
    // there: base·1.05² (ratio = raw/base)
    expect(quantizeBoardStep(base, 1.05 ** 2)).toBeCloseTo(base * BOARD_ZOOM_FACTOR ** 2, 5);
    // a ratio inside the same rung stays on the base rung
    expect(quantizeBoardStep(base, 1.02)).toBeCloseTo(base, 5);
  });
});

describe("boardCamera — exact linear percent ladder", () => {
  const governance = { stepPercent: 5, minK: 0.5, maxK: 2 };

  it("lands arbitrary scales on exact 5% multiples within the host bounds", () => {
    // MUT:linear-percent-rungs — using the geometric quantizer never passes:
    // 1.05ⁿ produces labels such as 116%, while every result here is a 5%
    // multiple and stays inside the Mermaid 50–200% window.
    const samples = [0.2, 0.5, 0.52, 0.87, 1, 1.37, 1.98, 2, 3];
    const actual = samples.map((k) => quantizeBoardPercentK(k, governance));
    expect(actual).toEqual([0.5, 0.5, 0.5, 0.85, 1, 1.35, 2, 2, 2]);
    for (const k of actual) expect((k * 100) % 5).toBeCloseTo(0, 8);
  });

  it("fit rounds DOWN to 85% instead of cropping at the nearest rung", () => {
    // Raw fit = (600 − 80) / 600 = 0.8666…, so nearest would choose 90% and
    // cut off content; floor chooses 85%. MUT:fit-floor — changing floor to
    // nearest catches this exact regression.
    const content = { x: 0, y: 0, w: 100, h: 600 };
    const viewport = { w: 800, h: 600 };
    const raw = boardFit(content, viewport, { cap: 1 });
    const fitted = boardFitPercent(content, viewport, { ...governance, cap: 1 });
    expect(raw.k).toBeGreaterThan(0.85);
    expect(raw.k).toBeLessThan(0.9);
    expect(fitted.k).toBe(0.85);
    expect(fitted.k).toBeLessThanOrEqual(raw.k);
  });

  it("reserves the minimap's end-edge dock out of the fitted content", () => {
    // MUT:minimap-fit-reserve — dropping endReserve from either the scale or
    // centering equation catches a real overlap: the unreserved fit puts the
    // content's end at 760px, through a dock that begins at 630px.
    const content = { x: 0, y: 0, w: 900, h: 200 };
    const viewport = { w: 800, h: 600 };
    const fitted = boardFitPercent(content, viewport, {
      ...governance,
      cap: 1,
      endReserve: 180,
    });
    expect(fitted.k).toBe(0.6);
    const drawnRight = fitted.x + (content.x + content.w) * fitted.k;
    expect(drawnRight).toBeLessThanOrEqual(viewport.w - 180);
    // 160px map + 10px inset means its left edge is 630px.
    expect(drawnRight).toBeLessThan(630);
  });

  it("keeps a long diagram at the readable 50% floor for panning", () => {
    const content = { x: 0, y: 0, w: 300, h: 6000 };
    const viewport = { w: 800, h: 400 };
    const fitted = boardFitPercent(content, viewport, governance);
    expect(boardFit(content, viewport).k).toBeLessThan(0.5);
    expect(fitted.k).toBe(0.5);
    // The centred 50% camera is taller than the viewport, so the board's
    // existing pan clamp has something meaningful to reveal.
    expect(content.h * fitted.k).toBeGreaterThan(viewport.h);
  });

  it("preserves the zero sentinel for a hidden viewport", () => {
    const fitted = boardFitPercent(
      { x: 0, y: 0, w: 100, h: 100 },
      { w: 0, h: 0 },
      governance,
    );
    expect(fitted.k).toBe(0);
  });
});

describe("boardCamera — anchor zoom", () => {
  it("keeps the world point under the screen anchor fixed", () => {
    const cam = { x: 40, y: -20, k: 1 };
    const anchor = { x: 300, y: 200 };
    const worldBefore = boardToWorld(cam, anchor.x, anchor.y);
    const zoomed = boardZoomAt(cam, 1.5, anchor);
    const worldAfter = boardToWorld(zoomed, anchor.x, anchor.y);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6);
    expect(zoomed.k).toBe(1.5);
  });

  it("keeps the anchor world point fixed when zooming to a QUANTIZED rung", () => {
    // The settle path (wheel notch / pinch release) must quantize k FIRST
    // and then solve the anchored pan for the quantized k — anchoring on
    // the raw k and swapping the rung in afterwards jumps the world point.
    const cam = { x: 40, y: -20, k: 2.3 };
    const anchor = { x: 300, y: 200 };
    const worldBefore = boardToWorld(cam, anchor.x, anchor.y);
    const settled = boardZoomAt(cam, quantizeBoardK(cam.k), anchor);
    const worldAfter = boardToWorld(settled, anchor.x, anchor.y);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6);
    expect(settled.k).toBe(quantizeBoardK(cam.k));
  });

  it("round-trips screen→world→screen", () => {
    const cam = { x: -130, y: 88, k: 1.3 };
    const p = boardToScreen(cam, 42, -7);
    const w = boardToWorld(cam, p.x, p.y);
    expect(w.x).toBeCloseTo(42, 6);
    expect(w.y).toBeCloseTo(-7, 6);
  });
});

describe("boardCamera — pan clamp + fit", () => {
  const content = { x: 0, y: 0, w: 2000, h: 1200 };
  const viewport = { w: 800, h: 600 };

  it("keeps half a viewport of slack for oversized content", () => {
    const cam = boardClampPan({ k: 1, x: 9999, y: -9999 }, content, viewport);
    expect(cam.x).toBeLessThanOrEqual(400);
    expect(cam.y).toBeGreaterThanOrEqual(-1200 - 300);
  });

  it("re-centers content smaller than the viewport", () => {
    const small = { x: 0, y: 0, w: 200, h: 100 };
    const cam = boardClampPan({ k: 1, x: -500, y: 999 }, small, viewport);
    expect(cam.x).toBe((viewport.w - 200) / 2);
    expect(cam.y).toBe((viewport.h - 100) / 2);
  });

  it("fits the whole board with padding and honors the cap", () => {
    const cam = boardFit(content, viewport);
    expect(cam.k).toBeCloseTo(Math.min((800 - 80) / 2000, (600 - 80) / 1200), 6);
    const tiny = boardFit({ x: 0, y: 0, w: 60, h: 40 }, viewport);
    expect(tiny.k).toBeLessThanOrEqual(BOARD_FIT_CAP);
  });

  it("shrinks below the interaction minimum to fit very wide boards", () => {
    // 8000 world px in an 800 px viewport: fit k = 720/8000 = 0.09, far
    // below the old 0.2 floor that cropped such boards on open.
    const wide = { x: 0, y: 0, w: 8000, h: 600 };
    const cam = boardFit(wide, viewport);
    expect(cam.k).toBeCloseTo((800 - 80) / 8000, 6);
    expect(cam.k).toBeLessThan(0.2);
    // the whole board lands inside the viewport
    const tl = boardToScreen(cam, 0, 0);
    const br = boardToScreen(cam, 8000, 600);
    expect(tl.x).toBeGreaterThanOrEqual(0);
    expect(br.x).toBeLessThanOrEqual(viewport.w);
  });

  it("never mirrors a degenerate viewport (0 or sub-padding size)", () => {
    // A board mounted inside a hidden tab / collapsed panel measures 0 and
    // the old formula produced (0 - 80) / width = a NEGATIVE k, which paints
    // the whole world mirrored and shrunken (measured on the docs site's
    // mermaid cards). Fit must answer "no room" with zero, never a negative.
    const contentWide = { x: 0, y: 0, w: 1538, h: 266 };
    for (const vp of [
      { w: 0, h: 0 },
      { w: 0, h: 304 },
      { w: 40, h: 40 },
    ]) {
      const cam = boardFit(contentWide, vp);
      expect(cam.k).toBeGreaterThanOrEqual(0);
    }
    // The wide-board framing that used to be negative still works once the
    // viewport is real.
    const recovered = boardFit(contentWide, { w: 786, h: 304 });
    expect(recovered.k).toBeGreaterThan(0);
    expect(recovered.k).toBeCloseTo((786 - 80) / 1538, 6);
  });
});

describe("boardCamera — minimap step rungs", () => {
  const lastRung = BOARD_ZOOM_FACTOR ** 28; // ≈3.92 — last rung below the cap

  it("pushes a linear +5% step that nearest-rounds onto the current rung", () => {
    // from 392%, the + button targets 397% — nearest rounding falls back
    // onto rung 28 (the dead band), so the step resolves one rung further
    // and clamps to the cap.
    expect(quantizeBoardK(3.97)).toBeCloseTo(lastRung, 5);
    expect(boardStepRung(lastRung, 3.97)).toBe(BOARD_K_MAX);
  });

  it("pushes a linear −5% step onto the rung below, not the current one", () => {
    expect(boardStepRung(lastRung, 3.87)).toBeCloseTo(BOARD_ZOOM_FACTOR ** 27, 5);
  });

  it("leaves steps that already resolve to a different rung untouched", () => {
    expect(boardStepRung(1, 1.05)).toBeCloseTo(BOARD_ZOOM_FACTOR, 5);
    expect(boardStepRung(1, 0.95)).toBeCloseTo(BOARD_ZOOM_FACTOR ** -1, 5);
  });

  it("steps from the ladder floor up onto the nearest live rung", () => {
    expect(boardStepRung(0.2, 0.25)).toBeCloseTo(BOARD_ZOOM_FACTOR ** -28, 5);
  });
});

describe("boardCamera — animated tween", () => {
  it("interpolates k geometrically and eases the endpoints", () => {
    const from = { x: 0, y: 0, k: 1 };
    const to = { x: 100, y: -50, k: 1.05 ** 4 };
    // t=0.5 eases to 0.875 — the geometric mid sits at that eased point
    const half = boardTweenCam(from, to, 0.5);
    const eased = boardEaseOutCubic(0.5);
    expect(half.k).toBeCloseTo(from.k * (to.k / from.k) ** eased, 6);
    expect(half.x).toBeGreaterThan(0);
    const done = boardTweenCam(from, to, 1);
    expect(done).toEqual(to);
    const start = boardTweenCam(from, to, 0);
    expect(start).toEqual(from);
  });

  it("reports the ladder level consistently", () => {
    expect(boardLevelOf(1)).toBe(0);
    expect(boardLevelOf(BOARD_ZOOM_FACTOR)).toBeCloseTo(1, 6);
  });
});

describe("boardCamera — content bbox", () => {
  it("unions rects and ignores empty ones", () => {
    const box = boardBBox([
      { x: 10, y: 10, w: 100, h: 50 },
      { x: 200, y: 0, w: 50, h: 40 },
      { x: 0, y: 0, w: 0, h: 0 },
    ]);
    expect(box).toEqual({ x: 10, y: 0, w: 240, h: 60 });
  });

  it("falls back to a default rect with no content", () => {
    expect(boardBBox([]).w).toBeGreaterThan(0);
  });

  it("counts zero-size junctions as points when asked", () => {
    // a sequence diagram's message rows live on invisible junctions: the
    // fit must see them or it frames the participant headers alone
    const box = boardBBox([{ x: 10, y: 10, w: 100, h: 50 }, { x: 260, y: 400, w: 0, h: 0 }], { points: true });
    expect(box).toEqual({ x: 10, y: 10, w: 250, h: 390 });
  });

  it("a junction without a finite position is a placeholder, not content", () => {
    // One NaN would poison every min/max, and the isFinite fallback below
    // could no longer tell — the fit would compute k = NaN (a blank board).
    const box = boardBBox([{ x: 10, y: 10, w: 100, h: 50 }, { x: Number.NaN, y: 400, w: 0, h: 0 }], { points: true });
    expect(box).toEqual({ x: 10, y: 10, w: 100, h: 50 });
  });
});

describe("boardCamera — content smaller than the viewport", () => {
  const content = { x: 0, y: 0, w: 200, h: 100 };
  const viewport = { w: 800, h: 600 };

  it("re-centers by default (a fitted board cannot be dragged)", () => {
    const cam = boardClampPan({ x: 500, y: -900, k: 1 }, content, viewport);
    expect(cam.x).toBe(300);
    expect(cam.y).toBe(250);
  });

  it('"keep" lets it float while half of it stays in view', () => {
    const far = boardClampPan({ x: 5000, y: -900, k: 1 }, content, viewport, 0.5, "keep");
    expect(far.x).toBe(viewport.w - 100);
    expect(far.y).toBe(-50);
    expect(boardClampPan({ x: 120, y: 33, k: 1 }, content, viewport, 0.5, "keep")).toEqual({ x: 120, y: 33, k: 1 });
  });

  it("content larger than the viewport clamps the same way in both modes", () => {
    const big = { x: 0, y: 0, w: 2000, h: 100 };
    expect(boardClampPan({ x: 900, y: 0, k: 1 }, big, viewport, 0.5, "keep").x)
      .toBe(boardClampPan({ x: 900, y: 0, k: 1 }, big, viewport).x);
  });
});
