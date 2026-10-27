/**
 * Pure squarified-treemap layout (Bruls, Huizing & van Wijk, 2000).
 *
 * Extracted from any DOM so the two contracts that matter are directly
 * unit-pinnable:
 *
 *  1. AREA TRUTH — every input value maps to a rectangle whose area is
 *     the value's exact share of the canvas (float rounding aside); a
 *     cell can never claim more or less screen than its datum weighs.
 *  2. ASPECT BOUND — squarify's whole point over slice-and-dice: the
 *     worst rectangle aspect ratio on this canvas stays bounded
 *     (≤ 4 for reasonable inputs; the pin asserts a generous ceiling to
 *     stay robust against pathological single-dominant inputs).
 */

export interface SquarifyInput {
  id: string;
  value: number;
}

export interface SquarifyRect {
  id: string;
  /** Canvas-space rectangle. */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WorkingRow {
  ids: string[];
  values: number[];
  /** Shortest side of the current strip. */
  short: number;
  /** Sum of the row's values (total length along the strip). */
  total: number;
  /** Worst aspect ratio this row would produce. */
  worst: number;
}

function aspect(short: number, value: number, total: number): number {
  // A row laid along `short` splits it proportionally by value: the
  // cell's extent along the strip is (value/total)*short... inverted:
  // each cell's STRIP-SIDE length is total/short * ... — the standard
  // formulation: sides are (short * value/total, total/short).
  const sideA = (short * value) / total;
  const sideB = total / short;
  const max = Math.max(sideA, sideB);
  const min = Math.min(sideA, sideB);
  return min > 0 ? max / min : Number.POSITIVE_INFINITY;
}

function worstFor(row: WorkingRow, short: number, total: number): number {
  let worst = 0;
  for (const value of row.values) {
    worst = Math.max(worst, aspect(short, value, total));
  }
  return worst;
}

/**
 * Lay `values` (id→positive weight) into the rectangle `(x, y, w, h)`.
 *
 * Deterministic: input order is preserved within a strip (stable sort by
 * DESCENDING value first — squarify's precondition), ties keep input
 * order. Zero/negative/NaN weights are dropped (the caller's layout
 * builder already guarantees positive values; this is defense in depth).
 */
export function squarify(values: readonly SquarifyInput[], x: number, y: number, w: number, h: number): SquarifyRect[] {
  const items = values
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .slice()
    .sort((a, b) => (b.value - a.value) || 0);

  const rects: SquarifyRect[] = [];
  if (items.length === 0 || w <= 0 || h <= 0) return rects;

  // Scale values into CANVAS AREAS first (v' = v · w·h / Σv): the strip
  // math below assumes a row's value-sum IS the area it covers. Without
  // this, the layout comes out in value-space (a canvas-sized sum of 18px²
  // instead of the canvas's own area).
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  const areaScale = (w * h) / totalValue;
  // Copy before scaling: the caller's objects are never mutated (the
  // "pure" contract on the module — the old in-place scaling wrote
  // through shared refs, R3 S2-1).
  for (let i = 0; i < items.length; i += 1) {
    items[i] = { id: items[i]!.id, value: items[i]!.value * areaScale };
  }

  let cx = x;
  let cy = y;
  let cw = w;
  let ch = h;
  let index = 0;

  while (index < items.length) {
    const short = Math.min(cw, ch);
    const vertical = cw >= ch; // strip runs along the SHORT side
    let row: WorkingRow = { ids: [], values: [], short, total: 0, worst: Number.POSITIVE_INFINITY };

    const layRow = (r: WorkingRow) => {
      const stripLen = r.total / r.short;
      let offset = vertical ? cy : cx;
      for (let i = 0; i < r.ids.length; i += 1) {
        const extent = (r.values[i]! / r.total) * r.short;
        if (vertical) {
          rects.push({ id: r.ids[i]!, x: cx, y: offset, w: stripLen, h: extent });
          offset += extent;
        } else {
          rects.push({ id: r.ids[i]!, x: offset, y: cy, w: extent, h: stripLen });
          offset += extent;
        }
      }
      if (vertical) {
        cx += stripLen;
        cw -= stripLen;
      } else {
        cy += stripLen;
        ch -= stripLen;
      }
    };

    while (index < items.length) {
      const item = items[index]!;
      const candidateTotal = row.total + item.value;
      const candidateWorst = worstFor(
        { ids: [...row.ids, item.id], values: [...row.values, item.value], short, total: candidateTotal, worst: 0 },
        short,
        candidateTotal,
      );
      if (row.ids.length === 0 || candidateWorst <= row.worst) {
        row = {
          ids: [...row.ids, item.id],
          values: [...row.values, item.value],
          short,
          total: candidateTotal,
          worst: candidateWorst,
        };
        index += 1;
      } else {
        break;
      }
    }
    layRow(row);
  }

  return rects;
}

/** The worst aspect ratio across a laid-out rectangle set (test seam). */
export function worstAspectRatio(rects: readonly SquarifyRect[]): number {
  let worst = 1;
  for (const rect of rects) {
    if (rect.w <= 0 || rect.h <= 0) continue;
    const ratio = Math.max(rect.w / rect.h, rect.h / rect.w);
    worst = Math.max(worst, ratio);
  }
  return worst;
}
