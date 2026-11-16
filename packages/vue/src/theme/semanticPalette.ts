import type { ThemeTokenRGB, ThemeSchemeTokens } from "./presets";

/**
 * Semantic palette derivation — hue-preserving, readability-adjusted.
 *
 * A theme that declares only the three anchors (primary / background /
 * surface) leaves its eight semantic ink slots to the CONSUMER's
 * fallback — chest's applier inherits the brand primary into all of
 * them: success === error === warning === info === primary. When the
 * primary lacks contrast against its own background the semantic copy
 * paints at ~1.07:1, and even when it reads, the four states are
 * indistinguishable — the semantic meaning is destroyed by the
 * fallback, not by any derivation.
 *
 * These hues cannot be luminance-derived (a grey "success" is not a
 * success), so the derivation works in OKLCH: keep the HUE, search the
 * LIGHTNESS for the value that reads on BOTH fills (background AND
 * surface — the worst anchor decides), keep a canonical CHROMA. The
 * canonical hues sit between the two shipped stock families (the
 * Nord-toned dark table and the tailwind-toned light table — within
 * 17° of both per slot), so a derived palette lands where the designed
 * ones live.
 *
 * Pure function of the fills: no mode, no globals, no mutation.
 */

// ── OKLab / OKLCH (Björn Ottosson's reference matrices) ─────────────────

function channelToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function linearToChannel(v: number): number {
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
}

const LINEAR_FROM_SRGB = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];

const LAB_FROM_LMS = [
  [0.2104542553, 0.7936177850, -0.0040720468],
  [1.9779984951, -2.4285922050, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.8086757660],
];

function oklchToLinear(
  l: number,
  c: number,
  h: number,
): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  // Lab → LMS′ (cube roots) → linear LMS.
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

export function oklchToRgb(input: OKLCH): ThemeTokenRGB {
  // A public primitive: sanitize rather than emit NaN into a cssvar.
  // Non-finite members degrade to a neutral grey; c clamps to ≥0 (a
  // negative chroma would mirror the hue); l clamps to [0,1]; h wraps.
  const l = Math.min(1, Math.max(0, Number.isFinite(input.l) ? input.l : 0));
  const c = Math.max(0, Number.isFinite(input.c) ? input.c : 0);
  const rawH = Number.isFinite(input.h) ? input.h : 0;
  const h = ((rawH % 360) + 360) % 360;
  // Gamut mapping by CHROMA REDUCTION at constant L and H: a per-channel
  // clamp drags the hue (a warning clamped toward its error neighbour is
  // exactly how two semantic tones collapse), while reducing chroma
  // keeps the hue exact — the module's whole point. Binary search for
  // the largest in-gamut chroma.
  let lo = 0;
  let hi = c;
  let best: [number, number, number] | null = null;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const lin = oklchToLinear(l, mid, h);
    const inGamut = lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
    if (inGamut) {
      best = lin;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  // c=0 is always in gamut (a grey at lightness l); the fallback covers
  // extreme l values even the grey cannot reach.
  const lin = best ?? oklchToLinear(l, 0, h);
  return {
    r: linearToChannel(lin[0]),
    g: linearToChannel(lin[1]),
    b: linearToChannel(lin[2]),
  };
}

/** OKLCH: L ∈ [0,1], C ≥ 0, H in degrees [0,360). */
export interface OKLCH {
  l: number;
  c: number;
  h: number;
}

export function rgbToOklch(input: ThemeTokenRGB): OKLCH {
  // A public primitive, like its counterpart: NaN members degrade to a
  // neutral grey rather than poisoning every downstream slot.
  const clamp = (v: number) =>
    Math.min(255, Math.max(0, Math.round(Number.isFinite(v) ? v : 128)));
  const { r, g, b } = { r: clamp(input.r), g: clamp(input.g), b: clamp(input.b) };
  const lin = LINEAR_FROM_SRGB.map(
    (row) =>
      row[0] * channelToLinear(r) +
      row[1] * channelToLinear(g) +
      row[2] * channelToLinear(b),
  );
  const lms = lin.map((v) => Math.cbrt(v));
  const lab = LAB_FROM_LMS.map(
    (row) => row[0] * lms[0] + row[1] * lms[1] + row[2] * lms[2],
  );
  const c = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
  let h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: lab[0], c, h };
}


