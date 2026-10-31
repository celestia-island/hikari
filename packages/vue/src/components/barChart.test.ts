import { describe, expect, it } from "vitest";

import { BAR_FRAME, barLayout, fmtBar, niceMax } from "./barChart";

/** Two weeks of daily buckets (wowsp's home shape: 15 slots). */
const DAYS = [3600, 7200, 0, 5400, 9000, 1200, 0, 3600, 3600, 10800, 0, 7200, 1800, 900, 4500];

describe("niceMax", () => {
  it("rounds up to the 1-2-5 ladder", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-3)).toBe(1);
    expect(niceMax(0.7)).toBe(1);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(1.5)).toBe(2);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(6)).toBe(10);
    expect(niceMax(70)).toBe(100);
    expect(niceMax(600)).toBe(1000);
  });
});

describe("barLayout", () => {
  it("matches the default frame", () => {
    const l = barLayout(DAYS);
    expect(l.width).toBe(BAR_FRAME.width);
    expect(l.height).toBe(BAR_FRAME.height);
    expect(l.baselineY).toBe(BAR_FRAME.height - BAR_FRAME.bottomPad);
  });

  it("emits one slot per bucket, zero buckets pathless", () => {
    const l = barLayout(DAYS);
    expect(l.bars).toHaveLength(DAYS.length);
    DAYS.forEach((v, i) => {
      expect(l.bars[i].value).toBe(v);
      expect(l.bars[i].path === "").toBe(!(v > 0));
    });
  });

  it("draws three gridline guides at 0 / half / the nice max", () => {
    const l = barLayout([4, 8]);
    expect(l.gridlines.map((g) => g.value)).toEqual([0, 5, 10]);
    expect(l.gridlines[0].y).toBe(fmtBar(l.baselineY));
    expect(l.gridlines[2].y).toBe(fmtBar(BAR_FRAME.topPad));
  });

  it("tallest bar tops out at the top pad", () => {
    const l = barLayout([0, 10]);
    // niceMax(10) = 10 → the max bar fills the plot: its highest path
    // point (the Q control / corner) sits exactly at the top pad.
    const nums = l.bars[1].path.split(/[\sMLQAZ]+/).filter(Boolean).map(Number);
    expect(Math.min(...nums)).toBe(BAR_FRAME.topPad);
  });

  it("is deterministic", () => {
    expect(barLayout(DAYS)).toEqual(barLayout(DAYS));
  });
});
