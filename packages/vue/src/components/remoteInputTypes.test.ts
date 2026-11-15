import { describe, expect, it } from "vitest";

import {
  TAP_MAX_MS,
  TAP_MAX_TRAVEL_PX,
  clampToViewport,
  displayDeltaToRemote,
  displayScale,
  wheelNotches,
} from "./remoteInputTypes";

describe("remoteInputTypes pure helpers", () => {
  it("clamps into the inclusive pixel edges", () => {
    const vp = { width: 1920, height: 1080 };
    expect(clampToViewport(-20, -20, vp)).toEqual({ x: 0, y: 0 });
    expect(clampToViewport(5000, 5000, vp)).toEqual({ x: 1919, y: 1079 });
    expect(clampToViewport(960.4, 540.6, vp)).toEqual({ x: 960, y: 541 });
  });

  it("survives a degenerate viewport (never NaN, always 0..0)", () => {
    expect(clampToViewport(100, 100, { width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("scales display pixels per remote pixel", () => {
    // A 1920px remote screen shown in 960 display px: one display px
    // covers two remote px.
    expect(displayScale({ width: 1920, height: 1080 }, 960)).toBe(2);
    // Degenerate display box keeps 1:1 instead of exploding.
    expect(displayScale({ width: 1920, height: 1080 }, 0)).toBe(1);
  });

  it("maps display deltas into remote deltas", () => {
    expect(displayDeltaToRemote(10, -4, 2)).toEqual({ dx: 20, dy: -8 });
  });

  it("converts display scroll to notches with the canvas coefficient", () => {
    expect(wheelNotches(-53)).toBe(1); // finger up = scroll up
    expect(wheelNotches(53)).toBe(-1);
    expect(wheelNotches(-26)).toBe(0); // sub-notch rounds away
    expect(wheelNotches(-212)).toBe(4);
  });

  it("pins the gesture constants the recognisers branch on", () => {
    // The recognisers import these; pin the values so a silent edit
    // cannot desynchronise the docs from the behaviour.
    expect(TAP_MAX_MS).toBe(250);
    expect(TAP_MAX_TRAVEL_PX).toBe(8);
  });
});
