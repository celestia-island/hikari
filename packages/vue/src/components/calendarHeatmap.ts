/**
 * Calendar-heatmap math — pure helpers for HkCalendarHeatmap.
 *
 * Upstreamed from the shittim-chest quota page's degree-usage section
 * (2026-10 user direction: a calendar heatmap is a big business
 * component — the rich-text-viewer table — not a view-local helper).
 * The server ships a DENSE daily series (oldest → newest, zero-filled,
 * inclusive of today, plus the account's first activity date).
 * Everything the component renders — the full-year week grid with its
 * hatched no-data gaps, the month markers — derives here so each
 * derivation is unit-testable without a component mount.
 */

/** The empty cell (level 0) and the legend's first swatch fill: the
 * muted token washed out so "no consumption" stays visually distinct
 * from "the smallest consumption on record". Level 0 has no opacity
 * step of its own — it may not be re-tinted by the primary token at
 * all. */
export const HEATMAP_EMPTY_FILL =
  "color-mix(in srgb, var(--hi-color-muted) 40%, transparent)";

/** Opacity per CONSUMING bucket (levels 1–4) over the primary token,
 * four steps low → peak. The array is indexed by `level - 1` (level 0
 * is `HEATMAP_EMPTY_FILL`, never an opacity step); the legend renders
 * the empty swatch plus these four. Exported for the component and its
 * tests — the scale is part of the contract. */
export const HEATMAP_LEVEL_OPACITY = ["0.22", "0.42", "0.66", "0.95"] as const;

/** The fill for one cell: level 0 carries the empty wash, every
 * consuming level rides the primary token. The empty cell is never
 * re-tinted primary and never takes an opacity step (the reference
 * calendar this upstreaming followed draws it the same way), so the
 * two channels stay independent — pinned as a helper because happy-dom
 * drops `color-mix()` out of a parsed `background`. */
export function heatmapCellFill(level: 0 | 1 | 2 | 3 | 4): string {
  return level === 0 ? HEATMAP_EMPTY_FILL : "var(--hi-color-primary)";
}

/** The opacity step for one cell: level 0 has none (its wash is the
 * fill), consuming levels index [`HEATMAP_LEVEL_OPACITY`] by
 * `level - 1`. */
export function heatmapCellOpacity(
  level: 0 | 1 | 2 | 3 | 4,
): string | undefined {
  return level === 0 ? undefined : HEATMAP_LEVEL_OPACITY[level - 1];
}

/** One input day of the dense series. `value` may be negative or zero
 * (a "no consumption" day) — it still buckets to level 0. */
export type HkCalendarHeatmapDay = { date: string; value: number };

/** Monday-first weekday index of an ISO date (Mon = 0 … Sun = 6). */
export function weekdayIndex(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  // getUTCDay: Sun = 0 … Sat = 6 → rotate to Monday-first.
  return (d.getUTCDay() + 6) % 7;
}

