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
): SerpentinePath {
  const rand = mulberry32(seed);
  const centre = height / 2;
  const firstRowUp = rand() < 0.5;
  // Leg count is EVEN and always ends with the horizontal run to the right
  // edge: V,H,V,H,...,V,H. Corners (interior vertices) are therefore 3 or 5,
  // both inside the briefed 3..=5 range; the seeded first V satisfies "the
  // walk may start upward or downward".
  const legCount = rand() < 0.5 ? 4 : 6;
  const vLegs = legCount / 2;

  const rowA = centre - height * ROW_FRACTION;
  const rowB = centre + height * ROW_FRACTION;
  // On narrow canvases the run floor shrinks so the lane still fits.
  const minHRun = Math.min(MIN_H_RUN, Math.floor(width / 8));

  const points: PathPoint[] = [{ x: 0, y: centre }];
  let x = 0;
  // Distribute the horizontal budget across the H legs: every H leg except
  // the last gets a random slice (>= minHRun); the LAST H leg takes the
  // remainder so the walk lands exactly on the right edge.
  const hBudget = width - minHRun * (vLegs - 1);
  const hRuns: number[] = [];
  let used = 0;
  for (let h = 0; h < vLegs - 1; h++) {
    const fair = hBudget / vLegs;
    const run = minHRun + rand() * Math.max(0, fair * 1.6 - minHRun);
    const capped = Math.min(run, hBudget - used - minHRun * (vLegs - 1 - h));
    hRuns.push(Math.max(minHRun, capped));
    used += hRuns[hRuns.length - 1]!;
  }
  hRuns.push(width - used);

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
