import { describe, expect, it } from "vitest";

import {
  firstWeekdayOf,
  isoDayKey,
  isoWeekday,
  isoWeekdayOfJs,
  monthGrid,
  pad2,
  sameDay,
  weekdayLabels,
} from "./calendarGrid";

/**
 * calendarGrid — the pure layer under HkWeekdayPicker: ISO day keys, the
 * locale week order and the fixed 42-cell month grid. No DOM, no locale
 * bundle: everything is derived from `Intl`, so these cases pin the
 * arithmetic the component's class names hang off.
 */

/** The weekInfo data the weekday-order cases depend on (Node ≥ 20 ships
 *  it; a runtime without ICU week data must still pass on the fallback).
 *  `weekInfo` is newer than the package's ES2022 lib target, hence the
 *  cast — the runtime probe is the point, not the type. */
const HAS_WEEK_INFO = (() => {
  try {
    const loc = new Intl.Locale("de-DE") as Intl.Locale & { weekInfo?: unknown };
    return loc.weekInfo !== undefined;
  } catch {
    return false;
  }
})();

/** Labels a locale produces for `n` days starting at Sunday (2024-01-07). */
function sundayFirstLabels(locale: string, style: "short" | "long" = "short"): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: style });
  return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2024, 0, 7 + i)));
}

function mondayFirstLabels(locale: string, style: "short" | "long" = "short"): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: style });
  return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2024, 0, 8 + i)));
}

