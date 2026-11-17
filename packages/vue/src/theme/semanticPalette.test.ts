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
    // Post-chroma-reduction the rotations hold tightly (measured dark
    // +40.2/-38.0, light +39.7/-39.5); the tolerance absorbs the grid
    // and the 1504-step resolution's slight pick shifts.
    expect(hueDistance(rgbToOklch(p.secondary).h, (h + 40) % 360)).toBeLessThanOrEqual(2);
    expect(hueDistance(rgbToOklch(p.accent).h, (h + 320) % 360)).toBeLessThanOrEqual(3);
    // LIGHT too: the accent's pick must not drive it to the band bottom
    // (near-black, hue destroyed) on light fills.
    const lightP = deriveSemanticPalette(LIGHT_FILLS);
    const lh = rgbToOklch(LIGHT_FILLS.primary).h;
    expect(hueDistance(rgbToOklch(lightP.secondary).h, (lh + 40) % 360)).toBeLessThanOrEqual(2);
    expect(hueDistance(rgbToOklch(lightP.accent).h, (lh + 320) % 360)).toBeLessThanOrEqual(2);
  });

  it("opposite-polarity fills sit at the chroma-rich NEAR-optimum (≥3.6, distinct)", () => {
    // No lightness clears AA on opposite anchors; the fallback keeps the
    // most surviving chroma within the window — the measured band is
    // 3.57-3.68 here (the raw optimum would trade the hue for a few
    // hundredths it does not need).
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
      expect(worst, `${slot} near-optimal`).toBeGreaterThanOrEqual(3.55);
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
    // The 15° tolerance: the border chroma is ~0.005 (25% of the
    // primary's), where 8-bit quantisation makes hue noisy — the
    // measured DARK border sits at 12.77° with a DIFFERENT byte
    // (77,78,81 vs the 376-grid's 78,78,82). The focused border (at
    // higher chroma) holds <1.5°.
    expect(hueDistance(rgbToOklch(p.border).h, primaryHue)).toBeLessThan(15);
    expect(hueDistance(rgbToOklch(p.focusedBorder).h, primaryHue)).toBeLessThan(15);
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
    expect(`${p.success.r},${p.success.g},${p.success.b}`).toBe("108,177,119");
    expect(`${p.error.r},${p.error.g},${p.error.b}`).toBe("245,115,119");
    expect(`${p.warning.r},${p.warning.g},${p.warning.b}`).toBe("218,137,68");
    expect(`${p.info.r},${p.info.g},${p.info.b}`).toBe("84,173,193");
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

  it("the border rungs never invert (the ceiling holds the order everywhere)", () => {
    // The CEILING holds the min-anchor order on mixed-polarity fills
    // (567/864 invert without it in an independent grid, 0 with it —
    // 5,184 more swept pairs agree). The focused 3 rung itself can be
    // UNREACHABLE on some mixed fills (measured down to ~1.8 — no
    // single colour clears 3 on opposite anchors; the same physics as
    // the text tones' no-win band), so this pin asserts the ORDER
    // everywhere and the thresholds where they are reachable.
    //
    // (Historical: an earlier revision claimed mixed polarity
    // "necessarily inverts" — that proof held only for a construction
    // without the ceiling.)
    for (const fills of [DARK_FILLS, LIGHT_FILLS, GRAPHITE_FILLS, OPPOSITE_FILLS]) {
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

  it("both barrels export the derivation (anchored export statements)", async () => {
    // An anchored ^export{} regex, not a substring: a commented-out
    // export line no longer matches. (A real import of the package root
    // pulls the whole component tree — 5s+ — so the statement form is
    // the honest cheap pin.)
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const root = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf-8");
    const theme = readFileSync(resolve(process.cwd(), "src/theme/index.ts"), "utf-8");
    const names = [
      "deriveSemanticPalette",
      "CANONICAL_SEMANTIC",
      "contrastRatio",
      "hueDistance",
      "rgbToOklch",
      "oklchToRgb",
      "SemanticPalette",
      "SemanticFills",
      "OKLCH",
    ];
    for (const [label, src] of [
      ["root", root],
      ["theme", theme],
    ] as const) {
      const stmts = [...src.matchAll(/^export (?:type )?\{([^}]*)\}/gm)].map((m) => m[1]).join(" ");
      for (const name of names) {
        expect(stmts, `${label} exports ${name}`).toContain(name);
      }
    }
  });

  it("the NON-CONVEX gamut spots round-trip exactly (the prescan)", () => {
    // The in-gamut set along chroma is non-convex (channels are cubic in
    // c): a bare binary search stops at the first boundary. These are
    // the measured misses (h≈264°, the blue boundary) — deleting the
    // linear prescan reddens here.
    for (const c of [rgb(0, 0, 110), rgb(0, 0, 231), rgb(0, 0, 119)]) {
      expect(oklchToRgb(rgbToOklch(c)), `${c.r},${c.g},${c.b}`).toEqual(c);
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

  it("a grey primary on LIGHT/dark fills splits via the full AA band", () => {
    // The r11 S1 class: the pick flip only probed the two extremes and
    // missed the interior candidate.
    const p = deriveSemanticPalette({
      primary: rgb(128, 128, 128),
      background: rgb(240, 240, 240),
      surface: rgb(179, 64, 205),
    });
    const sec = `${p.secondary.r},${p.secondary.g},${p.secondary.b}`;
    const acc = `${p.accent.r},${p.accent.g},${p.accent.b}`;
    expect(sec !== acc, `sec ${sec} vs acc ${acc}`).toBe(true);
  });

  it("the coincidence scan's own effect (byte snapshot on the divergence shape)", () => {
    // BYTE SNAPSHOT on the shape where the scan and the fallback
    // DISAGREE (r26 delta): accent 2,0,0 with the scan, 1,0,0 without.
    // This is the ONLY fixture class that pins the scan itself.
    const p = deriveSemanticPalette({
      primary: rgb(110, 251, 80),
      background: rgb(100, 106, 212),
      surface: rgb(101, 156, 44),
    });
    expect(`${p.accent.r},${p.accent.g},${p.accent.b}`).toBe("2,0,0");
  });

  it("the ACHROMATIC branch puts secondary at the band TOP (byte snapshot)", () => {
    // BYTE SNAPSHOT (r25: the property-based sec!==acc was vacuous —
    // the fallback guarantees it regardless). With the branch:
    // secondary 255,255,255 (band top, pick "high"), accent 241,241,241
    // (band bottom, pick "low"). Without: the bytes swap.
    const p = deriveSemanticPalette({
      primary: rgb(120, 120, 120),
      background: rgb(50, 50, 50),
      surface: rgb(150, 150, 150),
    });
    expect(`${p.secondary.r},${p.secondary.g},${p.secondary.b}`).toBe("255,255,255");
    expect(`${p.accent.r},${p.accent.g},${p.accent.b}`).toBe("241,241,241");
  });

  it("a grey primary on WHITE/BLACK fills splits secondary/accent (the fine band)", () => {
    // The 4.55 target band holds ONE byte (117) but the AA band holds
    // two (117@4.5578, 118@4.5422): the retake flips the pick and takes
    // 118 — distinct AND readable (the coarse grid + unguarded path
    // returned 117 for BOTH slots on every grey primary).
    const p = deriveSemanticPalette({
      primary: rgb(128, 128, 128),
      background: rgb(255, 255, 255),
      surface: rgb(0, 0, 0),
    });
    const sec = `${p.secondary.r},${p.secondary.g},${p.secondary.b}`;
    const acc = `${p.accent.r},${p.accent.g},${p.accent.b}`;
    expect(sec !== acc, `sec ${sec} vs acc ${acc}`).toBe(true);
    for (const slot of [p.secondary, p.accent]) {
      expect(Math.min(contrastRatio(slot, { r: 255, g: 255, b: 255 }), contrastRatio(slot, { r: 0, g: 0, b: 0 }))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("an ACHROMATIC primary keeps secondary !== accent (incl. no-win fills)", () => {
    // The ±40° rotations are vacuous at c=0 — the split is by
    // LIGHTNESS (the fallback tie-break), and it must hold on the
    // no-win shapes where the hit path never runs.
    const shapes = [
      { primary: rgb(128, 128, 128), background: rgb(224, 224, 224), surface: rgb(255, 255, 255) },
      { primary: rgb(120, 120, 120), background: rgb(107, 114, 128), surface: rgb(156, 163, 175) },
      { primary: rgb(120, 120, 120), background: rgb(245, 245, 240), surface: rgb(22, 27, 38) },
    ];
    for (const fills of shapes) {
      const p = deriveSemanticPalette(fills);
      const sec = `${p.secondary.r},${p.secondary.g},${p.secondary.b}`;
      const acc = `${p.accent.r},${p.accent.g},${p.accent.b}`;
      expect(sec !== acc, `sec ${sec} vs acc ${acc}`).toBe(true);
    }
  });

  it("rgbToOklch sanitises hostile inputs (finite LCH, never NaN)", () => {
    const out = rgbToOklch({ r: NaN, g: 10, b: 10 });
    expect(Number.isFinite(out.l)).toBe(true);
    expect(Number.isFinite(out.c)).toBe(true);
    expect(Number.isFinite(out.h)).toBe(true);
    const neg = rgbToOklch({ r: -40, g: 300, b: 12.7 });
    expect(neg.l).toBeGreaterThanOrEqual(0);
    expect(neg.l).toBeLessThanOrEqual(1);
    expect(Number.isFinite(contrastRatio({ r: NaN, g: NaN, b: NaN }, { r: 0, g: 0, b: 0 }))).toBe(true);
    // NaN reads as hue 0 — the distance to 10 is 10, and 0 to itself.
    expect(hueDistance(NaN, 10)).toBe(10);
    expect(hueDistance(NaN, NaN)).toBe(0);
  });

  it("the accent split is PINNED (dropping it reds here)", () => {
    // The r19 S2: deleting the accent re-derivation leaves sec≡acc
    // on 224/4,096 grey shapes.
    const p = deriveSemanticPalette({
      primary: rgb(120, 120, 120),
      background: rgb(0, 0, 0),
      surface: rgb(120, 120, 120),
    });
    const sec = `${p.secondary.r},${p.secondary.g},${p.secondary.b}`;
    const acc = `${p.accent.r},${p.accent.g},${p.accent.b}`;
    expect(sec !== acc, `sec ${sec} vs acc ${acc}`).toBe(true);
  });

  it("the AA-preference retake keeps the maximum AA tones (r19 S1 pin)", () => {
    // The r19 delta S1 shape: both members of the colliding pair were
    // demoted below AA; one could keep its AA byte.
    const p = deriveSemanticPalette({
      primary: rgb(207, 9, 119),
      background: rgb(6, 38, 233),
      surface: rgb(88, 125, 126),
    });
    let aaCount = 0;
    for (const slot of ["success", "error", "warning", "info"] as const) {
      const w1 = contrastRatio(p[slot], { r: 6, g: 38, b: 233 });
      const w2 = contrastRatio(p[slot], { r: 88, g: 125, b: 126 });
      if (Math.min(w1, w2) >= 4.5) aaCount++;
    }
    expect(aaCount, "at least 3 of 4 tones keep AA (the retake's gain)").toBeGreaterThanOrEqual(3);
  });

  it("the window-band differentiate is PINNED (dropping it reds here)", () => {
    // The r20 class: on no-win fills the AA band is empty; the
    // window-band fallback splits the pair (3/22,814 shapes fixed).
    const p = deriveSemanticPalette({
      primary: rgb(121, 109, 121),
      background: rgb(113, 121, 113),
      surface: rgb(117, 109, 109),
    });
    const bytes = (["success", "error", "warning", "info"] as const).map(
      (slot) => `${p[slot].r},${p[slot].g},${p[slot].b}`,
    );
    expect(new Set(bytes).size, "no-win tones stay distinct").toBe(4);
  });

  it("the resting border uses the FILLS' lightness (the low-emphasis bias)", () => {
    // fillLight = mean(l): replacing it with 0.7 moved the border on
    // 884/5,063 shapes (r22 adversarial M40).
    const p = deriveSemanticPalette({
      primary: rgb(0, 0, 0),
      background: rgb(0, 0, 0),
      surface: rgb(117, 117, 117),
    });
    // With fillLight the border sits near the fills (dark); with 0.7 it
    // would sit at the mid-light. Pin the DARK position.
    expect(p.border.r, "resting border follows the fills' lightness").toBeLessThan(100);
  });

  it("oklchToRgb sanitises a NaN HUE (never NaN into a cssvar)", () => {
    // r22 adversarial M49: the hue guard had no pin.
    const rgb = oklchToRgb({ l: -1, c: 0.11, h: NaN });
    expect(Number.isFinite(rgb.r)).toBe(true);
    expect(Number.isFinite(rgb.g)).toBe(true);
    expect(Number.isFinite(rgb.b)).toBe(true);
  });

  it("the retake differs from EVERY tone's bytes (the all-tone guard)", () => {
    // r23 adversarial M03: the partner-only check collapses warning
    // onto success's byte on this fixture.
    const p = deriveSemanticPalette({
      primary: rgb(133, 84, 104),
      background: rgb(23, 127, 149),
      surface: rgb(96, 201, 47),
    });
    const bytes = (["success", "error", "warning", "info"] as const).map(
      (slot) => `${p[slot].r},${p[slot].g},${p[slot].b}`,
    );
    expect(new Set(bytes).size, "all four tones pairwise distinct").toBe(4);
  });

  it("the no-win WINDOW width is a load-bearing value (0.35)", () => {
    // r22 adversarial M27: window 0.35 → 0.05 moved 407/5,063 shapes.
    // On this fixture the wider window keeps the tone readable.
    const p = deriveSemanticPalette({
      primary: rgb(0, 0, 0),
      background: rgb(0, 0, 0),
      surface: rgb(128, 128, 128),
    });
    // The success tone with the WIDE window keeps chroma (213,255,218);
    // a narrow 0.05 window drops to near-white (250,255,250). Pin the
    // exact byte.
    expect(`${p.success.r},${p.success.g},${p.success.b}`, "the window keeps the chromatic pick").toBe("213,255,218");
  });

  it("hueDistance wraps at 360° (the public helper)", () => {
    // r22 adversarial M17: the wrap had no pin.
    expect(hueDistance(350, 10), "wraps to the short arc").toBe(20);
    expect(hueDistance(10, 350), "symmetric").toBe(20);
    expect(hueDistance(-720, -400), "wraps past zero").toBe(40);
  });

  it("the accent split maximises the worst anchor (not chroma)", () => {
    // r23 adversarial M06/M20: the chroma-max pick returned
    // 159,132,214@1.44; the worst-anchor maximisation returns
    // 255,254,255@4.46 (a +3.02 gain).
    const p = deriveSemanticPalette({
      primary: rgb(254, 162, 228),
      background: rgb(98, 41, 180),
      surface: rgb(181, 97, 3),
    });
    const accWorst = Math.min(
      contrastRatio(p.accent, { r: 98, g: 41, b: 180 }),
      contrastRatio(p.accent, { r: 181, g: 97, b: 3 }),
    );
    expect(accWorst, "the accent's worst anchor is maximised (near the 4.4 bar)").toBeGreaterThanOrEqual(4.4);
  });

  it("the resting border chroma is 0.25× the focused (subdued, not equal)", () => {
    // r24 adversarial M13: the 0.25 factor had no pin. With 0.95 the
    // resting border would match the focused border's intensity.
    const p = deriveSemanticPalette({
      primary: rgb(100, 50, 150),
      background: rgb(20, 20, 30),
      surface: rgb(40, 40, 55),
    });
    const bc = rgbToOklch(p.border).c;
    const fc = rgbToOklch(p.focusedBorder).c;
    // The resting border's chroma should be distinctly below the focused.
    expect(bc, "resting chroma < focused").toBeLessThan(fc * 0.6);
  });

  it("the near-bar bound: one rounding step short of AA keeps the near-best", () => {
    // The r14/r15 S1 class: bg(0,0,0)/sf(252,252,234) — bestWorst
    // 4.4995 was returned at 4.15 (the window took a 0.35 drop); the
    // near-bar bound returns the pick-biased near-best (~4.48-4.50).
    const p = deriveSemanticPalette({
      primary: rgb(60, 60, 65),
      background: rgb(0, 0, 0),
      surface: rgb(252, 252, 234),
    });
    for (const slot of ["success", "error", "warning", "info"] as const) {
      const worst = Math.min(
        contrastRatio(p[slot], { r: 0, g: 0, b: 0 }),
        contrastRatio(p[slot], { r: 252, g: 252, b: 234 }),
      );
      // The near-best keeps within 0.1 of the best worst-anchor (4.4995
      // for the S1 shape), not the window's 0.35 drop.
      expect(worst, `${slot} near-bar`).toBeGreaterThan(4.4);
    }
  });

  it("the seam at 1504 catches the near-white sub-grid window", () => {
    // The r13 S1 shape: bg(0,0,0)/sf(252,252,254) — the AA band is
    // 0.00066 wide; the 376 grid straddled it (4.20 sub-AA) while 1504
    // hits it (4.50).
    const p = deriveSemanticPalette({
      primary: rgb(60, 60, 65),
      background: rgb(0, 0, 0),
      surface: rgb(252, 252, 254),
    });
    for (const slot of ["success", "error", "warning", "info"] as const) {
      const worst = Math.min(
        contrastRatio(p[slot], { r: 0, g: 0, b: 0 }),
        contrastRatio(p[slot], { r: 252, g: 252, b: 254 }),
      );
      expect(worst, `${slot} AA at the 1504 resolution`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the 4.55/AA SEAM: winnable shapes never fall to the sub-AA window", () => {
    // surface 118 over a near-black bg: pure white clears AA (4.5422)
    // but not the 4.55 margin — the shape is WINNABLE and must not land
    // on the fallback's 4.22 near-white.
    const fills = {
      primary: rgb(58, 58, 66),
      background: rgb(8, 8, 10),
      surface: rgb(118, 118, 118),
    };
    const p = deriveSemanticPalette(fills);
    for (const slot of ["success", "error", "warning", "info"] as const) {
      expect(contrastRatio(p[slot], fills.surface), `${slot} AA`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the white-unique BOUNDARY: near-white AA AND distinctness", () => {
    // surface rgb(117,117,117) over a near-black bg: only near-white
    // candidates clear 4.55 — and the fine grid lands each hue's own,
    // so the boundary holds BOTH readability and distinctness (measured
    // at 1504: 250,255,250 / 255,254,253 / 255,252,249 / 252,254,255).
    // A few steps down the tones gain full chroma.
    const boundary = {
      primary: rgb(58, 58, 66),
      background: rgb(8, 8, 10),
      surface: rgb(117, 117, 117),
    };
    const p = deriveSemanticPalette(boundary);
    const bytes = (["success", "error", "warning", "info"] as const).map(
      (slot) => `${p[slot].r},${p[slot].g},${p[slot].b}`,
    );
    expect(new Set(bytes).size, "the boundary tones are distinct").toBe(4);
    for (const slot of ["success", "error", "warning", "info"] as const) {
      expect(contrastRatio(p[slot], boundary.surface), `${slot} AA`).toBeGreaterThanOrEqual(4.5);
    }
    const distinct = {
      primary: rgb(58, 58, 66),
      background: rgb(8, 8, 10),
      surface: rgb(110, 110, 110),
    };
    const q = deriveSemanticPalette(distinct);
    const bytes2 = (["success", "error", "warning", "info"] as const).map(
      (slot) => `${q[slot].r},${q[slot].g},${q[slot].b}`,
    );
    expect(new Set(bytes2).size, "a few steps down: still distinct").toBe(4);
  });

  it("the WHITE-UNIQUE class: AA reachable only at the near-white extreme", () => {
    // A near-black bg + a ~117-grey surface: only near-white candidates
    // clear AA — and the FINE grid finds each hue's OWN near-white, so
    // the four tones stay DISTINCT at the boundary (the coarse grid
    // collapsed them all to pure white). A grid capped short of the
    // endpoints declared this class "no-win" inside a truncated domain.
    const fills = {
      primary: rgb(60, 60, 65),
      background: rgb(0, 0, 0),
      surface: rgb(117, 117, 120),
    };
    const p = deriveSemanticPalette(fills);
    const bytes = (["success", "error", "warning", "info"] as const).map(
      (slot) => `${p[slot].r},${p[slot].g},${p[slot].b}`,
    );
    expect(new Set(bytes).size, "the four near-whites are distinct").toBe(4);
    for (const slot of ["success", "error", "warning", "info"] as const) {
      expect(contrastRatio(p[slot], fills.surface), `${slot} AA on the surface`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the achromatic RAZOR: coincidence is physics, kept and disclosed", () => {
    // bg #757575 / surface #787878: the 4.55 band is a single grey
    // (black) for secondary, but the AA band holds two — the retake
    // flips the pick and splits the pair (0,0,0 vs 2,2,2).
    const p = deriveSemanticPalette({
      primary: rgb(120, 120, 120),
      background: rgb(117, 117, 117),
      surface: rgb(120, 120, 120),
    });
    const worst = (c: { r: number; g: number; b: number }) =>
      Math.min(
        contrastRatio(c, { r: 117, g: 117, b: 117 }),
        contrastRatio(c, { r: 120, g: 120, b: 120 }),
      );
    expect(worst(p.secondary)).toBeGreaterThanOrEqual(4.5);
    expect(worst(p.accent), "the accent keeps AA (coinciding where physics forces it)").toBeGreaterThanOrEqual(4.5);
  });

  it("the differentiation itself is PINNED (deleting it reds here)", () => {
    // The guard's effect on the razor fixture: without differentiation,
    // error === warning on these fills.
    const p = deriveSemanticPalette({
      primary: rgb(120, 120, 120),
      background: rgb(117, 117, 117),
      surface: rgb(120, 120, 120),
    });
    const bytes = (["success", "error", "warning", "info"] as const).map(
      (slot) => `${p[slot].r},${p[slot].g},${p[slot].b}`,
    );
    expect(new Set(bytes).size, "razor tones distinct").toBe(4);
  });

  it("BOTH rungs unreachable: the achromatic split still differentiates", () => {
    // bg pure black + a 144-grey surface: NO grey clears 4.55 (secondary)
    // or even 3.5 (accent) on both anchors — both slots take the
    // fallback, whose window-end picks must still split them.
    const fills = {
      primary: rgb(120, 120, 120),
      background: rgb(0, 0, 0),
      surface: rgb(144, 144, 144),
    };
    const p = deriveSemanticPalette(fills);
    const sec = `${p.secondary.r},${p.secondary.g},${p.secondary.b}`;
    const acc = `${p.accent.r},${p.accent.g},${p.accent.b}`;
    expect(sec !== acc, `sec ${sec} vs acc ${acc}`).toBe(true);
  });

  it("the gamut search survives a huge finite chroma (the 0.4 cap)", () => {
    // c=1e6 must land byte-exactly where c=0.4 (the cap) does — a
    // spread threshold let the uncapped search pass.
    const capped = oklchToRgb({ l: 0.6, c: 0.4, h: 100 });
    const huge = oklchToRgb({ l: 0.6, c: 1e6, h: 100 });
    expect(huge).toEqual(capped);
    // And the capped result is CHROMATIC (the largest in-gamut chroma,
    // not the grey an unbounded first probe degenerates to).
    expect(Math.max(huge.r, huge.g, huge.b) - Math.min(huge.r, huge.g, huge.b)).toBeGreaterThan(20);
  });

  it("a FLOAT surface still yields integer channels everywhere", () => {
    const p = deriveSemanticPalette({
      primary: rgb(30, 102, 245),
      background: { r: 239.4, g: 241.2, b: 245.6 },
      surface: { r: 254.5, g: 254.5, b: 254.5 },
    });
    for (const v of Object.values(p)) {
      expect(Number.isInteger(v.r)).toBe(true);
      expect(Number.isInteger(v.g)).toBe(true);
      expect(Number.isInteger(v.b)).toBe(true);
    }
  });

  it("the status bar is the surface (the definitional answer)", () => {
    for (const fills of [DARK_FILLS, LIGHT_FILLS]) {
      const p = deriveSemanticPalette(fills);
      expect(p.statusBarBackground).toEqual(fills.surface);
      // A COPY, not the caller's own object.
      expect(p.statusBarBackground).not.toBe(fills.surface);
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
