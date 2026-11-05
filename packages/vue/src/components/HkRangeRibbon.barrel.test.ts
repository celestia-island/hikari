import { describe, expect, it } from "vitest";

import {
  HkRangeRibbon,
  type RibbonLane,
  type RibbonSegment,
  type RibbonStatus,
  type RibbonTip,
  type RibbonTone,
} from "../index";

/**
 * Public barrel guard for HkRangeRibbon (R3 review: deleting the component's
 * export block from src/index.ts kept the entire 4696-test suite green —
 * every other test reaches the module through the direct "./HkRangeRibbon"
 * path, so only an external consumer would have noticed). Same shape as
 * HkCalendarHeatmap.barrel.test.ts.
 */
describe("the public barrel", () => {
  it("re-exports the ribbon component under its public name", () => {
    expect(HkRangeRibbon, "HkRangeRibbon must be re-exported").toBeTruthy();
    expect(HkRangeRibbon.name).toBe("HkRangeRibbon");
  });

  it("re-exports the ribbon's public types", () => {
    // Type-only exports vanish at runtime, so each one is CONSUMED here: a
    // dropped `type Ribbon*` line fails vue-tsc on this file instead of
    // leaving the runtime suite green.
    const lane: RibbonLane = { key: "cpu", label: "CPU" };
    const tone: RibbonTone = "success";
    const status: RibbonStatus = "pending";
    const tip: RibbonTip = { title: "Boot", lines: ["12ms"] };
    const segment: RibbonSegment = {
      id: "boot",
      lane: lane.key,
      start: 0,
      end: 0.2,
      label: "boot",
      tone,
      status,
      tip,
    };
    expect(segment).toMatchObject({ id: "boot", lane: "cpu", start: 0, end: 0.2 });
    expect(segment.tip?.lines).toEqual(["12ms"]);
  });
});
