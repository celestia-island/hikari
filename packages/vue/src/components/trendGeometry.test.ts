// Ports of packages/components/src/data/trend_chart.rs's cfg(test) cases —
// same fixtures, same pinned numbers — so the Vue and Rust mirrors cannot
// drift apart silently. The render-layer cases (component + the offline
// pre-render string) live here too; the component's DOM cases are in
// ./HkTrendChart.test.tsx.
//
// AI-generated (glm-5.3-flash via DeepSeek Harness), 2026-11-03 — SySL-1.0 §2.3.

import { describe, expect, it } from "vitest";

import {
  renderTrendChartSvg,
  TREND_CHART_HEIGHT,
  TREND_CHART_TIME_WINDOW_MS,
  TREND_CHART_WIDTH,
  TREND_THRESHOLD_DASHED,
  TREND_THRESHOLD_DOTTED,
  TREND_THRESHOLD_H_COLOR,
  TREND_THRESHOLD_HH_COLOR,
  TREND_THRESHOLD_L_COLOR,
  TREND_THRESHOLD_LL_COLOR,
  trendAreaPath,
  trendGeometry,
  trendHeightPx,
  trendPenColor,
  trendPolyline,
  trendWindowEnd,
  type AlarmThresholds,
  type TrendPen,
} from "./trendGeometry";

/** The Rust tests' `pen(label, samples)` fixture. */
function pen(label: string, samples: [number, number][], thresholds?: AlarmThresholds): TrendPen {
  const out: TrendPen = {
    label,
    data: samples.map(([time, value]) => ({ time, value })),
  };
  if (thresholds !== undefined) out.thresholds = thresholds;
  return out;
}

function limits(hh?: number, h?: number, l?: number, ll?: number): AlarmThresholds {
  const out: AlarmThresholds = {};
  if (hh !== undefined) out.hh = hh;
  if (h !== undefined) out.h = h;
  if (l !== undefined) out.l = l;
  if (ll !== undefined) out.ll = ll;
  return out;
}

describe("trendHeightPx", () => {
  it("lifts only px lengths into the viewBox", () => {
    expect(trendHeightPx("240px")).toBe(240);
    expect(trendHeightPx(" 120px ")).toBe(120);
    // Everything else keeps the default frame height.
    expect(trendHeightPx("0px")).toBe(TREND_CHART_HEIGHT);
    expect(trendHeightPx("-40px")).toBe(TREND_CHART_HEIGHT);
    expect(trendHeightPx("18rem")).toBe(TREND_CHART_HEIGHT);
    expect(trendHeightPx("240")).toBe(TREND_CHART_HEIGHT);
    expect(trendHeightPx("")).toBe(TREND_CHART_HEIGHT);
    expect(trendHeightPx("240px;")).toBe(TREND_CHART_HEIGHT);
  });
});

describe("trendPolyline / trendAreaPath", () => {
  it("joins coordinates and closes the area down to the baseline", () => {
    const points = [
      { x: 50, y: 200 },
      { x: 335, y: 115 },
      { x: 620, y: 30 },
    ];
    expect(trendPolyline(points)).toBe("50,200 335,115 620,30");
    expect(trendAreaPath(points, 200)).toBe(
      "M 50 200 L 335 115 L 620 30 L 620 200 L 50 200 Z",
    );
    expect(trendAreaPath([], 200)).toBe("");
  });
});

