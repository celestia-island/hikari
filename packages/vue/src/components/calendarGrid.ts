/**
 * calendarGrid — the pure month-grid and locale helpers behind the
 * calendar-shaped pickers (HkWeekdayPicker).
 *
 * Everything here is locale-derived (`Intl.DateTimeFormat`,
 * `Intl.Locale#weekInfo`) and dependency-free, so the geometry and the
 * week order can be unit-tested without a DOM: the component only maps
 * these results onto class names.
 *
 * Numbering conventions — one per concern, deliberately:
 *   · `Date#getDay()` / `firstWeekdayOf` → 0 = Sunday … 6 = Saturday
 *     (what a JS `Date` and `weekInfo.firstDay` speak);
 *   · the picker's MODEL (`modelValue: number[]`) → 1 = Monday …
 *     7 = Sunday, i.e. the ISO-8601 weekday number (`isoWeekday`).
 */

/** One cell of the six-week month grid. */
export interface CalendarDay {
  /** Local-time midnight of the cell's day. */
  date: Date;
  /** Local-time ISO day key, `YYYY-MM-DD` (stable across renders). */
  key: string;
  /** False for the leading/trailing days that belong to a neighbour month. */
  inMonth: boolean;
}

/** Zero-pad a number to two digits. */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local-time ISO day key (`YYYY-MM-DD`) — never UTC, so a mount at
 *  23:30 local still names the day the user sees. */
export function isoDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Same calendar day (year + month + date), regardless of clock time. */
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/**
 * First day of the week (0 = Sunday … 6 = Saturday) for a locale, taken
 * from `Intl.Locale#weekInfo` (or the older `getInfo`) when the runtime
 * provides it and defaulting to Sunday — the same proven helper shape as
 * HkDatePicker.tsx.
 *
 * `weekInfo.firstDay` speaks ISO numbers (1 = Monday … 7 = Sunday); the
 * 7 maps onto this module's Sunday-based 0. Runtimes without ICU week
 * data (or a malformed locale) fall through to 0.
 */
export function firstWeekdayOf(locale: string): number {
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { firstDay?: number | string };
      getInfo?: () => { firstDayOfWeek?: string };
    };
    const candidates: unknown[] = [];
    if (loc.weekInfo) candidates.push(loc.weekInfo.firstDay);
    if (typeof loc.getInfo === "function") candidates.push(loc.getInfo().firstDayOfWeek);
    for (const raw of candidates) {
      const n = Number(raw);
      if (!Number.isInteger(n)) continue;
      if (n >= 1 && n <= 7) return n % 7; // ISO → Sunday-based
      if (n === 0) return 0;
    }
  } catch {
    // Fall through to the Sunday default.
  }
  return 0;
}

/**
 * Weekday labels in the locale's week order — index 0 belongs to
 * `firstWeekday`, so the header always reads the way the locale's
 * calendars do. `style` is any `Intl.DateTimeFormat` weekday style
 * (`"short"` for the grid header, `"long"` for accessible names).
 *
 * 2024-01-07 is a Sunday; offsetting by the locale's first weekday is
 * the same trick HkDatePicker uses.
 */
export function weekdayLabels(locale: string, style: "short" | "long" = "short"): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: style });
  const first = firstWeekdayOf(locale);
  return Array.from({ length: 7 }, (_, i) =>
    formatter.format(new Date(2024, 0, 7 + ((first + i) % 7))));
}

/** ISO weekday number (1 = Monday … 7 = Sunday) — the weekday model's
 *  alphabet, as opposed to the Sunday-based `Date#getDay()`. */
export function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** ISO weekday number for a raw `Date#getDay()` value. */
export function isoWeekdayOfJs(jsDay: number): number {
  const n = ((Math.trunc(jsDay) % 7) + 7) % 7;
  return n === 0 ? 7 : n;
}

/**
 * The month grid: always 6 weeks × 7 days = 42 cells, starting at the
 * first `firstWeekday`-aligned day on or before the 1st of `month`.
 *
 * `year`/`month` are forgiving the way `Date` is: `month` may overflow in
 * either direction (11 → December, 12 → January of the next year) and the
 * grid is built from the normalized month, so a caller never has to
 * pre-normalize a decade roll-over.
 */
export function monthGrid(year: number, month: number, firstWeekday: number): CalendarDay[] {
  const anchor = new Date(year, month, 1);
  const targetYear = anchor.getFullYear();
  const targetMonth = anchor.getMonth();
  const first = new Date(targetYear, targetMonth, 1);
  // Leading cells: walk back from the 1st to the locale's week start.
  const firstDay = ((Math.trunc(firstWeekday) % 7) + 7) % 7;
  const lead = (first.getDay() - firstDay + 7) % 7;
  const out: CalendarDay[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(targetYear, targetMonth, 1 - lead + i);
    out.push({
      date,
      key: isoDayKey(date),
      inMonth: date.getFullYear() === targetYear && date.getMonth() === targetMonth,
    });
  }
  return out;
}