describe("calendarGrid — day keys", () => {
  it("pads to two digits and leaves longer values alone", () => {
    expect(pad2(0)).toBe("00");
    expect(pad2(7)).toBe("07");
    expect(pad2(9)).toBe("09");
    expect(pad2(10)).toBe("10");
    expect(pad2(123)).toBe("123");
  });

  it("builds a local-time ISO day key (never UTC-shifted)", () => {
    expect(isoDayKey(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(isoDayKey(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
    expect(isoDayKey(new Date(2028, 1, 29, 0, 0))).toBe("2028-02-29");
    // The year is never truncated to two digits.
    expect(isoDayKey(new Date(999, 5, 4))).toBe("999-06-04");
  });

  it("compares calendar days by year/month/date, not clock time", () => {
    expect(sameDay(new Date(2026, 7, 16, 0, 0), new Date(2026, 7, 16, 23, 59))).toBe(true);
    expect(sameDay(new Date(2026, 7, 16), new Date(2026, 7, 17))).toBe(false);
    expect(sameDay(new Date(2026, 7, 16), new Date(2025, 7, 16))).toBe(false);
    expect(sameDay(new Date(2026, 7, 16), new Date(2026, 8, 16))).toBe(false);
  });

  it("maps JS weekdays onto the ISO 1=Mon … 7=Sun alphabet", () => {
    // 2026-08-16 is a Sunday, 2026-08-17 a Monday.
    expect(isoWeekday(new Date(2026, 7, 16))).toBe(7);
    expect(isoWeekday(new Date(2026, 7, 17))).toBe(1);
    expect(isoWeekday(new Date(2026, 7, 22))).toBe(6);
    expect(isoWeekdayOfJs(0)).toBe(7);
    expect(isoWeekdayOfJs(1)).toBe(1);
    expect(isoWeekdayOfJs(6)).toBe(6);
  });
});

describe("calendarGrid — locale week order", () => {
  it("derives the first weekday from Intl.Locale#weekInfo", () => {
    // en-US starts on Sunday; de-DE on Monday. Both are weekInfo data,
    // so a runtime without it reports the documented Sunday fallback.
    expect(firstWeekdayOf("en-US")).toBe(0);
    if (HAS_WEEK_INFO) {
      expect(firstWeekdayOf("de-DE")).toBe(1);
    } else {
      expect(firstWeekdayOf("de-DE")).toBe(0);
    }
  });

  it("falls back to Sunday for an unusable locale instead of throwing", () => {
    expect(() => firstWeekdayOf("not a locale!!")).not.toThrow();
    expect(firstWeekdayOf("not a locale!!")).toBe(0);
    expect(firstWeekdayOf("")).toBe(0);
  });

  it("returns seven labels, rotated to the locale's week start", () => {
    expect(weekdayLabels("en-US")).toEqual(sundayFirstLabels("en-US"));
    expect(weekdayLabels("en-US")).toHaveLength(7);
    expect(weekdayLabels("en-US", "long")).toEqual(sundayFirstLabels("en-US", "long"));
    if (HAS_WEEK_INFO) {
      // Monday-first locale: the header really reorders (this is the
      // assertion the component's header test relies on).
      expect(weekdayLabels("de-DE")).toEqual(mondayFirstLabels("de-DE"));
      expect(weekdayLabels("de-DE")[0]).not.toBe(weekdayLabels("en-US")[0]);
    }
    // Whatever the week start, the seven labels are distinct.
    expect(new Set(weekdayLabels("en-US", "long")).size).toBe(7);
  });
});

describe("calendarGrid — month grid", () => {
  it("always yields exactly 42 contiguous days", () => {
    const cells = monthGrid(2026, 7, 0);
    expect(cells).toHaveLength(42);
    for (let i = 1; i < cells.length; i += 1) {
      const prev = cells[i - 1]!.date;
      const cur = cells[i]!.date;
      const expected = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1);
      expect(sameDay(cur, expected), `cell ${i} follows cell ${i - 1}`).toBe(true);
    }
    expect(new Set(cells.map((c) => c.key)).size).toBe(42);
    // Keys sort the way the grid reads.
    expect(cells.map((c) => c.key)).toEqual([...cells.map((c) => c.key)].sort());
  });

  it("starts on the locale's first weekday and flags the month's own days", () => {
    const sundayFirst = monthGrid(2026, 7, 0); // August 2026
    expect(sundayFirst[0]!.date.getDay()).toBe(0);
    // August 1 2026 is a Saturday, so a Sunday-first grid leads with July 26.
    expect(sundayFirst[0]!.key).toBe("2026-07-26");
    expect(sundayFirst.filter((c) => c.inMonth)).toHaveLength(31);
    expect(sundayFirst.filter((c) => c.inMonth)[0]!.key).toBe("2026-08-01");
    expect(sundayFirst.filter((c) => c.inMonth).at(-1)!.key).toBe("2026-08-31");

    const mondayFirst = monthGrid(2026, 7, 1);
    expect(mondayFirst[0]!.date.getDay()).toBe(1);
    expect(mondayFirst[0]!.key).toBe("2026-07-27");
    expect(mondayFirst.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it("shows the neighbour months in the leading and trailing cells", () => {
    const cells = monthGrid(2026, 7, 0);
    const byKey = new Map(cells.map((c) => [c.key, c]));
    expect(byKey.get("2026-07-26")!.inMonth).toBe(false);
    expect(byKey.get("2026-07-31")!.inMonth).toBe(false);
    expect(byKey.get("2026-09-01")!.inMonth).toBe(false);
    // The 42-cell window is exactly six weeks wide.
    expect(byKey.get("2026-09-05")!.inMonth).toBe(false);
  });

  it("keeps February 29 in a leap year and drops it otherwise", () => {
    const leap = monthGrid(2028, 1, 1);
    expect(leap.filter((c) => c.inMonth)).toHaveLength(29);
    expect(leap.some((c) => c.key === "2028-02-29" && c.inMonth)).toBe(true);

    const common = monthGrid(2026, 1, 1);
    expect(common.filter((c) => c.inMonth)).toHaveLength(28);
    expect(common.some((c) => c.key === "2026-02-29")).toBe(false);
  });

  it("rolls December into January of the next year", () => {
    const december = monthGrid(2026, 11, 1);
    expect(december[0]!.key).toBe("2026-11-30"); // Monday before Dec 1
    const janFirst = december.find((c) => c.key === "2027-01-01");
    expect(janFirst, "the trailing cells cross the year boundary").toBeTruthy();
    expect(janFirst!.inMonth).toBe(false);
    expect(janFirst!.date.getFullYear()).toBe(2027);
  });

  it("normalizes an overflowing month instead of drifting a week", () => {
    const overflow = monthGrid(2026, 12, 1);
    const january = monthGrid(2027, 0, 1);
    expect(overflow.map((c) => c.key)).toEqual(january.map((c) => c.key));
  });

  it("keeps the weekday of every cell aligned with its cell index", () => {
    for (const first of [0, 1, 6]) {
      const cells = monthGrid(2026, 7, first);
      cells.forEach((cell, i) => {
        expect(cell.date.getDay(), `cell ${i} for first=${first}`).toBe((first + i) % 7);
      });
    }
  });
});