describe("trendGeometry", () => {
  it("projects the rolling window onto the frame", () => {
    // 640 x 240 frame → plot 50..620 horizontally, 30..200 vertically.
    const pens = [pen("cpu", [[0, 1], [4000, 2], [4500, 3], [5000, 4]])];
    const geometry = trendGeometry(pens, 5000, 1000, 640, 240, true);
    const frame = geometry.frame;
    expect(frame.windowStart).toBe(4000);
    expect(frame.windowEnd).toBe(5000);
    expect([frame.plotLeft, frame.plotRight, frame.plotTop, frame.plotBottom]).toEqual([
      50, 620, 30, 200,
    ]);
    // The window drops the two oldest samples and maps the rest.
    expect(geometry.pens[0].points).toHaveLength(3);
    expect(geometry.pens[0].line).toBe("50,200 335,115 620,30");
    expect(geometry.pens[0].area).toBe("M 50 200 L 335 115 L 620 30 L 620 200 L 50 200 Z");
  });

  it("freezes the window at the newest sample without a clock", () => {
    const pens = [pen("cpu", [[0, 1], [4000, 2], [4500, 3], [5000, 4]])];
    const explicit = trendGeometry(pens, 5000, 1000, 640, 240, true);
    const derived = trendGeometry(pens, undefined, 1000, 640, 240, true);
    expect(derived.frame.windowEnd).toBe(5000);
    expect(derived.pens[0].line).toBe(explicit.pens[0].line);
    // No samples at all → the window sits at the epoch.
    expect(trendWindowEnd([], undefined)).toBe(0);
  });

  it("handles a single sample and a flat series", () => {
    // A single sample: one coordinate (an invisible line, like the old
    // symbol-less series) and a padded range that lands mid-plot.
    const single = trendGeometry([pen("cpu", [[1000, 7]])], 1000, 5000, 640, 240, true);
    expect(single.frame.valueMin).toBe(6);
    expect(single.frame.valueMax).toBe(8);
    expect(single.pens[0].line).toBe("620,115");
    expect(single.pens[0].area).toBe("M 620 115 L 620 200 L 620 200 Z");

    // A flat series must not divide by zero (the axis pads by ±1).
    const flat = trendGeometry(
      [pen("cpu", [[0, 5], [1000, 5]])],
      1000,
      1000,
      640,
      240,
      true,
    );
    expect(flat.frame.valueMin).toBe(4);
    expect(flat.frame.valueMax).toBe(6);
    for (const point of flat.pens[0].points) {
      expect(Math.abs(point.y - 115)).toBeLessThan(1e-9);
    }
  });

  it("keeps negative values inside the frame", () => {
    const pens = [pen("temp", [[0, -10], [1000, -2]])];
    const geometry = trendGeometry(pens, 1000, 1000, 640, 240, true);
    expect(geometry.frame.valueMin).toBe(-10);
    expect(geometry.frame.valueMax).toBe(-2);
    // Lowest value sits on the baseline, highest on the plot top.
    expect(Math.abs(geometry.pens[0].points[0].y - 200)).toBeLessThan(1e-9);
    expect(Math.abs(geometry.pens[0].points[1].y - 30)).toBeLessThan(1e-9);
  });

  it("survives no pens, a zero window and a tiny frame", () => {
    const empty = trendGeometry([], undefined, TREND_CHART_TIME_WINDOW_MS, 640, 240, true);
    expect(empty.pens).toHaveLength(0);
    expect(empty.thresholds).toHaveLength(0);
    expect(empty.frame.valueMin).toBe(0);
    expect(empty.frame.valueMax).toBe(1);
    expect(empty.frame.windowStart).toBe(-TREND_CHART_TIME_WINDOW_MS);

    // timeWindowMs <= 0 collapses the window to an instant (the old
    // `minTime = now`) — the projection still stays finite.
    const instant = trendGeometry([pen("cpu", [[1000, 3]])], 1000, 0, 640, 240, true);
    expect(instant.frame.windowStart).toBe(1000);
    expect(instant.pens[0].points).toHaveLength(1);
    expect(Number.isFinite(instant.pens[0].points[0].x)).toBe(true);

    // A frame smaller than the paddings must not invert the plot box.
    const tiny = trendGeometry(
      [pen("cpu", [[0, 1], [1000, 2]])],
      1000,
      1000,
      40,
      20,
      true,
    );
    expect(tiny.frame.plotLeft).toBe(tiny.frame.plotRight);
    expect(tiny.frame.plotTop).toBe(tiny.frame.plotBottom);
  });

  it("emits one guide per present threshold in Vue order", () => {
    const withLimits = pen("cpu", [[0, 1], [1000, 9]], limits(5, 2, 1.5, 1));
    const geometry = trendGeometry([withLimits], 1000, 1000, 640, 240, true);
    expect(geometry.thresholds).toHaveLength(4);
    expect(geometry.thresholds.map((line) => line.color)).toEqual([
      TREND_THRESHOLD_HH_COLOR,
      TREND_THRESHOLD_H_COLOR,
      TREND_THRESHOLD_L_COLOR,
      TREND_THRESHOLD_LL_COLOR,
    ]);
    expect(geometry.thresholds.map((line) => line.dash)).toEqual([
      TREND_THRESHOLD_DASHED,
      TREND_THRESHOLD_DOTTED,
      TREND_THRESHOLD_DOTTED,
      TREND_THRESHOLD_DASHED,
    ]);
    // hh = 5 on a 1..9 axis maps between the others, in order.
    expect(geometry.thresholds[0].y).toBeLessThan(geometry.thresholds[1].y);
    expect(geometry.thresholds[1].y).toBeLessThan(geometry.thresholds[2].y);

    // `showThresholds = false` wins over any limits.
    const hidden = trendGeometry([withLimits], 1000, 1000, 640, 240, false);
    expect(hidden.thresholds).toHaveLength(0);
  });

  it("clips guides outside the value range", () => {
    const withLimits = pen("cpu", [[0, 2], [1000, 4]], limits(50, 3, -20, undefined));
    const geometry = trendGeometry([withLimits], 1000, 1000, 640, 240, true);
    expect(geometry.thresholds.map((line) => line.value)).toEqual([3]);
  });

  it("colors pens from the token ladder", () => {
    const geometry = trendGeometry(
      [pen("cpu", [[0, 1], [1000, 2]]), pen("mem", [[0, 3], [1000, 4]])],
      1000,
      1000,
      640,
      240,
      true,
    );
    expect(geometry.pens).toHaveLength(2);
    expect(geometry.pens[0].label).toBe("cpu");
    expect(geometry.pens[0].color).toBe("rgb(var(--color-primary))");
    expect(geometry.pens[1].color).toBe("rgb(var(--color-success))");
    // The ladder wraps for the sixth pen and never runs out.
    expect(trendPenColor(5)).toBe(trendPenColor(0));
    expect(trendPenColor(9)).toBe("rgb(var(--color-info))");
  });
});

