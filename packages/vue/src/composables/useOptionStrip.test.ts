import { describe, expect, it } from "vitest";

import {
  WHEEL_LINE_PX,
  overflowSides,
  panEngaged,
  stripWheelDelta,
} from "./useOptionStrip";

describe("stripWheelDelta", () => {
  it("lets a real horizontal wheel delta win over the vertical one", () => {
    expect(stripWheelDelta(0, -120, 40)).toBe(-120);
  });
  it("translates a plain vertical notch onto the horizontal axis", () => {
    expect(stripWheelDelta(0, 0, 80)).toBe(80);
    expect(stripWheelDelta(0, 0, -80)).toBe(-80);
  });
  it("normalizes Firefox line mode to pixels per notch", () => {
    expect(stripWheelDelta(1, 0, 3)).toBe(3 * WHEEL_LINE_PX);
    expect(stripWheelDelta(1, -2, 0)).toBe(-2 * WHEEL_LINE_PX);
  });
});

describe("panEngaged", () => {
  it("engages at the threshold on EITHER axis", () => {
    expect(panEngaged(5, 0, 5)).toBe(true);
    expect(panEngaged(0, -5, 5)).toBe(true);
    expect(panEngaged(4, 4, 5)).toBe(false);
  });
});

describe("overflowSides", () => {
  /**
   * A real element carrying stub scroll geometry.
   *
   * `overflowSides` is declared against `Element`, so the fixture must BE one.
   * A detached happy-dom element reports zero geometry and exposes these as
   * getter-only accessors, so an own data property shadows them — no
   * assertion involved.
   */
  function fake(scrollWidth: number, clientWidth: number, scrollLeft: number): HTMLElement {
    const el = document.createElement("div");
    for (const [key, value] of Object.entries({ scrollWidth, clientWidth, scrollLeft })) {
      Object.defineProperty(el, key, { value, configurable: true, writable: true });
    }
    return el;
  }
  it("reports none when the strip fits", () => {
    expect(overflowSides(fake(100, 120, 0))).toBe("none");
  });
  it("reports the edges that still hide content (sub-pixel resting counts)", () => {
    expect(overflowSides(fake(200, 100, 0))).toBe("end");
    expect(overflowSides(fake(200, 100, 100))).toBe("start");
    expect(overflowSides(fake(200, 100, 40))).toBe("both");
    expect(overflowSides(fake(200, 100, 0.5))).toBe("end");
  });
});
