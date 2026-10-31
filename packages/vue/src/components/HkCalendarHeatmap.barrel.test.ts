import { describe, expect, it } from "vitest";
import * as barrel from "../index";
import { asIndexable } from "../utils/typing";

/**
 * The public barrel guard for the calendar heatmap's exports (R3 on the
 * S3-fix wave: deleting any of these lines from index.ts kept the ENTIRE
 * suite green, because every other test reaches the module through the
 * direct "./calendarHeatmap" path — only an external consumer would have
 * noticed). Same shape as HkFaceShell.barrel.test.ts.
 *
 * This file deliberately does NOT mock "@celestia-island/hikari": the
 * package's self-reference resolves to the very same src/index.ts module
 * as "../index", so a vi.mock here would replace the barrel under test
 * with the mock's own namespace.
 */
describe("the public barrel", () => {
  it("exports the heatmap component under both family names", () => {
    const hk = asIndexable(barrel.HkCalendarHeatmap);
    expect(hk, "HkCalendarHeatmap must be re-exported").toBeTruthy();
    expect(hk.name).toBe("HkCalendarHeatmap");
    // The H- alias rides the HCard/HkCard family convention.
    expect(barrel.HCalendarHeatmap).toBe(barrel.HkCalendarHeatmap);
  });

  it("exports the calendar grid math and the fill ladder", () => {
    for (const name of [
      "bucketLevel",
      "calendarGrid",
      "heatmapCellFill",
      "heatmapCellOpacity",
      "monthMarkers",
      "todayIso",
      "weekdayIndex",
      "shiftIso",
    ] as const) {
      expect(typeof barrel[name], `${name} must be re-exported`).toBe("function");
    }
    expect(Array.isArray(barrel.HEATMAP_LEVEL_OPACITY)).toBe(true);
    expect(barrel.HEATMAP_LEVEL_OPACITY).toHaveLength(4);
    expect(typeof barrel.HEATMAP_EMPTY_FILL).toBe("string");
    // The fill ladder the legend and the cells share: level 0 is the
    // empty wash, never the primary token.
    expect(barrel.heatmapCellFill(0)).toBe(barrel.HEATMAP_EMPTY_FILL);
    expect(barrel.heatmapCellFill(0)).not.toContain("primary");
    expect(barrel.heatmapCellOpacity(0)).toBeUndefined();
    expect(barrel.heatmapCellOpacity(4)).toBe(barrel.HEATMAP_LEVEL_OPACITY[3]);
  });
});
