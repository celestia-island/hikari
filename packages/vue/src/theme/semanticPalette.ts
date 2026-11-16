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
 * the pinned 20° of both per slot), so a derived palette lands where
 * the designed ones live.
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
  // Linear prescan (the in-gamut set along c is NON-CONVEX — channels
  // are cubic in c, so a bare binary search stops at the first
  // boundary): find the highest in-gamut SAMPLE, then refine between it
  // and the next sample above.
  const CAP = Math.min(c, 0.4);
  const SAMPLES = 48;
  let lo = 0;
  let hi = CAP;
  for (let i = SAMPLES; i >= 1; i--) {
    const probe = (CAP * i) / SAMPLES;
    const lin = oklchToLinear(l, probe, h);
    if (lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4)) {
      lo = probe;
      hi = i === SAMPLES ? CAP : (CAP * (i + 1)) / SAMPLES;
      break;
    }
  }
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

export function contrastRatio(a: ThemeTokenRGB, b: ThemeTokenRGB): number {
  const la = srgbLuminance(sanitizeRgb(a));
  const lb = srgbLuminance(sanitizeRgb(b));
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Shortest distance between two hues on the 360° wheel, in degrees.
 *  Non-finite inputs read as 0 (never NaN out of a public primitive). */
export function hueDistance(h1: number, h2: number): number {
  const a = Number.isFinite(h1) ? h1 : 0;
  const b = Number.isFinite(h2) ? h2 : 0;
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** Channel sanitisation shared by the public colour maths. */
function sanitizeRgb({ r, g, b }: ThemeTokenRGB): ThemeTokenRGB {
  const clamp = (v: number) =>
    Math.min(255, Math.max(0, Math.round(Number.isFinite(v) ? v : 128)));
  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

// ── The canonical semantic family ───────────────────────────────────────
//
// Between the two shipped stock families: the Nord-toned dark family
// (success 163,190,140 / error 191,97,106 / warning 208,135,112 / info
// 136,192,208) and the tailwind-toned light family (16,185,129 /
// 239,68,68 / 245,158,11 / 6,182,212) differ by up to ~32° per slot in
// OKLCH hue; the constants below sit within the pinned 20° of BOTH
// per slot and keep the four tones ≥38° apart (8-bit quantization
// shifts a rendered hue by well under a degree on the shipped
// fixtures; the headroom covers the darkest lightness band). The test
// suite pins them to both families.
export const CANONICAL_SEMANTIC = Object.freeze({
  success: { h: 148, c: 0.11 },
  error: { h: 20, c: 0.16 },
  warning: { h: 58, c: 0.13 },
  info: { h: 215, c: 0.09 },
} as const);

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
 * lightness clears the target even at the fine resolution, fall back
 * to the chroma-richest near-optimal candidate — the most hue signal
 * at almost the best readability.
 */
function readableHue(
  h: number,
  c: number,
  fills: ThemeTokenRGB[],
  target: number,
  preferLight = 0.7,
  /** An upper bound on the worst-anchor ratio (the rung CEILING): used
   *  by the resting border's HIT path so it never lands on — or above —
   *  the focused border's rung. */
  ceiling = Number.POSITIVE_INFINITY,
  /** WHERE in the clearing band: "closest" honours preferLight; "high"/
   *  "low" take the band's top/bottom — the achromatic split. */
  pick: "closest" | "high" | "low" = "closest",
  /** The no-win window width (best worst-anchor minus this). */
  window = 0.35,
): ThemeTokenRGB {
  // ONE fine grid over the full [0,1] range INCLUDING the achromatic
  // endpoints (a whole class of fills has pure white/black as its only
  // candidate): Δl ≈ 0.0027 catches every AA window 8-bit colour space
  // can express at this chroma, where the historical 94-step grid
  // declared "no-win" inside a truncated domain.
  const FINE = 376;
  const cands: { rgb: ThemeTokenRGB; worst: number; chroma: number; l: number }[] = [];
  for (let i = 0; i <= FINE; i++) {
    const l = i / FINE;
    const rgb = oklchToRgb({ l, c, h });
    const worst = Math.min(...fills.map((f) => contrastRatio(rgb, f)));
    cands.push({ rgb, worst, chroma: rgbToOklch(rgb).c, l });
  }
  const pickBias = (l: number): number =>
    pick === "high" ? -l : pick === "low" ? l : Math.abs(l - preferLight);

  // (a) HIT: clears the target within the ceiling — closest to the pick
  // bias.
  let hit: { rgb: ThemeTokenRGB; bias: number } | null = null;
  for (const cand of cands) {
    if (cand.worst >= target && cand.worst <= ceiling) {
      const bias = pickBias(cand.l);
      if (hit === null || bias < hit.bias) hit = { rgb: cand.rgb, bias };
    }
  }
  if (hit !== null) return hit.rgb;

  // (b) The AA SEAM: nothing clears the target margin, but something may
  // still clear AA itself (white at 4.54 vs the 4.55 margin) — the shape
  // is WINNABLE and must not fall to the sub-AA window. Pick by the most
  // surviving chroma (the hue signal), tie-broken by the pick bias.
  if (target >= 4.5) {
    let aaHit: { rgb: ThemeTokenRGB; key: number; bias: number } | null = null;
    for (const cand of cands) {
      if (cand.worst >= 4.5) {
        const key = -cand.chroma;
        const tie = aaHit !== null && key < aaHit.key + 0.005;
        const bias = pickBias(cand.l);
        if (aaHit === null || key < aaHit.key || (tie && bias < aaHit.bias)) {
          aaHit = { rgb: cand.rgb, key, bias };
        }
      }
    }
    if (aaHit !== null) return aaHit.rgb;
    // Some AA windows are narrower than ANY fixed grid (measured 4.25 on
    // a 4.50 shape at this very resolution): a local ternary refinement
    // around the best-worst candidates, re-checked against AA.
    const byWorst = [...cands].sort((a, b) => b.worst - a.worst).slice(0, 3);
    for (const center of byWorst) {
      let lo = Math.max(0, center.l - 0.012);
      let hiL = Math.min(1, center.l + 0.012);
      for (let k = 0; k < 12; k++) {
        const m1 = lo + (hiL - lo) / 3;
        const m2 = hiL - (hiL - lo) / 3;
        const w1 = Math.min(
          ...fills.map((f) => contrastRatio(oklchToRgb({ l: m1, c, h }), f)),
        );
        const w2 = Math.min(
          ...fills.map((f) => contrastRatio(oklchToRgb({ l: m2, c, h }), f)),
        );
        if (w1 >= w2) hiL = m2;
        else lo = m1;
      }
      const lMid = (lo + hiL) / 2;
      const rgb = oklchToRgb({ l: lMid, c, h });
      const worst = Math.min(...fills.map((f) => contrastRatio(rgb, f)));
      if (worst >= 4.5) return rgb;
    }
  }

  // (c) NO-WIN: nothing clears AA at this hue/chroma. Among the
  // near-optimal candidates (within `window` of the best worst-anchor)
  // take the most SURVIVING chroma — the hue signal — tie-broken by the
  // pick bias (which differentiates the achromatic split's window ends).
  const bestWorst = Math.max(...cands.map((cand) => cand.worst));
  let miss: { rgb: ThemeTokenRGB; chroma: number; bias: number } | null = null;
  for (const cand of cands) {
    if (cand.worst >= bestWorst - window) {
      const tie = miss !== null && cand.chroma > miss.chroma - 0.005;
      const bias = pickBias(cand.l);
      if (miss === null || cand.chroma > miss.chroma + 0.005 || (tie && bias < miss.bias)) {
        miss = { rgb: cand.rgb, chroma: cand.chroma, bias };
      }
    }
  }
  return (miss ?? { rgb: oklchToRgb({ l: 0.5, c, h }), chroma: 0, bias: 0 }).rgb;
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
  const secondarySlot = readableHue(
    (primary.h + 40) % 360,
    brandChroma,
    both,
    4.55,
    achromatic ? 0.82 : 0.7,
    Number.POSITIVE_INFINITY,
    achromatic ? "high" : "closest",
  );
  const result: SemanticPalette = {
    secondary: secondarySlot,
    // A LOWER rung for the achromatic accent — TWO-PASS: 4.55 first
    // (an achromatic primary must not cost an AA-reachable accent its
    // readability), the 3.5 rung only when 4.55 is unreachable (at
    // no-win the bias rounds both slots to the same grey — a different
    // rung is the only guaranteed differentiator).
    accent: (() => {
      const hue = (primary.h + 320) % 360;
      const pickBase = achromatic ? "low" : "closest";
      const high = readableHue(
        hue,
        brandChroma,
        both,
        4.55,
        achromatic ? 0.52 : 0.7,
        Number.POSITIVE_INFINITY,
        pickBase,
        0.35,
      );
      const highWorst = Math.min(...both.map((f) => contrastRatio(high, f)));
      const sameAsSecondary =
        high.r === secondarySlot.r && high.g === secondarySlot.g && high.b === secondarySlot.b;
      // Distinct and (for the achromatic split, whose rungs sit lower)
      // AA-clearing: take it.
      if (!sameAsSecondary && (!achromatic || highWorst >= 4.5)) return high;
      // Coincidence, or an achromatic sub-AA first pass: retake in the
      // AA band with the OPPOSITE pick — a DISTINCT AA candidate beats a
      // coinciding one (the grey-on-white/black class has 117@4.5578
      // and 118@4.5422; both readable, only the pair distinguishes the
      // slots). If no distinct AA candidate exists, the coincidence is
      // physics (the razor class) and stands, disclosed.
      const flip = pickBase === "low" ? "high" : "low";
      const alt = readableHue(hue, brandChroma, both, 4.5, 0.52, Number.POSITIVE_INFINITY, flip, 0.35);
      const altWorst = Math.min(...both.map((f) => contrastRatio(alt, f)));
      const altDiffers =
        alt.r !== secondarySlot.r || alt.g !== secondarySlot.g || alt.b !== secondarySlot.b;
      if (altWorst >= 4.5 && altDiffers) return alt;
      return high;
    })(),
    border: readableHue(primary.h, primary.c * 0.25, both, 1.5, fillLight, focusedWorst - 0.1),
    focusedBorder: focused,
    // 4.55, not 4.5: a hair of margin so a 1-LSB rounding change never
    // drops a derived tone under the AA bar the contract pins.
    success: readableHue(CANONICAL_SEMANTIC.success.h, CANONICAL_SEMANTIC.success.c, both, 4.55),
    error: readableHue(CANONICAL_SEMANTIC.error.h, CANONICAL_SEMANTIC.error.c, both, 4.55),
    warning: readableHue(CANONICAL_SEMANTIC.warning.h, CANONICAL_SEMANTIC.warning.c, both, 4.55),
    info: readableHue(CANONICAL_SEMANTIC.info.h, CANONICAL_SEMANTIC.info.c, both, 4.55),
    // A COPY (rounded, like every derived slot: float callers would
    // otherwise get mixed precision): mutating the derived palette must
    // not write through to the input theme.
    statusBarBackground: sanitizeRgb(fills.surface),
  };
  return result;
}
