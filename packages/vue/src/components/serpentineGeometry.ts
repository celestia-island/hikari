/**
 * Serpentine lane geometry — the pure half of {@link HkSerpentineUnlock}.
 *
 * Generates an axis-aligned polyline inside a three-row lane: the walk
 * starts at the LEFT edge on the vertical centre line, makes 3–5 random
 * 90° turns (legs strictly alternate horizontal/vertical), and finishes at
 * the RIGHT edge back on the centre line, with the final leg approaching
 * horizontally. The first leg may go up, down, or right — the direction is
 * seeded, not fixed.
 *
 * Pure and deterministic per seed, so the state-machine tests can drive
 * the walker along a known polyline and the component can regenerate the
 * lane per mount without a shared random source.
 */

export interface PathPoint {
  x: number;
  y: number;
}

export interface SerpentinePath {
  /** Polyline vertices; `points[0]` is the start, the last is the goal. */
  points: PathPoint[];
  /** Total polyline length (px). */
  totalLength: number;
}

/** Vertical fraction of the lane centre for the two travelling rows. */
const ROW_FRACTION = 0.25;

/** Seeded PRNG (mulberry32) — deterministic per seed, no shared state. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Polyline length. */
export function pathLength(points: PathPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * Point at `distance` along the polyline (arc-length parameterisation),
 * clamped to the end.
 */
export function projectOntoPath(points: PathPoint[], distance: number): PathPoint {
  let remaining = distance;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const leg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= leg) {
      const t = leg === 0 ? 0 : remaining / leg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= leg;
  }
  const last = points[points.length - 1]!;
  return { x: last.x, y: last.y };
}

/** Minimum horizontal run per horizontal leg (px) — keeps turns readable. */
const MIN_H_RUN = 40;

/** Horizontal inset of the start/goal from the container edges (px). The
 *  resting handle sits ON these points; without the inset it hugs the
 *  border line and half of its hit area falls outside the gate. */
export const TRACK_PAD = 24;

export interface TurnRange {
  /** Inclusive minimum corner count. */
  min: number;
  /** Inclusive maximum corner count. */
  max: number;
}

/** The default corner range (the brief: 3–5 turns). */
export const DEFAULT_TURNS: TurnRange = { min: 3, max: 5 };

/**
 * Snap a requested corner count to a CONSTRUCTIBLE value. The lane always
 * ends with the horizontal run to the goal, which forces an odd corner
 * count (3, 5, 7, …) — an even request clamps DOWN to the odd value below
 * it, so a caller asking for "at most N turns" never gets more than N.
 */
export function snapTurnCount(requested: number): number {
  return requested % 2 === 1 ? requested : requested - 1;
}

/**
 * Build the serpentine lane for a `width × height` canvas.
 *
 * Layout model: two travelling rows above and below the centre line
 * (`ROW_FRACTION` of the height off centre), connected by vertical legs.
 * Horizontal legs advance monotonically to the right along those rows; the
 * final leg is horizontal, on the centre line, ending at the right edge.
 * Vertical legs alternate between the rows, which structurally forbids
 * self-intersection, and every turn is a true 90° corner.
 */
export function generateSerpentinePath(
  width: number,
  height: number,
  seed: number,
  turns: TurnRange = DEFAULT_TURNS,
): SerpentinePath {
  const rand = mulberry32(seed);
  const centre = height / 2;
  const firstRowUp = rand() < 0.5;
  const pad = Math.min(TRACK_PAD, width / 8);
  // Corner count: a seeded draw inside the requested range, snapped to a
  // constructible (odd) value — higher ranges (sensitive deletions) walk
  // more corners. Leg count is corners + 1 and always ends with the
  // horizontal run to the right edge: V,H,V,H,...,V,H. The seeded first V
  // satisfies "the walk may start upward or downward".
  const requestedMin = Math.max(3, Math.floor(turns.min));
  const requestedMax = Math.max(requestedMin, Math.ceil(turns.max));
  const low = Math.max(3, snapTurnCount(requestedMin));
  const high = Math.max(low, snapTurnCount(requestedMax));
  const corners = Math.max(low, Math.min(high, snapTurnCount(
    low + Math.floor(rand() * (high - low + 1)),
  )));
  const legCount = corners + 1;
  const vLegs = legCount / 2;

  const rowA = centre - height * ROW_FRACTION;
  const rowB = centre + height * ROW_FRACTION;
  // On narrow canvases the run floor shrinks so the lane still fits.
  const minHRun = Math.min(MIN_H_RUN, Math.floor(width / 8));

  const points: PathPoint[] = [{ x: pad, y: centre }];
  let x = pad;
  // Distribute the horizontal budget across the H legs: every H leg except
  // the last gets a random slice (>= minHRun); the LAST H leg takes the
  // remainder so the walk lands exactly on the right edge.
  const span = width - pad * 2;
  const hBudget = span - minHRun * (vLegs - 1);
  const hRuns: number[] = [];
  let used = 0;
  for (let h = 0; h < vLegs - 1; h++) {
    const fair = hBudget / vLegs;
    const run = minHRun + rand() * Math.max(0, fair * 1.6 - minHRun);
    const capped = Math.min(run, hBudget - used - minHRun * (vLegs - 1 - h));
    hRuns.push(Math.max(minHRun, capped));
    used += hRuns[hRuns.length - 1]!;
  }
  hRuns.push(span - used);

  // Legs strictly alternate V,H,V,H,...,V,H: each V switches the travelling
  // row (centre -> firstRow -> secondRow -> ... -> centre), each H advances
  // strictly rightward along that row, so the polyline never self-intersects
  // and every turn is a true 90° corner.
  let currentRow = centre;
  for (let v = 0; v < vLegs; v++) {
    const target =
      v === vLegs - 1
        ? centre
        : currentRow === centre
          ? firstRowUp
            ? rowA
            : rowB
          : currentRow === rowA
            ? rowB
            : rowA;
    // The V leg: straight down/up at the current x.
    points.push({ x, y: target });
    currentRow = target;
    if (v < vLegs - 1) {
      // The H leg along the new row: advance and pin the endpoint.
      x += hRuns[v]!;
      points.push({ x, y: target });
    }
  }
  // Final H leg: run to the right edge on the centre line.
  x += hRuns[vLegs - 1]!;
  points.push({ x, y: centre });

  return { points, totalLength: pathLength(points) };
}


/**
 * Closest point on the polyline to `p`, with its arc length from the start.
 * The lane's x is monotone but its ARC is longer than any x (vertical legs),
 * so drag progress must be measured by projection, not by x fraction.
 */
export function nearestOnPath(
  points: PathPoint[],
  p: PathPoint,
): { point: PathPoint; distance: number; arc: number } {
  let best = { point: points[0]!, distance: Infinity, arc: 0 };
  let arcBefore = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const legSq = dx * dx + dy * dy;
    const t = legSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / legSq));
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < best.distance) {
      best = { point: { x: cx, y: cy }, distance: d, arc: arcBefore + Math.sqrt(legSq) * t };
    }
    arcBefore += Math.sqrt(legSq);
  }
  return best;
}