/** ISO date ± n days (UTC arithmetic only — no local timezone leaks). */
export function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today as an ISO date (UTC — the series' day boundary). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * One heatmap cell: a real day of the series, or a gap the account has
 * no data for — before its first activity, or after today (the rest of
 * the always-full-year window). Gaps render hatched and inert; they
 * never claim a fake "0 consumption" for a day that never was.
 */
export type CalendarCell =
  | { kind: "day"; date: string; value: number; level: 0 | 1 | 2 | 3 | 4 }
  | { kind: "gap"; date: string; phase: "before" | "after" };

/**
 * Pad the dense series into the week-aligned calendar grid: head cells
 * back to the window's first Monday, tail cells to Sunday — so a
 * trailing-year window ALWAYS lands on a full-year-wide grid, however
 * young the account is. Every cell carries its real calendar date;
 * cells outside [first … today] become gaps (hatched, inert).
 *
 * `maxOverride` pins the intensity scale (R2: the component's `max`
 * prop must reach the buckets, not just the data-max attribute — a
 * caller pinning the scale across windows would otherwise get levels
 * computed against each window's own peak). null = derive from `days`.
 */
export function calendarGrid(
  days: HkCalendarHeatmapDay[],
  today: string,
  first: string | null,
  maxOverride?: number | null,
): CalendarCell[] {
  if (days.length === 0) return [];
  const lead = weekdayIndex(days[0].date);
  const gridStart = shiftIso(days[0].date, -lead);
  const total = lead + days.length;
  const span = total + ((7 - (total % 7)) % 7);
  const max = maxOverride ?? days.reduce((m, d) => Math.max(m, d.value), 0);
  const valueByDate = new Map(days.map((d) => [d.date, d.value]));
  // A malformed `first` from the future hatches nothing (the clamp
  // keeps the before-check honest).
  const hatchFrom = first && first <= today ? first : null;
  const cells: CalendarCell[] = [];
  for (let i = 0; i < span; i++) {
    const date = shiftIso(gridStart, i);
    // Never hatch a date the server actually shipped: a series whose
    // last row runs past `today` (a skewed server clock, out of
    // contract) would otherwise render EVERY one of its days as a
    // future gap — the data would vanish behind the hatch. (The
    // before-first hatch below deliberately does NOT consult the map:
    // the server fills the pre-anchor stretch with dense zeros as
    // filler, and the account's first-activity anchor is what decides
    // that no data existed, however many filler rows arrive.)
    if (date > today && !valueByDate.has(date)) {
      cells.push({ kind: "gap", date, phase: "after" });
      continue;
    }
    if (hatchFrom && date < hatchFrom) {
      cells.push({ kind: "gap", date, phase: "before" });
      continue;
    }
    // Dates in the head padding before the series' first row predate
    // the requested window (the server didn't ship them) — they count
    // as plain empty days, never gaps.
    const value = valueByDate.get(date) ?? 0;
    cells.push({ kind: "day", date, value, level: bucketLevel(value, max) });
  }
  return cells;
}

/** The heatmap's intensity bucket: 0 (none) … 4 (peak), scaled against
 * the window's max day. Zero/negative days are bucket 0; every
 * consuming day lands in 1..4 (ceil, so even the smallest consumption
 * shows one step above empty). */
export function bucketLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4))) as 0 | 1 | 2 | 3 | 4;
}

/**
 * Month markers for the week columns: a short label over the column
 * that CONTAINS a month's first day (the 1st), "" otherwise.
 *
 * The leading-month rule (2026-10 user direction) falls out of this
 * anchor instead of being a special case: a trailing-year window
 * usually starts MID-month, so the head column carries only that
 * month's tail — the head month's 1st is not in the grid, so it is
 * never labeled. A month whose 1st IS on the axis is labeled on the
 * column showing it (which may be mid-column rather than the next
 * Monday), so no label lands one column late.
 *
 * The one suppression is the unarrived tail: the padded axis may reach
 * into next month's first days as "after" cells, and a 1st the chart
 * itself renders as unarrived carries no label — a label there would
 * announce a month the chart does not draw yet. The test rides the
 * cell's PHASE, not its data: a 1st the server shipped is a real day
 * and labels normally (only a server whose clock leads the client's,
 * out of contract, can ship one), and a past month the account has no
 * data for at all is still an axis the chart draws, so it keeps its
 * label. Every grid cell carries a real calendar date, so the marker
 * can never lie about padding.
 */
export function monthMarkers(cells: CalendarCell[]): string[] {
  const weeks = Math.ceil(cells.length / 7);
  const markers: string[] = [];
  // `lastFirstMonth` is belt-and-braces for callers that hand this helper
  // a sparse or hand-built cell list: a contiguous axis never carries a
  // month's 1st twice (a 7-day column holds at most one "01"), so on
  // calendarGrid output the guard never fires. It mirrors the reference
  // grid's own `labeledMonth` dedup.
  let lastFirstMonth = -1;
  for (let w = 0; w < weeks; w++) {
    let month = -1;
    for (let d = 0; d < 7; d++) {
      const cell = cells[w * 7 + d];
      if (!cell) break;
      const isMonthStart = cell.date.slice(8, 10) === "01";
      const isFuture = cell.kind === "gap" && cell.phase === "after";
      if (isMonthStart && !isFuture) {
        month = Number(cell.date.slice(5, 7));
        break;
      }
    }
    markers.push(month !== -1 && month !== lastFirstMonth ? String(month) : "");
    if (month !== -1) lastFirstMonth = month;
  }
  return markers;
}