describe("renderTrendChartSvg", () => {
  it("parses as SVG with the documented node inventory", () => {
    const pens = [
      pen("cpu", [[0, 1], [5000, 4]], limits(4)),
      pen("mem", [[0, 3], [5000, 4]]),
    ];
    const svg = renderTrendChartSvg(pens, { now: 5000, timeWindowMs: 5000 });
    expect(svg.startsWith('<svg class="hk-trend-chart__svg" viewBox="0 0 640 240"')).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    // happy-dom parses it; node counts: 1 svg, 1 threshold, 2 areas + 2 lines.
    const host = document.createElement("div");
    host.innerHTML = svg;
    expect(host.querySelectorAll("svg.hk-trend-chart__svg")).toHaveLength(1);
    expect(host.querySelectorAll("line.hk-trend-chart__threshold")).toHaveLength(1);
    expect(host.querySelectorAll("path.hk-trend-chart__area")).toHaveLength(2);
    expect(host.querySelectorAll("polyline.hk-trend-chart__line")).toHaveLength(2);
  });

  it("is byte-for-byte the mirror's markup (the Rust test's needles)", () => {
    const svg = renderTrendChartSvg([pen("cpu", [[0, 1], [5000, 4]])], {
      now: 5000,
      timeWindowMs: 5000,
    });
    expect(svg).toContain('<svg class="hk-trend-chart__svg" viewBox="0 0 640 240" preserveAspectRatio="none" style="display:block;width:100%;height:100%">');
    expect(svg).toContain('<polyline class="hk-trend-chart__line" points="50,200 620,30" fill="none" stroke="rgb(var(--color-primary))" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>');
    expect(svg).toContain('<path class="hk-trend-chart__area" d="M 50 200 L 620 30 L 620 200 L 50 200 Z" fill="rgb(var(--color-primary))" fill-opacity="0.12" stroke="none"/>');
  });

  it("renders threshold guides into the markup, and only then", () => {
    const svg = renderTrendChartSvg(
      [pen("cpu", [[0, 1], [1000, 9]], limits(8))],
      { now: 1000, timeWindowMs: 1000 },
    );
    expect(svg).toContain('<line class="hk-trend-chart__threshold" x1="50"');
    expect(svg).toContain('stroke="#FF1744"');
    expect(svg).toContain('stroke-dasharray="6 4"');

    const bare = renderTrendChartSvg([pen("cpu", [[0, 1]])], { now: 0 });
    expect(bare).not.toContain("hk-trend-chart__threshold");
  });

  it("keeps pen labels out of the markup (no escaping surface)", () => {
    const svg = renderTrendChartSvg([pen('<script & friends>', [[0, 1]])], { now: 0 });
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("&");
  });

  it("accepts a numeric height and defaults like the props", () => {
    expect(
      renderTrendChartSvg([], { height: 120 }).startsWith(
        '<svg class="hk-trend-chart__svg" viewBox="0 0 640 120"',
      ),
    ).toBe(true);
    // Non-positive / non-finite numbers keep the default frame, like the
    // CSS-length rule.
    expect(
      renderTrendChartSvg([], { height: -40 }).startsWith(
        `<svg class="hk-trend-chart__svg" viewBox="0 0 640 ${TREND_CHART_HEIGHT}"`,
      ),
    ).toBe(true);
    expect(
      renderTrendChartSvg([], { height: "18rem" }).startsWith(
        `<svg class="hk-trend-chart__svg" viewBox="0 0 640 ${TREND_CHART_HEIGHT}"`,
      ),
    ).toBe(true);
    // Bare call = the props' defaults (pens empty → an empty plot).
    expect(renderTrendChartSvg([])).toBe(
      `<svg class="hk-trend-chart__svg" viewBox="0 0 ${TREND_CHART_WIDTH} ${TREND_CHART_HEIGHT}" preserveAspectRatio="none" style="display:block;width:100%;height:100%"></svg>`,
    );
  });
});
