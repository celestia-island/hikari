import { describe, expect, it } from "vitest";

import {
  chunkLegendItems,
  donutSlices,
  focusState,
  type HkDonutEntry,
} from "./donutGeometry";

const ENTRIES: HkDonutEntry[] = [
  { key: "dd", label: "DD", value: 60 },
  { key: "ca", label: "CA", value: 30 },
  { key: "bb", label: "BB", value: 10 },
];

describe("donutSlices", () => {
  it("lays shares out clockwise from 12 o'clock", () => {
    const s = donutSlices(ENTRIES);
    expect(s.map((x) => x.percentInt)).toEqual([60, 30, 10]);
    // First slice starts at the top: its path begins at the 12-o'clock
    // outer point (cx, cy - outerR) on the 150 box.
    expect(s[0].path.startsWith(`M 75 ${75 - 51}`)).toBe(true);
  });

  it("drops non-positive entries and yields [] for all-zero input", () => {
    expect(donutSlices([{ key: "a", label: "A", value: 0 }])).toEqual([]);
    expect(donutSlices([])).toEqual([]);
  });

  it("splits a 100% slice into two 180° halves (no degenerate arc)", () => {
    const s = donutSlices([{ key: "solo", label: "Solo", value: 7 }]);
    expect(s).toHaveLength(1);
    expect(s[0].percentInt).toBe(100);
    // Two subpaths = two M commands.
    expect(s[0].path.match(/M /g)).toHaveLength(2);
  });

  it("keeps percent and percentInt from diverging on display rounding", () => {
    const s = donutSlices([
      { key: "a", label: "A", value: 1 },
      { key: "b", label: "B", value: 2 },
    ]);
    // 33.33% raw → percent 33.33, percentInt 33.
    expect(s[0].percent).toBeCloseTo(33.33, 2);
    expect(s[0].percentInt).toBe(33);
  });

  it("carries the caller's color through", () => {
    const s = donutSlices([{ key: "a", label: "A", value: 1, color: "#abc" }]);
    expect(s[0].fill).toBe("#abc");
  });
});

describe("chunkLegendItems", () => {
  it("fills columns top-to-bottom then right", () => {
    expect(chunkLegendItems([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
  });

  it("clamps a zero/negative size to one row per column", () => {
    expect(chunkLegendItems([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe("focusState", () => {
  it("marks the hovered key hot and siblings dim", () => {
    expect(focusState("a", "a")).toEqual({ "is-hot": true, "is-dim": false });
    expect(focusState("a", "b")).toEqual({ "is-hot": false, "is-dim": true });
    expect(focusState(null, "b")).toEqual({ "is-hot": false, "is-dim": false });
  });
});
