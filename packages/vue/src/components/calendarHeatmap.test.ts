import { describe, expect, it } from "vitest";

import {
  bucketLevel,
  calendarGrid,
  heatmapCellFill,
  heatmapCellOpacity,
  HEATMAP_EMPTY_FILL,
  HEATMAP_LEVEL_OPACITY,
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

describe("heatmapCellFill / heatmapCellOpacity — the empty cell is its own channel", () => {
  it("fills level 0 with the empty wash and every consuming level with primary", () => {
    expect(heatmapCellFill(0)).toBe(HEATMAP_EMPTY_FILL);
    // The empty wash must never be the primary token in disguise.
    expect(heatmapCellFill(0)).toContain("muted");
    expect(heatmapCellFill(0)).not.toContain("primary");
    for (const level of [1, 2, 3, 4] as const) {
      expect(heatmapCellFill(level)).toBe("var(--hi-color-primary)");
    }
  });

  it("leaves level 0 without an opacity step and maps 1..4 to the four consuming steps", () => {
    expect(heatmapCellOpacity(0)).toBeUndefined();
    expect(heatmapCellOpacity(1)).toBe(HEATMAP_LEVEL_OPACITY[0]);
    expect(heatmapCellOpacity(2)).toBe(HEATMAP_LEVEL_OPACITY[1]);
    expect(heatmapCellOpacity(3)).toBe(HEATMAP_LEVEL_OPACITY[2]);
    expect(heatmapCellOpacity(4)).toBe(HEATMAP_LEVEL_OPACITY[3]);
    // The ladder only ever holds the four consuming steps.
    expect(HEATMAP_LEVEL_OPACITY).toHaveLength(4);
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

  it("never hatches a day the server shipped, even past a skewed `today`", () => {
    // A skewed server clock (out of contract): the series runs one day
    // past `today`. The shipped day must render as a real day — every
    // day of the series vanishing behind the "after" hatch is the
    // failure mode this guards.
    const cells = calendarGrid(
      [
        { date: "2025-12-01", value: 5 },
        { date: "2025-12-02", value: 3 },
      ],
      "2025-12-01",
      null,
    );
    expect(cells.find((c) => c.date === "2025-12-02")).toMatchObject({
      kind: "day",
      value: 3,
      level: 3,
    });
    // The unshipped padding past it still hatches.
    expect(cells.find((c) => c.date === "2025-12-03")).toMatchObject({
      kind: "gap",
      phase: "after",
    });
  });
});

describe("monthMarkers — a month is labeled on the column carrying its 1st", () => {
  it("shows the first marker when the grid's first column opens its month", () => {
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

  it("never labels the partial head month — its 1st is not on the axis", () => {
    // Grid starts Oct 27 (a Monday, NOT the 1st) and runs into November;
    // two full weeks of cells. October's 1st is not in the grid, so no
    // column may carry its label; November's 1st sits in the head
    // column (Nov 1 is a Saturday there), so THAT column carries "11".
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
    const markers = monthMarkers(cells);
    expect(markers).not.toContain("10");
    expect(markers).toEqual(["11", ""]);
  });

  it("labels a month whose 1st falls mid-column, not one column late", () => {
    // Grid starts Mon Sep 29; Oct 1 (a Wednesday) is in the head
    // column. October is labeled THERE — the old Monday-opened rule
    // pushed it to the next column.
    const days: HkCalendarHeatmapDay[] = Array.from(
      { length: 14 },
      (_, i) => ({ date: shiftIso("2025-09-29", i), value: 0 }),
    );
    const cells = calendarGrid(days, "2025-10-12", null);
    expect(cells).toHaveLength(14);
    expect(monthMarkers(cells)).toEqual(["10", ""]);
  });

  it("labels a 1st the server shipped past a lead-clocked server (fix 5's boundary)", () => {
    // The ONE way an unarrived 1st ends up labeled: the series shipped
    // it, so fix 5 renders it a real day. A conforming server clamps its
    // window to its own today, so this needs a server clock leading the
    // client's — out of contract, and even then the chart is drawing a
    // day that really carries data.
    const shipped: HkCalendarHeatmapDay[] = [
      { date: "2025-10-27", value: 0 },
      { date: "2025-10-28", value: 0 },
      { date: "2025-10-29", value: 0 },
      { date: "2025-10-30", value: 0 },
      { date: "2025-10-31", value: 0 },
      { date: "2025-11-01", value: 2 },
    ];
    const cells = calendarGrid(shipped, "2025-10-29", null);
    expect(cells.find((c) => c.date === "2025-11-01")).toMatchObject({
      kind: "day",
    });
    // ...and the head column, which now carries November's 1st, labels it
    // while still never labeling its own partial October.
    expect(monthMarkers(cells)).toEqual(["11"]);

    // The identical axis WITHOUT the shipped 1st: unarrived → unlabeled
    // (the pair pins the boundary).
    const unshipped: HkCalendarHeatmapDay[] = shipped.slice(0, 3);
    const bare = calendarGrid(unshipped, "2025-10-29", null);
    expect(monthMarkers(bare)).toEqual([""]);
  });

  it("labels no month when the whole grid sits inside one partial month", () => {
    const cells = calendarGrid(
      [{ date: "2025-10-13", value: 0 }],
      "2025-10-20",
      null,
    );
    expect(monthMarkers(cells)).toEqual([""]);
  });

  it("does not label a month that has not started yet (a future 1st in the padding)", () => {
    // The axis pads to Sunday, so the column reaches Nov 1–2 while the
    // series (and `today`) stop at Oct 29: those cells are unshipped
    // future gaps. November holds no real day yet — labeling it would
    // claim a month the chart does not show.
    const days: HkCalendarHeatmapDay[] = Array.from(
      { length: 3 },
      (_, i) => ({ date: shiftIso("2025-10-27", i), value: 0 }),
    );
    const cells = calendarGrid(days, "2025-10-29", null);
    expect(cells).toHaveLength(7);
    expect(cells.find((c) => c.date === "2025-11-01")).toMatchObject({
      kind: "gap",
      phase: "after",
    });
    expect(monthMarkers(cells)).toEqual([""]);
  });

  it("still labels a 1st that fell before the account had data (a before gap)", () => {
    // The suppression test is `after`, not "is a gap": a month the chart
    // draws as unarrived is not labeled, while a PAST month the account
    // has no data for is still an axis and keeps its label. Dropping the
    // phase half of the check (`kind === "gap"`) would go green without
    // this test.
    const days: HkCalendarHeatmapDay[] = Array.from(
      { length: 3 },
      (_, i) => ({ date: shiftIso("2025-12-05", i), value: 0 }),
    );
    const cells = calendarGrid(days, "2025-12-07", "2025-12-02");
    expect(cells.find((c) => c.date === "2025-12-01")).toMatchObject({
      kind: "gap",
      phase: "before",
    });
    expect(monthMarkers(cells)).toEqual(["12"]);
  });

  it("keeps the later markers honest about consecutive same-month columns", () => {
    // Two December Mondays: only the column carrying Dec 1 is labeled.
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

  it("labels every month of a calendar year exactly once, on the column holding its 1st", () => {
    const days: HkCalendarHeatmapDay[] = Array.from(
      { length: 365 },
      (_, i) => ({ date: shiftIso("2025-01-01", i), value: 0 }),
    );
    // Today = the series' last day, so the padded tail (Jan 1 2026) is
    // still unarrived and carries no label.
    const cells = calendarGrid(days, "2025-12-31", null);
    const markers = monthMarkers(cells);
    expect(markers.filter((m) => m !== "")).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
    ]);
    // Each label sits on the column whose dates include that month's 1st.
    markers.forEach((label, col) => {
      if (!label) return;
      const dates = cells.slice(col * 7, col * 7 + 7).map((c) => c.date);
      expect(
        dates.some((d) => d.slice(8, 10) === "01" && Number(d.slice(5, 7)) === Number(label)),
      ).toBe(true);
    });
  });
});
