import { describe, expect, it } from "vitest";

import { TOOLTIP_GAP_PX, tooltipPositionStyle } from "./tooltipPosition";

/** A 100x40 rect at (200,100) — big enough for every placement side. */
function rect(): DOMRect {
  return {
    left: 200, top: 100, right: 300, bottom: 140,
    width: 100, height: 40, x: 200, y: 100,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("tooltipPositionStyle", () => {
  it("pins the popup 8px outside the rect with per-placement transforms", () => {
    expect(TOOLTIP_GAP_PX).toBe(8);
    const top = tooltipPositionStyle(rect(), "top");
    expect(top.top).toBe("92px"); // 100 - 8
    expect(top.left).toBe("250px"); // hcenter
    expect(top.transform).toBe("translate(-50%, -100%)");

    const bottom = tooltipPositionStyle(rect(), "bottom");
    expect(bottom.top).toBe("148px"); // 140 + 8
    expect(bottom.transform).toBe("translate(-50%, 0)");

    const left = tooltipPositionStyle(rect(), "left");
    expect(left.left).toBe("192px"); // 200 - 8
    expect(left.top).toBe("120px"); // vcenter
    expect(left.transform).toBe("translate(-100%, -50%)");

    const right = tooltipPositionStyle(rect(), "right");
    expect(right.left).toBe("308px"); // 300 + 8
    expect(right.transform).toBe("translate(0, -50%)");
  });

  it("carries the maxWidth override onto the popup style", () => {
    const style = tooltipPositionStyle(rect(), "top", "180px");
    expect(style.maxWidth).toBe("180px");
    expect(tooltipPositionStyle(rect(), "top").maxWidth).toBeUndefined();
  });
});
