// slideConfirmPath.ts — the PURE geometry half of HkSlideConfirm (the
// component renders; this module decides). No Vue, no DOM: every function
// here is jsdom-testable without layout.
//
// The path is an orthogonal polyline through a 3-lane grid, normalized to
// the unit square: x ∈ [0,1] left→right, y ∈ {1/6, 1/2, 5/6} (three lane
// centers). A seeded walk lays out the random right-angle turns the user
// drags the knob through; the component maps grid points to px with the
// track's measured box.
//
// CONTRACT (2026-11-19 user direction, the fat slide-to-confirm): height
// spans three standard control rows, the walk carries AT LEAST three
// right-angle turns, the knob travels strictly along the lane, and any
// premature release snaps back — the mechanics live in the component; the
// shape lives here.

export interface SlidePoint {
  /** 0 → left edge, 1 → right edge. */
  x: number;
  /** Lane-center fraction of the three-lane band (1/6, 1/2 or 5/6). */
  y: number;
}

export interface SlidePath {
  /** Orthogonal polyline: points[0] = start (x=0), last = end (x=1). */
  points: SlidePoint[];
  /** The count of right-angle turns (≥ minTurns by construction). */
  turns: number;
}

/** Deterministic PRNG (mulberry32) — a `seed` prop pins the exact path so
 *  tests can assert geometry; production passes a fresh random seed per
 *  mount (the captcha property: every confirmation gets a new route). */
export function slideConfirmRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lane-center fraction for a row index in the three-lane band. */
export function slideLaneY(row: 0 | 1 | 2): number {
  return (row + 0.5) / 3;
}

/**
 * Generate the orthogonal walk: start on a random lane at x=0, run right
 * to each turn column, jump vertically to a DIFFERENT lane, finish with a
 * final run to x=1. Turn count ∈ [minTurns, maxTurns] (defaults 3..5);
 * turn columns are strictly increasing with a minimum spacing so every
 * horizontal run is grabbable; consecutive turn rows always differ (a
 * "turn" that stays on the lane is not a turn).
 */
export function generateSlidePath(
  seed: number,
  opts?: { minTurns?: number; maxTurns?: number },
): SlidePath {
  const minTurns = opts?.minTurns ?? 3;
  const maxTurns = opts?.maxTurns ?? 5;
  const rng = slideConfirmRng(seed);
  const turns = minTurns + Math.floor(rng() * (maxTurns - minTurns + 1));

  // Turn columns: strictly increasing, spaced inside (0.14, 0.86) so the
  // opening and closing runs stay grabbable on any track width.
  const lo = 0.14;
  const hi = 0.86;
  const raw: number[] = [];
  for (let i = 0; i < turns; i++) raw.push(lo + rng() * (hi - lo));
  raw.sort((a, b) => a - b);
  // Enforce a minimum spacing (each vertical jump deserves a horizontal
  // approach); a squeezed draw collapses toward an even spread.
  const minGap = 0.12;
  const cols: number[] = [];
  for (const c of raw) {
    const floor = cols.length > 0 ? cols[cols.length - 1]! + minGap : lo;
    cols.push(Math.max(c, floor));
  }

  // Lane walk: each turn = the horizontal run ends ON the current lane at
  // the turn column, then a vertical jump to one of the OTHER two lanes
  // (the corner pair: same x, different y). A "turn" that stays on the
  // lane is not a turn.
  let row = Math.floor(rng() * 3) as 0 | 1 | 2;
  const points: SlidePoint[] = [{ x: 0, y: slideLaneY(row) }];
  for (const col of cols) {
    points.push({ x: col, y: slideLaneY(row) });
    const others = ([0, 1, 2] as const).filter((r) => r !== row);
    row = others[Math.floor(rng() * others.length)]!;
    points.push({ x: col, y: slideLaneY(row) });
  }
  points.push({ x: 1, y: slideLaneY(row) });

  // Corners can coincide in degenerate draws — dedupe consecutive
  // duplicates while keeping the orthogonal shape.
  const deduped: SlidePoint[] = [];
  for (const p of points) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.x !== p.x || prev.y !== p.y) deduped.push(p);
  }

  return { points: deduped, turns };
}

/** The lane's pixel polyline for a measured track box (padding included by
 *  the caller — pass the INNER box the knob travels within). */
export function slidePixelPoints(
  points: SlidePoint[],
  width: number,
  height: number,
): SlidePoint[] {
  return points.map((p) => ({ x: p.x * width, y: p.y * height }));
}

/** Total pixel length of the pixel polyline. */
export function slidePathLength(pixel: SlidePoint[]): number {
  let total = 0;
  for (let i = 1; i < pixel.length; i++) {
    total += Math.hypot(
      pixel[i]!.x - pixel[i - 1]!.x,
      pixel[i]!.y - pixel[i - 1]!.y,
    );
  }
  return total;
}

/** The point at arc-length fraction `t` ∈ [0,1] of the pixel polyline. */
export function slidePointAtT(
  pixel: SlidePoint[],
  t: number,
): SlidePoint {
  const clamped = Math.min(1, Math.max(0, t));
  const total = slidePathLength(pixel);
  if (total <= 0) return { ...pixel[0]! };
  let target = clamped * total;
  for (let i = 1; i < pixel.length; i++) {
    const segLen = Math.hypot(
      pixel[i]!.x - pixel[i - 1]!.x,
      pixel[i]!.y - pixel[i - 1]!.y,
    );
    if (target <= segLen || i === pixel.length - 1) {
      const f = segLen === 0 ? 0 : target / segLen;
      return {
        x: pixel[i - 1]!.x + (pixel[i]!.x - pixel[i - 1]!.x) * f,
        y: pixel[i - 1]!.y + (pixel[i]!.y - pixel[i - 1]!.y) * f,
      };
    }
    target -= segLen;
  }
  return { ...pixel[pixel.length - 1]! };
}

/**
 * The FURTHEST arc-length fraction the knob may advance to while staying
 * within `tolerancePx` of the pointer, scanning from `fromT` (monotonic:
 * the knob never retreats by following). Returns null when the pointer is
 * outside the corridor entirely — the component treats that as a failed
 * attempt (snap-back), per the contract that the knob must trace the lane.
 */
export function slideAdvanceT(
  pixel: SlidePoint[],
  fromT: number,
  pointerX: number,
  pointerY: number,
  tolerancePx: number,
): number | null {
  const steps = 240;
  let best: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (t < fromT) continue;
    const p = slidePointAtT(pixel, t);
    if (Math.hypot(p.x - pointerX, p.y - pointerY) <= tolerancePx) best = t;
  }
  return best;
}
