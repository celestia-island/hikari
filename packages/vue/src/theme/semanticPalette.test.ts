import { describe, expect, it } from "vitest";

import { stockDefaultPreset, type ThemeTokenRGB } from "./presets";
import {
  CANONICAL_SEMANTIC,
  contrastRatio,
  deriveSemanticPalette,
  hueDistance,
  oklchToRgb,
  rgbToOklch,
} from "./semanticPalette";

const rgb = (r: number, g: number, b: number): ThemeTokenRGB => ({ r, g, b });

// Guide-shaped three-anchor fixtures (Catppuccin Mocha / Latte anchors)
// — the shape chest's plugin guide documents and its applier fills.
const DARK_FILLS = {
  primary: rgb(24, 24, 37),
  background: rgb(17, 17, 27),
  surface: rgb(49, 50, 68),
};
const LIGHT_FILLS = {
  primary: rgb(30, 102, 245),
  background: rgb(239, 241, 245),
  surface: rgb(255, 255, 255),
};
const OPPOSITE_FILLS = {
  primary: rgb(136, 192, 208),
  background: rgb(245, 245, 240), // light bg …
  surface: rgb(22, 27, 38), // … dark surface
};

describe("OKLCH conversion", () => {
  it("round-trips 8-bit colours EXACTLY (any matrix typo reddens)", () => {
    for (let i = 0; i < 64; i++) {
      const c = rgb(
        (i * 37) % 256,
        (i * 91) % 256,
        (i * 151) % 256,
      );
      expect(oklchToRgb(rgbToOklch(c))).toEqual(c);
    }
  });

  it("matches Ottosson's reference values (the toe and the matrices)", () => {
    expect(rgbToOklch(rgb(255, 0, 0)).h).toBeCloseTo(29.23, 1);
    expect(rgbToOklch(rgb(0, 0, 255)).h).toBeCloseTo(264.05, 1);
    expect(rgbToOklch(rgb(255, 255, 255)).l).toBeCloseTo(1.0, 3);
  });

  it("keeps a constant hue when only lightness changes", () => {
    const a = rgbToOklch(oklchToRgb({ l: 0.7, c: 0.11, h: 150 }));
    const b = rgbToOklch(oklchToRgb({ l: 0.4, c: 0.11, h: 150 }));
    expect(hueDistance(a.h, 150)).toBeLessThan(2);
    expect(hueDistance(b.h, 150)).toBeLessThan(2);
  });
});

describe("the canonical family", () => {
  it("matches BOTH shipped stock tables' hues within 20°", () => {
    const families = [
      { success: stockDefaultPreset.dark.success, error: stockDefaultPreset.dark.error, warning: stockDefaultPreset.dark.warning, info: stockDefaultPreset.dark.info },
      { success: stockDefaultPreset.light.success, error: stockDefaultPreset.light.error, warning: stockDefaultPreset.light.warning, info: stockDefaultPreset.light.info },
    ];
    for (const fam of families) {
      for (const key of ["success", "error", "warning", "info"] as const) {
        expect(
          hueDistance(rgbToOklch(fam[key]).h, CANONICAL_SEMANTIC[key].h),
          `${key} canonical hue`,
        ).toBeLessThan(20);
      }
    }
  });
});

// The mid-tone regime (the readable band sits at the DARK end): the
// gamut mapping must keep the four hues distinct here, where a
// per-channel clamp collapsed error and warning to the same bytes.
const GRAPHITE_FILLS = {
  primary: rgb(120, 120, 125),
  background: rgb(126, 126, 131),
  surface: rgb(144, 144, 149),
};