// ── WCAG contrast — deliberately NOT the package's other ink metric ────
// contrastColor/solidInk use the raw weighted average (gamma-encoded
// luminance/255); this module uses WCAG RELATIVE luminance. The
// divergence is load-bearing: readability targets here are WCAG ratios,
// while the solidInk seam keeps its own perception-first metric.

function srgbLuminance({ r, g, b }: ThemeTokenRGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(
  a: ThemeTokenRGB,
  b: ThemeTokenRGB,
): number {
  const la = srgbLuminance(a);
  const lb = srgbLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Shortest distance between two hues on the 360° wheel, in degrees. */
export function hueDistance(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return Math.min(d, 360 - d);
}

// ── The canonical semantic family ───────────────────────────────────────
//
// Between the two shipped stock families: the Nord-toned dark family
// (success 163,190,140 / error 191,97,106 / warning 208,135,112 / info
// 136,192,208) and the tailwind-toned light family (16,185,129 /
// 239,68,68 / 245,158,11 / 6,182,212) differ by up to ~32° per slot in
// OKLCH hue; the constants below sit within the pinned 20° of BOTH
// per slot and keep the four tones ≥38° apart (8-bit quantization eats
// up to ~4° on the dark lightness band, so the raw separation needs
// the headroom). The test suite pins them to both families.
export const CANONICAL_SEMANTIC = {
  success: { h: 148, c: 0.11 },
  error: { h: 20, c: 0.16 },
  warning: { h: 58, c: 0.13 },
  info: { h: 215, c: 0.09 },
} as const;

export type SemanticPalette = Pick<
  ThemeSchemeTokens,
  | "secondary"
  | "accent"
  | "border"
  | "focusedBorder"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "statusBarBackground"
>;

export interface SemanticFills {
  primary: ThemeTokenRGB;
  background: ThemeTokenRGB;
  surface: ThemeTokenRGB;
}

/**
 * The lightness search: among the lightness values whose colour CLEARS
 * the contrast target on every fill, take the one closest to
 * `preferLight` (a mid-light sweet spot — on dark fills the readable
 * band is all pastels, on light fills all mid-tones, so the bias keeps
 * the derived colour where designed semantic colours live). When no
 * lightness clears the target (opposite-polarity fills), fall back to
 * the max-min optimum — the best any colour of this hue can do on
 * both anchors.
 */
function readableHue(
  h: number,
  c: number,
  fills: ThemeTokenRGB[],
  target: number,
  preferLight = 0.7,
  /** An upper bound on the worst-anchor ratio (the rung CEILING): used
   *  by the resting border so it can never land on — or above — the
   *  focused border's rung (on the fallback path a lower-chroma colour
   *  can win the worst-anchor contest and invert the two). */
  ceiling = Number.POSITIVE_INFINITY,
): ThemeTokenRGB {
  // `preferLight` picks WHERE in the clearing band the result lands:
  // mid-light for text tones and the focused border (high emphasis), the
  // fills' own lightness for the resting border (low emphasis — it must
  // sit just above the fill, not on the focused border's rung).
  const STEPS = 94;
  let hit: { rgb: ThemeTokenRGB; bias: number } | null = null;
  let bestWorst = 0;
  let miss: { rgb: ThemeTokenRGB; worst: number; chroma: number } | null = null;
  for (let i = 0; i <= STEPS; i++) {
    const l = 0.04 + (0.97 - 0.04) * (i / STEPS);
    const rgb = oklchToRgb({ l, c, h });
    const worst = Math.min(...fills.map((f) => contrastRatio(rgb, f)));
    if (worst >= target && worst <= ceiling) {
      const bias = Math.abs(l - preferLight);
      if (hit === null || bias < hit.bias) hit = { rgb, bias };
    } else {
      if (worst > bestWorst) bestWorst = worst;
    }
  }
  if (hit !== null) return hit.rgb;
  // NO lightness clears the target (a NO-WIN band). The raw max-min
  // optimum sits at the achromatic extremes where the gamut search
  // starves the chroma and the four tones collapse to byte-identical
  // near-blacks — violating the hue-preservation this module exists
  // for, and buying contrast that still misses the bar. Among the
  // NEAR-optimal candidates (within 0.35 of the best worst-anchor) take
  // the one whose SURVIVING chroma (round-tripped) is highest: the most
  // hue signal at (almost) the best readability.
  for (let i = 0; i <= STEPS; i++) {
    const l = 0.04 + (0.97 - 0.04) * (i / STEPS);
    const rgb = oklchToRgb({ l, c, h });
    const worst = Math.min(...fills.map((f) => contrastRatio(rgb, f)));
    if (worst >= bestWorst - 0.35) {
      const chroma = rgbToOklch(rgb).c;
      if (miss === null || chroma > miss.chroma) miss = { rgb, worst, chroma };
    }
  }
  return (miss ?? { rgb: oklchToRgb({ l: 0.04, c, h }), worst: 0, chroma: 0 }).rgb;
}

/**
 * Derive the semantic slots for a theme that omits them. Secondary and
 * accent are the primary's own hue rotated either side (the stock
 * tables do the same — cyan → teal/blue, pink → purple/amber), borders
 * follow the primary's hue at reduced chroma, the four semantic tones
 * use the canonical family, and the status bar is the surface (the dark
 * table paints it exactly so; the light table a near-surface tint —
 * surface is the neutral default).
 */
export function deriveSemanticPalette(fills: SemanticFills): SemanticPalette {
  const primary = rgbToOklch(fills.primary);
  const both = [fills.background, fills.surface];
  const brandChroma = Math.min(primary.c, 0.12);
  // An ACHROMATIC primary (c≈0) makes the ±40° rotations vacuous — both
  // slots would collapse to the same grey. Split them by LIGHTNESS.
  const achromatic = primary.c < 0.01;
  // The resting border prefers the FILLS' lightness (low emphasis); the
  // focused border the mid-light sweet spot (high emphasis) — sharing
  // one bias collapsed them onto the same rung and erased the focus
  // affordance (journeys S1).
  const fillLight = both.reduce((acc, f) => acc + rgbToOklch(f).l, 0) / both.length;
  // The FOCUSED border first; the resting border is then capped under its
  // worst-anchor rung, so the two can never invert (journeys S2).
  const focused = readableHue(primary.h, primary.c * 0.9, both, 3);
  const focusedWorst = Math.min(
    ...both.map((f) => contrastRatio(focused, f)),
  );
  return {
    secondary: readableHue(
      (primary.h + 40) % 360,
      brandChroma,
      both,
      4.55,
      achromatic ? 0.82 : 0.7,
    ),
    accent: readableHue(
      (primary.h + 320) % 360,
      brandChroma,
      both,
      4.55,
      achromatic ? 0.52 : 0.7,
    ),
    border: readableHue(primary.h, primary.c * 0.25, both, 1.5, fillLight, focusedWorst - 0.1),
    focusedBorder: focused,
    // 4.55, not 4.5: a hair of margin so a 1-LSB rounding change never
    // drops a derived tone under the AA bar the contract pins.
    success: readableHue(CANONICAL_SEMANTIC.success.h, CANONICAL_SEMANTIC.success.c, both, 4.55),
    error: readableHue(CANONICAL_SEMANTIC.error.h, CANONICAL_SEMANTIC.error.c, both, 4.55),
    warning: readableHue(CANONICAL_SEMANTIC.warning.h, CANONICAL_SEMANTIC.warning.c, both, 4.55),
    info: readableHue(CANONICAL_SEMANTIC.info.h, CANONICAL_SEMANTIC.info.c, both, 4.55),
    // A COPY, not the reference: mutating the derived palette must not
    // write through to the input theme.
    statusBarBackground: { ...fills.surface },
  };
}
