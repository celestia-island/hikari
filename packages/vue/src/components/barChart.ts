// Pure bar-chart layout for HkBarChart (the HkTreemap/HkCalendarHeatmap
// "pure logic module + thin component" pattern): buckets' values →
// per-slot SVG geometry.
//
// Upstreamed from wowsp's playtime trend chart (PlaytimeTrendChart +
// playtimeAgg.trendBars, the app's hand-drawn-SVG chart convention) so
// the two apps draw the identical bar shape: equal slots, each bar
// centered with 62%-of-slot width capped at 36px, top-only corner
// rounding clamped so a squat bar never inverts its corners, and three
// gridline guides (0 / half / the nice max). Each slot also carries the
// baseline for an optional value label above the bar (top − 5, null for
// an empty slot) — the wowsp tier histogram's labelY convention, which
// HkBarChart renders behind its showValues prop.
//
// AI-generated (GLM-5.3 via ZCode), 2026-10-31 — SySL-1.0 §2.3.

/** One bar's slot geometry. */
export interface BarSlot {
  centerX: number;
  barWidth: number;
  /** Empty string for a zero bucket — no invisible sliver to hover. */
  path: string;
  value: number;
  /** Text baseline for a value label ABOVE the bar (top − 5, wowsp's
   * tierBars convention — the 10-unit label clears the bar with a
   * readable gap); null for a zero bucket, so an empty slot carries no
   * above-bar label either (HkBarChart's showValues renders labelY
   * non-null slots only). */
  labelY: number | null;
}

/** The full layout HkBarChart renders. */
export interface BarLayout {
  width: number;
  height: number;
  baselineY: number;
  sidePad: number;
  /** Three horizontal guides: 0, half and the nice max. */
  gridlines: { y: number; value: number }[];
  bars: BarSlot[];
}

/** The default frame — wowsp's playtime trend constants, kept so the
 * upstreamed component renders pixel-identical where it was born. */
export const BAR_FRAME = {
  width: 640,
  height: 220,
  sidePad: 44,
  topPad: 14,
  bottomPad: 24,
} as const;

/** Trim float noise so path strings stay short and deterministic. */
export function fmtBar(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Round the window max up to a human tick so the axis reads "4", not
 * "3.7". Generalized from wowsp's hour ladder to plain magnitudes: the
 * 1-2-5 decades over three decades of exponent, then up to the next
 * integer step. Zero / negative input falls back to 1 (an empty chart
 * still draws a sane axis). */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = Math.pow(10, exp);
  for (const m of [1, 2, 5, 10]) {
    if (max <= m * base) return m * base;
  }
  return 10 * base;
}

/** Values → per-slot geometry. Pure: same values + same opts → the same
 * layout, fully unit-testable. */
export function barLayout(
  values: readonly number[],
  opts: { width?: number; height?: number } = {},
): BarLayout {
  const width = opts.width ?? BAR_FRAME.width;
  const height = opts.height ?? BAR_FRAME.height;
  const sidePad = BAR_FRAME.sidePad;
  const topPad = BAR_FRAME.topPad;
  const baselineY = height - BAR_FRAME.bottomPad;
  const plotH = baselineY - topPad;
  const scale = niceMax(values.reduce((a, v) => Math.max(a, v), 0));
  const slotW = (width - 2 * sidePad) / Math.max(1, values.length);
  const barW = Math.min(slotW * 0.62, 36);
  const bars: BarSlot[] = values.map((value, i) => {
    const centerX = sidePad + slotW * (i + 0.5);
    if (!(value > 0)) {
      return { centerX, barWidth: barW, path: "", value, labelY: null };
    }
    const h = (value / scale) * plotH;
    const top = baselineY - h;
    const x0 = centerX - barW / 2;
    const x1 = centerX + barW / 2;
    // Top-only rounding, clamped so a squat bar never inverts its corners.
    const rx = Math.min(3, barW / 2, h / 2);
    const path =
      `M ${fmtBar(x0)} ${fmtBar(baselineY)} ` +
      `L ${fmtBar(x0)} ${fmtBar(top + rx)} ` +
      `Q ${fmtBar(x0)} ${fmtBar(top)} ${fmtBar(x0 + rx)} ${fmtBar(top)} ` +
      `L ${fmtBar(x1 - rx)} ${fmtBar(top)} ` +
      `Q ${fmtBar(x1)} ${fmtBar(top)} ${fmtBar(x1)} ${fmtBar(top + rx)} ` +
      `L ${fmtBar(x1)} ${fmtBar(baselineY)} Z`;
    return { centerX, barWidth: barW, path, value, labelY: fmtBar(top - 5) };
  });
  const gridlines = [0, 0.5, 1].map((f) => ({
    y: fmtBar(baselineY - f * plotH),
    value: fmtBar(scale * f),
  }));
  return { width, height, baselineY, sidePad, gridlines, bars };
}
