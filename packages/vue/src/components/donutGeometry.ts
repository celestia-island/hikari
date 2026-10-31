// Pure donut-ring geometry + legend chunking for HkDonutChart.
//
// Upstreamed from wowsp's donutGeometry.ts (shared by its stats and
// playtime donut families): path segments on a square viewBox, radius
// ["40%","68%"] of half the box, 12-o'clock start, clockwise, a 100%
// slice split into two 180° halves (a single 360° arc degenerates), and
// the legend chunked into fixed-height columns.
//
// Dependency-free (no Vue, no i18n): everything here is pure and
// unit-testable.
//
// AI-generated (GLM-5.3 via ZCode), 2026-10-31 — SySL-1.0 §2.3.

/** Point on a circle at `deg`. Angles are degrees in the screen
 *  coordinate system: -90 = 12 o'clock, increasing clockwise. */
function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Trim float noise so path strings stay short and deterministic. */
export function fmtDonut(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Closed ring segment (donut slice) from `startDeg` to `endDeg`: outer
 *  arc clockwise, radial edge, inner arc counter-clockwise back, close. */
function ringSegment(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const o1 = polar(cx, cy, outerR, startDeg);
  const o2 = polar(cx, cy, outerR, endDeg);
  const i2 = polar(cx, cy, innerR, endDeg);
  const i1 = polar(cx, cy, innerR, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return (
    `M ${fmtDonut(o1.x)} ${fmtDonut(o1.y)} ` +
    `A ${fmtDonut(outerR)} ${fmtDonut(outerR)} 0 ${large} 1 ${fmtDonut(o2.x)} ${fmtDonut(o2.y)} ` +
    `L ${fmtDonut(i2.x)} ${fmtDonut(i2.y)} ` +
    `A ${fmtDonut(innerR)} ${fmtDonut(innerR)} 0 ${large} 0 ${fmtDonut(i1.x)} ${fmtDonut(i1.y)} Z`
  );
}

/** A 100% slice as TWO 180° ring halves — see the header. */
function fullRing(cx: number, cy: number, outerR: number, innerR: number): string {
  return `${ringSegment(cx, cy, outerR, innerR, 0, 180)} ${ringSegment(cx, cy, outerR, innerR, 180, 360)}`;
}

/** One donut entry as the component receives it. */
export interface HkDonutEntry {
  /** Stable key (hover focus + select payload). */
  key: string;
  /** Localized display label. */
  label: string;
  value: number;
  /** Optional explicit fill; absent entries ride the default ladder. */
  color?: string;
}

/** One computed donut slice: ready-to-render path, fill and shares. */
export interface HkDonutSlice {
  key: string;
  label: string;
  value: number;
  /** Share of the shown sum at 2-decimal display precision. */
  percent: number;
  /** Math.round of the RAW share: the single integer both the slice
   *  hint and the DOM legend render (re-rounding `percent` could
   *  disagree with the legend). */
  percentInt: number;
  path: string;
  fill: string;
}

/** Entries → donut slices starting at 12 o'clock (-90°), laid out
 *  clockwise in input order (pass count-desc for the wowsp look).
 *  Non-positive entries are dropped; an empty (or all-zero) input
 *  yields []. Pure: same entries + same opts → same slices. */
export function donutSlices(
  entries: readonly HkDonutEntry[],
  opts: {
    /** Square viewBox side. */
    viewBox?: number;
    /** Ring radii; defaults keep the retired-ECharts look (radius
     * ["40%","68%"] of half the 150 box → 30 / 51). */
    outerR?: number;
    innerR?: number;
  } = {},
): HkDonutSlice[] {
  const shown = entries.filter((e) => e.value > 0);
  const total = shown.reduce((a, e) => a + e.value, 0);
  if (total <= 0) return [];
  const viewBox = opts.viewBox ?? 150;
  const cx = viewBox / 2;
  const cy = viewBox / 2;
  const outerR = opts.outerR ?? 0.68 * cx;
  const innerR = opts.innerR ?? 0.4 * cx;
  const slices: HkDonutSlice[] = [];
  let angle = -90;
  for (const e of shown) {
    const share = e.value / total;
    const sweep = share * 360;
    const end = angle + sweep;
    const path =
      sweep > 360 - 1e-9
        ? fullRing(cx, cy, outerR, innerR)
        : ringSegment(cx, cy, outerR, innerR, angle, end);
    slices.push({
      key: e.key,
      label: e.label,
      value: e.value,
      percent: Math.round(share * 10000) / 100,
      percentInt: Math.round(share * 100),
      path,
      fill: e.color ?? "",
    });
    angle = end;
  }
  return slices;
}

/** Split items into fixed-height columns: each column holds up to `size`
 *  items (filled top-to-bottom in input order), overflow continues in
 *  the next column to the right. Pure and order-preserving. */
export function chunkLegendItems<T>(items: readonly T[], size: number): T[][] {
  const rows = Math.max(1, Math.floor(size));
  const columns: T[][] = [];
  for (let i = 0; i < items.length; i += rows) {
    columns.push(items.slice(i, i + rows));
  }
  return columns;
}

/** Shared hover-focus class resolver: the hovered element lifts
 *  (is-hot), its siblings dim (is-dim). Class names only — the paint
 *  lives in the component's SCSS, so highlighting never rescales any
 *  shape. */
export function focusState<T>(hovered: T | null, key: T): { "is-hot": boolean; "is-dim": boolean } {
  return {
    "is-hot": hovered === key,
    "is-dim": hovered != null && hovered !== key,
  };
}
