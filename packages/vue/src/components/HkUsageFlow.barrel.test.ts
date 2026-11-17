import { describe, expect, it } from "vitest";

import * as barrel from "../index";

/**
 * The public barrel guard for the usage-flow family (the
 * HkCalendarHeatmap.barrel.test.ts precedent): every other test reaches
 * the modules through their direct paths, so deleting the re-export lines
 * from index.ts would leave the whole suite green — only an external
 * consumer (arona / shittim-chest) would notice.
 *
 * This file deliberately does NOT mock "@celestia-island/hikari": the
 * package's self-reference resolves to this very module.
 */
describe("the public barrel", () => {
  it("exports the component under both family names", () => {
    expect(barrel.HkUsageFlow, "HkUsageFlow must be re-exported").toBeTruthy();
    expect(barrel.HUsageFlow).toBe(barrel.HkUsageFlow);
  });

  it("exports the pure layout helpers", () => {
    expect(typeof barrel.usageFlowLayout).toBe("function");
    expect(typeof barrel.truncateFlowLabel).toBe("function");
    expect(typeof barrel.formatFlowPercent).toBe("function");
    expect(Array.isArray(barrel.USAGE_FLOW_PALETTE)).toBe(true);
    expect(barrel.USAGE_FLOW_PALETTE.length).toBeGreaterThanOrEqual(8);
  });

  it("lays out a minimal flow through the barrel surface", () => {
    const layout = barrel.usageFlowLayout([
      { source: "a", middle: "b", target: "c", value: 1 },
    ]);
    expect(layout.empty).toBe(false);
    expect(layout.nodes).toHaveLength(3);
    expect(layout.links).toHaveLength(2);
    expect(layout.legend.map((row) => row.label)).toEqual(["c"]);
  });
});
