import type { ThemeTokenRGB, ThemeSchemeTokens } from "./presets";

/**
 * Semantic palette derivation — hue-preserving, readability-adjusted.
 *
 * A theme that declares only the three anchors (primary / background /
 * surface) has, until now, inherited `text ?? primary` into its eight
 * semantic ink slots: success === error === warning === info === the
 * brand primary. When the primary lacks contrast against its own
 * background the semantic copy paints at ~1.07:1, and even when it
 * reads, the four states are indistinguishable — the semantic meaning
 * is destroyed by the fallback, not by any derivation.
 *
 * These hues cannot be luminance-derived (a grey "success" is not a
 * success), so the derivation works in OKLCH: keep the HUE, search the
 * LIGHTNESS for the value that reads on BOTH fills (background AND
 * surface — the same worst-anchor rule the body ink uses), keep a
 * canonical CHROMA. The canonical hues are the intersection of the two
 * shipped stock families (the Nord-toned dark table and the
 * tailwind-toned light table), so a derived palette lands where the
 * designed ones live.
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

export function oklchToRgb({ l, c, h }: OKLCH): ThemeTokenRGB {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  // Lab → LMS′ (cube roots) → linear LMS → sRGB.
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  return {
    r: linearToChannel(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    g: linearToChannel(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    b: linearToChannel(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
  };
}

/** OKLCH: L ∈ [0,1], C ≥ 0, H in degrees [0,360). */
export interface OKLCH {
  l: number;
  c: number;
  h: number;
}

export function rgbToOklch({ r, g, b }: ThemeTokenRGB): OKLCH {
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


// ── WCAG contrast (the same formula every other ink decision uses) ──────

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
// The intersection of the two shipped stock tables: the Nord-toned dark
// family (success 163,190,140 / error 191,97,106 / warning 208,135,112 /
// info 136,192,208) and the tailwind-toned light family (16,185,129 /
// 239,68,68 / 245,158,11 / 6,182,212) agree, in OKLCH hue, to within a
// few degrees per slot. The constants below are that agreement; the
// test suite pins them to both families.
export const CANONICAL_SEMANTIC = {
  success: { h: 150, c: 0.11 },
  error: { h: 25, c: 0.16 },
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
 * the max-min optimum — the same philosophy as the body ink's midpoint:
 * the best any colour of this hue can do on both anchors.
 */
function readableHue(
  h: number,
  c: number,
  fills: ThemeTokenRGB[],
  target: number,
  preferLight = 0.62,
): ThemeTokenRGB {
  const STEPS = 94;
  let hit: { rgb: ThemeTokenRGB; bias: number } | null = null;
  let miss: { rgb: ThemeTokenRGB; worst: number } | null = null;
  for (let i = 0; i <= STEPS; i++) {
    const l = 0.04 + (0.97 - 0.04) * (i / STEPS);
    const rgb = oklchToRgb({ l, c, h });
    const worst = Math.min(...fills.map((f) => contrastRatio(rgb, f)));
    if (worst >= target) {
      const bias = Math.abs(l - preferLight);
      if (hit === null || bias < hit.bias) hit = { rgb, bias };
    } else if (miss === null || worst > miss.worst) {
      miss = { rgb, worst };
    }
  }
  return (hit ?? miss)!.rgb;
}

/**
 * Derive the semantic slots for a theme that omits them. Secondary and
 * accent are the primary's own hue rotated either side (the stock
 * tables do the same — cyan → teal/blue, pink → purple/amber), borders
 * follow the primary's hue at reduced chroma, the four semantic tones
 * use the canonical family, and the status bar is the surface (the
 * fill every designed table paints it with).
 */
export function deriveSemanticPalette(fills: SemanticFills): SemanticPalette {
  const primary = rgbToOklch(fills.primary);
  const both = [fills.background, fills.surface];
  const brandChroma = Math.min(primary.c, 0.12);
  return {
    secondary: readableHue((primary.h + 40) % 360, brandChroma, both, 4.5),
    accent: readableHue((primary.h + 320) % 360, brandChroma, both, 4.5),
    border: readableHue(primary.h, primary.c * 0.25, both, 1.5),
    focusedBorder: readableHue(primary.h, primary.c * 0.9, both, 3),
    success: readableHue(CANONICAL_SEMANTIC.success.h, CANONICAL_SEMANTIC.success.c, both, 4.5),
    error: readableHue(CANONICAL_SEMANTIC.error.h, CANONICAL_SEMANTIC.error.c, both, 4.5),
    warning: readableHue(CANONICAL_SEMANTIC.warning.h, CANONICAL_SEMANTIC.warning.c, both, 4.5),
    info: readableHue(CANONICAL_SEMANTIC.info.h, CANONICAL_SEMANTIC.info.c, both, 4.5),
    statusBarBackground: fills.surface,
  };
}
