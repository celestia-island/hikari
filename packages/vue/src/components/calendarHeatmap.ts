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

/** Opacity per bucket (0–4) over the primary token; bucket 0 is the
 * muted empty cell. Five steps so "no consumption" stays visually
 * distinct from "the smallest consumption on record". Exported for the
 * component and its tests — the scale is part of the contract. */
export const HEATMAP_LEVEL_OPACITY = ["0.12", "0.22", "0.42", "0.66", "0.95"] as const;

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
 */
export function calendarGrid(
  days: HkCalendarHeatmapDay[],
  today: string,
  first: string | null,
): CalendarCell[] {
  if (days.length === 0) return [];
  const lead = weekdayIndex(days[0].date);
  const gridStart = shiftIso(days[0].date, -lead);
  const total = lead + days.length;
  const span = total + ((7 - (total % 7)) % 7);
  const max = days.reduce((m, d) => Math.max(m, d.value), 0);
  const valueByDate = new Map(days.map((d) => [d.date, d.value]));
  // A malformed `first` from the future hatches nothing (the clamp
  // keeps the before-check honest).
  const hatchFrom = first && first <= today ? first : null;
  const cells: CalendarCell[] = [];
  for (let i = 0; i < span; i++) {
    const date = shiftIso(gridStart, i);
    if (date > today) {
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
 * Month markers for the week columns: a short label on each column
 * whose Monday opens a month, "" otherwise.
 *
 * The leading month is the 2026-10 refinement this extraction carries:
 * a trailing-year window (or any window) usually starts MID-month, so
 * the first column shows only the tail of its month. A label there
 * would claim a month whose start is not visible on the chart — the
 * GitHub convention is to suppress it. The first marker is therefore
 * shown ONLY when the grid's first column actually opens its month
 * (its Monday is the 1st); every later marker keeps the previous
 * rule (this column's Monday opens a month the previous column's
 * Monday did not). Every grid cell carries a real calendar date, so
 * the marker can never lie about padding.
 */
export function monthMarkers(cells: CalendarCell[]): string[] {
  const weeks = Math.ceil(cells.length / 7);
  const markers: string[] = [];
  let prevMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const monday = cells[w * 7];
    if (!monday) break;
    const month = Number(monday.date.slice(5, 7));
    const opensMonth =
      w === 0 ? monday.date.slice(8, 10) === "01" : month !== prevMonth;
    markers.push(opensMonth ? String(month) : "");
    prevMonth = month;
  }
  return markers;
}