describe("deriveSemanticPalette — the documented 3-anchor shapes", () => {
  it("every TEXT-bearing semantic slot clears AA on BOTH fills (dark)", () => {
    const p = deriveSemanticPalette(DARK_FILLS);
    for (const slot of ["success", "error", "warning", "info", "secondary", "accent"] as const) {
      expect(
        contrastRatio(p[slot], DARK_FILLS.background),
        `${slot}/background`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p[slot], DARK_FILLS.surface), `${slot}/surface`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("every TEXT-bearing semantic slot clears AA on BOTH fills (light)", () => {
    const p = deriveSemanticPalette(LIGHT_FILLS);
    for (const slot of ["success", "error", "warning", "info", "secondary", "accent"] as const) {
      expect(contrastRatio(p[slot], LIGHT_FILLS.background), `${slot}/background`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p[slot], LIGHT_FILLS.surface), `${slot}/surface`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the four semantic tones stay DISTINCT (pairwise hue ≥ 30°)", () => {
    for (const fills of [DARK_FILLS, LIGHT_FILLS, OPPOSITE_FILLS]) {
      const p = deriveSemanticPalette(fills);
      const hues = {
        success: rgbToOklch(p.success).h,
        error: rgbToOklch(p.error).h,
        warning: rgbToOklch(p.warning).h,
        info: rgbToOklch(p.info).h,
      };
      const entries = Object.entries(hues);
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          expect(
            hueDistance(entries[i][1], entries[j][1]),
            `${entries[i][0]} vs ${entries[j][0]}`,
          ).toBeGreaterThanOrEqual(30);
        }
      }
    }
  });

  it("the derived tones couple to CANONICAL_SEMANTIC (the constant IS the hue)", () => {
    for (const fills of [DARK_FILLS, LIGHT_FILLS, OPPOSITE_FILLS]) {
      const p = deriveSemanticPalette(fills);
      for (const key of ["success", "error", "warning", "info"] as const) {
        expect(
          hueDistance(rgbToOklch(p[key]).h, CANONICAL_SEMANTIC[key].h),
          `${key} derives from the canonical constant`,
        ).toBeLessThan(15);
      }
    }
  });

  it("secondary/accent are the primary's hue rotated ±40° (before clamping)", () => {
    const p = deriveSemanticPalette(DARK_FILLS);
    const h = rgbToOklch(DARK_FILLS.primary).h;
    // The dark fixture barely clamps (measured offsets 41.8/39.8); the
    // light fixture's accent clamps to -34.5, hence "before clamping".
    expect(hueDistance(rgbToOklch(p.secondary).h, (h + 40) % 360)).toBeLessThanOrEqual(6);
    expect(hueDistance(rgbToOklch(p.accent).h, (h + 320) % 360)).toBeLessThanOrEqual(6);
  });

  it("opposite-polarity fills sit at the chroma-rich NEAR-optimum (≥3.6, distinct)", () => {
    // No lightness clears AA on opposite anchors; the fallback keeps the
    // most surviving chroma within 0.35 of the best worst-anchor — the
    // measured band is 3.63-3.95 here (the raw optimum would trade the
    // hue for +0.05-0.33 it does not need).
    const p = deriveSemanticPalette(OPPOSITE_FILLS);
    const bytes = (["success", "error", "warning", "info"] as const).map(
      (slot) => `${p[slot].r},${p[slot].g},${p[slot].b}`,
    );
    expect(new Set(bytes).size, "the four tones stay distinct").toBe(4);
    for (const slot of ["success", "error", "warning", "info", "secondary", "accent"] as const) {
      const worst = Math.min(
        contrastRatio(p[slot], OPPOSITE_FILLS.background),
        contrastRatio(p[slot], OPPOSITE_FILLS.surface),
      );
      expect(worst, `${slot} near-optimal`).toBeGreaterThanOrEqual(3.6);
    }
  });

  it("the semantic hues are the CANONICAL hues, not the primary's", () => {
    const p = deriveSemanticPalette(DARK_FILLS);
    // The guide fixture's primary is a desaturated indigo (~295°): every
    // canonical hue must be far from it.
    const primaryHue = rgbToOklch(DARK_FILLS.primary).h;
    for (const key of ["success", "error", "warning", "info"] as const) {
      expect(hueDistance(rgbToOklch(p[key]).h, primaryHue), key).toBeGreaterThanOrEqual(30);
    }
  });

  it("the brand chroma cap holds (secondary/accent ≤0.125 after rounding)", () => {
    for (const fills of [DARK_FILLS, LIGHT_FILLS, GRAPHITE_FILLS]) {
      const p = deriveSemanticPalette(fills);
      expect(rgbToOklch(p.secondary).c).toBeLessThanOrEqual(0.125);
      expect(rgbToOklch(p.accent).c).toBeLessThanOrEqual(0.125);
    }
  });

  it("borders follow the primary's hue at reduced chroma", () => {
    const p = deriveSemanticPalette(DARK_FILLS);
    const primaryHue = rgbToOklch(DARK_FILLS.primary).h;
    expect(hueDistance(rgbToOklch(p.border).h, primaryHue)).toBeLessThan(10);
    expect(hueDistance(rgbToOklch(p.focusedBorder).h, primaryHue)).toBeLessThan(10);
    expect(rgbToOklch(p.border).c).toBeLessThan(rgbToOklch(p.focusedBorder).c);
    // Borders are non-text: they clear 1.5 / 3 respectively.
    expect(contrastRatio(p.border, DARK_FILLS.background)).toBeGreaterThanOrEqual(1.5);
    expect(contrastRatio(p.focusedBorder, DARK_FILLS.background)).toBeGreaterThanOrEqual(3);
  });

  it("a mid-tone (graphite) theme keeps the four hues distinct", () => {
    const p = deriveSemanticPalette(GRAPHITE_FILLS);
    const hues = {
      success: rgbToOklch(p.success).h,
      error: rgbToOklch(p.error).h,
      warning: rgbToOklch(p.warning).h,
      info: rgbToOklch(p.info).h,
    };
    const entries = Object.entries(hues);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        expect(
          hueDistance(entries[i][1], entries[j][1]),
          `${entries[i][0]} vs ${entries[j][0]}`,
        ).toBeGreaterThanOrEqual(30);
      }
    }
    for (const slot of ["success", "error", "warning", "info"] as const) {
      expect(contrastRatio(p[slot], GRAPHITE_FILLS.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p[slot], GRAPHITE_FILLS.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the 0.70 calibration is pinned by SNAPSHOT (dark guide fixture)", () => {
    // The bias is a VALUE choice; any drift (0.55, 0.85, ...) moves
    // bytes inside the clearing band with no other pin the wiser.
    const p = deriveSemanticPalette(DARK_FILLS);
    expect(`${p.success.r},${p.success.g},${p.success.b}`).toBe("109,178,120");
    expect(`${p.error.r},${p.error.g},${p.error.b}`).toBe("246,116,120");
    expect(`${p.warning.r},${p.warning.g},${p.warning.b}`).toBe("219,137,69");
    expect(`${p.info.r},${p.info.g},${p.info.b}`).toBe("84,174,194");
  });

  it("the search keeps the AA MARGIN (graphite tightest slot ≥4.55)", () => {
    const p = deriveSemanticPalette(GRAPHITE_FILLS);
    let tightest = Number.POSITIVE_INFINITY;
    for (const slot of ["success", "error", "warning", "info"] as const) {
      tightest = Math.min(
        tightest,
        contrastRatio(p[slot], GRAPHITE_FILLS.background),
        contrastRatio(p[slot], GRAPHITE_FILLS.surface),
      );
    }
    expect(tightest).toBeGreaterThanOrEqual(4.55);
  });

  it("the border rungs never invert on SAME-polarity fills", () => {
    // On MIXED-polarity fills the ordering necessarily inverts (to
    // under-contrast a light fill the border must be lighter than
    // focused; a dark fill darker — mutually exclusive), so the pin
    // covers same-polarity fixtures and the thresholds hold everywhere.
    for (const fills of [DARK_FILLS, LIGHT_FILLS, GRAPHITE_FILLS]) {
      const p = deriveSemanticPalette(fills);
      const rest = Math.min(
        contrastRatio(p.border, fills.background),
        contrastRatio(p.border, fills.surface),
      );
      const focus = Math.min(
        contrastRatio(p.focusedBorder, fills.background),
        contrastRatio(p.focusedBorder, fills.surface),
      );
      expect(rest, "the resting border sits under the focused rung").toBeLessThan(focus);
      expect(rest).toBeGreaterThanOrEqual(1.5);
      expect(focus).toBeGreaterThanOrEqual(3);
    }
  });

  it("a no-win fill pair keeps the four tones DISTINCT (the chroma-rich fallback)", () => {
    // gray-500 neutrals: no lightness clears AA on both fills — the raw
    // max-min optimum starves the chroma at the achromatic extremes and
    // collapsed error/warning to the same bytes. The fallback picks the
    // NEAR-optimal candidate with the most surviving chroma, so the
    // tones stay distinguishable; AA is unattainable here by physics.
    const noWin = {
      primary: rgb(120, 120, 120),
      background: rgb(107, 114, 128),
      surface: rgb(156, 163, 175),
    };
    const p = deriveSemanticPalette(noWin);
    const bytes = (["success", "error", "warning", "info"] as const).map(
      (slot) => `${p[slot].r},${p[slot].g},${p[slot].b}`,
    );
    expect(new Set(bytes).size, "the four tones are byte-distinct").toBe(4);
    for (const slot of ["success", "error", "warning", "info"] as const) {
      const worst = Math.min(
        contrastRatio(p[slot], noWin.background),
        contrastRatio(p[slot], noWin.surface),
      );
      expect(worst, `${slot} soft floor`).toBeGreaterThanOrEqual(3.0);
      for (const ch of [p[slot].r, p[slot].g, p[slot].b]) {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(255);
      }
    }
  });

  it("both barrels export the derivation (string pins)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const root = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf-8");
    const theme = readFileSync(resolve(process.cwd(), "src/theme/index.ts"), "utf-8");
    for (const src of [root, theme]) {
      expect(src).toContain("deriveSemanticPalette");
      expect(src).toContain("CANONICAL_SEMANTIC");
    }
  });

  it("oklchToRgb sanitizes hostile inputs (never NaN into a cssvar)", () => {
    const out = oklchToRgb({ l: NaN, c: 0.1, h: 100 });
    expect(Number.isFinite(out.r)).toBe(true);
    expect(Number.isFinite(out.g)).toBe(true);
    expect(Number.isFinite(out.b)).toBe(true);
    const mirrored = oklchToRgb({ l: 0.5, c: -0.1, h: 100 });
    // Negative chroma clamps to ZERO — a grey (a mirrored hue would be
    // the silent alternative).
    expect(mirrored.r).toBe(mirrored.g);
    expect(mirrored.g).toBe(mirrored.b);
    const wrapped = oklchToRgb({ l: 0.5, c: 0.1, h: 460 });
    expect(rgbToOklch(wrapped).h).toBeCloseTo(100, 0);
  });

  it("the status bar is the surface (the definitional answer)", () => {
    for (const fills of [DARK_FILLS, LIGHT_FILLS]) {
      const p = deriveSemanticPalette(fills);
      expect(p.statusBarBackground).toEqual(fills.surface);
      // A COPY, not the caller's own object.
      expect(p.statusBarBackground).not.toBe(fills.surface);
    }
  });

  it("opposite-polarity fills never leave an anchor below 2.1 (the floor family)", () => {
    const p = deriveSemanticPalette(OPPOSITE_FILLS);
    for (const slot of ["success", "error", "warning", "info", "secondary", "accent"] as const) {
      const worst = Math.min(
        contrastRatio(p[slot], OPPOSITE_FILLS.background),
        contrastRatio(p[slot], OPPOSITE_FILLS.surface),
      );
      expect(worst, `${slot} worst anchor`).toBeGreaterThanOrEqual(2.1);
    }
  });

  it("is deterministic and does not mutate its inputs", () => {
    const fills = { ...DARK_FILLS, background: { ...DARK_FILLS.background } };
    const before = JSON.stringify(fills);
    const a = deriveSemanticPalette(fills);
    const b = deriveSemanticPalette(fills);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(fills)).toBe(before);
    // Channels are integers in range.
    for (const v of Object.values(a)) {
      for (const ch of [v.r, v.g, v.b]) {
        expect(Number.isInteger(ch)).toBe(true);
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(255);
      }
    }
  });
});
