import { describe, expect, it } from "vitest";

import {
  bucketLevel,
  calendarGrid,
  monthMarkers,
  shiftIso,
  todayIso,
  weekdayIndex,
  type HkCalendarHeatmapDay,
} from "./calendarHeatmap";

/** A Monday, for grid-shape assertions. */
const MON = "2025-12-01";

describe("weekdayIndex", () => {
  it("rotates getUTCDay to Monday-first", () => {
    expect(weekdayIndex("2025-12-01")).toBe(0); // Monday
    expect(weekdayIndex("2025-12-07")).toBe(6); // Sunday
    expect(weekdayIndex("2025-12-02")).toBe(1); // Tuesday
  });
});

describe("shiftIso", () => {
  it("shifts in UTC without local-timezone leaks", () => {
    expect(shiftIso("2025-12-01", 7)).toBe("2025-12-08");
    expect(shiftIso("2025-12-01", -1)).toBe("2025-11-30");
    expect(shiftIso("2026-01-01", -1)).toBe("2025-12-31"); // year wrap
  });
});

describe("todayIso", () => {
  it("returns a UTC ISO date", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("bucketLevel", () => {
  it("keeps zero and negative days at level 0", () => {
    expect(bucketLevel(0, 10)).toBe(0);
    expect(bucketLevel(-3, 10)).toBe(0);
    expect(bucketLevel(5, 0)).toBe(0); // degenerate window
  });

  it("scales against the window max with a ceil floor of 1", () => {
    expect(bucketLevel(1, 100)).toBe(1); // smallest consumption shows
    expect(bucketLevel(50, 100)).toBe(2);
    expect(bucketLevel(75, 100)).toBe(3);
    expect(bucketLevel(100, 100)).toBe(4);
    expect(bucketLevel(1000, 100)).toBe(4); // capped at peak
  });
});

describe("calendarGrid maxOverride — the max prop's wire to the buckets", () => {
  it("pins the intensity scale against the override, not the window's own peak", () => {
    const days = [{ date: MON, value: 10 }, { date: "2025-12-02", value: 1 }];
    // Without an override the levels ride the window's own peak (10).
    expect(calendarGrid(days, "2025-12-03", null).map((c) =>
      c.kind === "day" ? c.level : -1,
    )).toEqual([4, 1, 0, ...Array(4).fill(-1)]);
    // With maxOverride=100 the same days flatten — the caller's pinned
    // scale reaches the buckets (R2 S1: the prop was a dead wire).
    expect(calendarGrid(days, "2025-12-03", null, 100).map((c) =>
      c.kind === "day" ? c.level : -1,
    )).toEqual([1, 1, 0, ...Array(4).fill(-1)]);
  });

  it("derives from the days when the override is null or omitted", () => {
    const days = [{ date: MON, value: 5 }];
    expect(calendarGrid(days, "2025-12-03", null, null)[0]).toMatchObject({
      level: 4,
    });
  });
});

describe("calendarGrid", () => {
  it("pads a one-row series into a full week with real dates", () => {
    const cells = calendarGrid(
      [{ date: MON, value: 5 }],
      "2025-12-03",
      null,
    );
    expect(cells).toHaveLength(7);
    expect(cells[0]).toMatchObject({ kind: "day", date: MON });
    // Today and after: the tail of the always-full-year window.
    expect(cells[2]).toMatchObject({ kind: "day", date: "2025-12-03" });
    expect(cells[3]).toMatchObject({ kind: "gap", date: "2025-12-04", phase: "after" });
    expect(cells[6]).toMatchObject({ kind: "gap", phase: "after" });
  });

  it("hatches the before-first region and never claims a fake zero", () => {
    const cells = calendarGrid(
      [{ date: "2025-12-05", value: 5 }],
      "2025-12-07",
      "2025-12-05",
    );
    // 12-01..12-04: gaps (before); 12-05..12-07: days.
    expect(cells[0]).toMatchObject({ kind: "gap", phase: "before" });
    expect(cells[3]).toMatchObject({ kind: "gap", phase: "before" });
    expect(cells[4]).toMatchObject({ kind: "day", date: "2025-12-05" });
  });

  it("counts head padding before the series' first row as plain empty days, never gaps", () => {
    // The server didn't ship 12-01..12-02 (window starts 12-03) — but
    // no `first` anchor exists, so they are empty days, not "not yet".
    const cells = calendarGrid(
      [{ date: "2025-12-03", value: 5 }],
      "2025-12-03",
      null,
    );
    expect(cells[0]).toMatchObject({ kind: "day", date: "2025-12-01", level: 0 });
    expect(cells[1]).toMatchObject({ kind: "day", date: "2025-12-02", level: 0 });
  });

  it("clamps a malformed future `first` to hatch nothing", () => {
    const cells = calendarGrid(
      [{ date: MON, value: 5 }],
      "2025-12-03",
      "2026-01-01",
    );
    expect(cells.some((c) => c.kind === "gap" && c.phase === "before")).toBe(false);
  });

  it("returns an empty grid for an empty series", () => {
    expect(calendarGrid([], "2025-12-03", null)).toEqual([]);
  });
});

describe("monthMarkers — the leading-month suppression", () => {
  it("shows the first marker only when the grid's first column opens its month", () => {
    // Grid starts exactly on Dec 1 (a Monday AND the 1st); one row of
    // days pads into exactly one week.
    const cells = calendarGrid(
      [{ date: MON, value: 0 }],
      "2025-12-09",
      null,
    );
    expect(cells).toHaveLength(7);
    expect(cells[0]).toMatchObject({ date: "2025-12-01" });
    expect(monthMarkers(cells)).toEqual(["12"]);
  });

  it("suppresses a leading month that starts mid-month; the next month is labeled", () => {
    // Grid starts Oct 27 (a Monday, NOT the 1st) and runs into November;
    // two full weeks of cells.
    const days: HkCalendarHeatmapDay[] = [
      { date: "2025-10-27", value: 0 },
      { date: "2025-10-28", value: 0 },
      { date: "2025-10-29", value: 0 },
      { date: "2025-10-30", value: 0 },
      { date: "2025-10-31", value: 0 },
      { date: "2025-11-01", value: 0 },
      { date: "2025-11-02", value: 0 },
      { date: "2025-11-03", value: 0 },
      { date: "2025-11-04", value: 0 },
      { date: "2025-11-05", value: 0 },
    ];
    const cells = calendarGrid(days, "2025-11-05", null);
    expect(cells).toHaveLength(14);
    // The partial October tail is unlabeled; November's Monday opens.
    expect(monthMarkers(cells)).toEqual(["", "11"]);
  });

  it("labels no month when the whole grid sits inside one partial month", () => {
    const cells = calendarGrid(
      [{ date: "2025-10-13", value: 0 }],
      "2025-10-20",
      null,
    );
    expect(monthMarkers(cells)).toEqual([""]);
  });

  it("keeps the later markers honest about consecutive same-month columns", () => {
    // Two December Mondays: only the first carries the label.
    const days: HkCalendarHeatmapDay[] = [
      { date: MON, value: 0 },
      { date: "2025-12-02", value: 0 },
      { date: "2025-12-03", value: 0 },
      { date: "2025-12-04", value: 0 },
      { date: "2025-12-05", value: 0 },
      { date: "2025-12-06", value: 0 },
      { date: "2025-12-07", value: 0 },
      { date: "2025-12-08", value: 0 },
      { date: "2025-12-09", value: 0 },
      { date: "2025-12-10", value: 0 },
    ];
    const cells = calendarGrid(days, "2025-12-10", null);
    expect(monthMarkers(cells)).toEqual(["12", ""]);
  });
});
