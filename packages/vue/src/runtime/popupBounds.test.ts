// Contract tests for the app-chrome popup bounds context.
//
// AI disclosure: drafted by GLM via the ZCode agent, directed and
// reviewed by langyo — SySL-1.0 §2.3.
import { afterEach, describe, expect, it } from "vitest";

import { readHkRuntime, writeHkRuntime } from "./registry";
import {
  configurePopupInsets,
  popupInsets,
  popupViewportRect,
  POPUP_INSET_VARS,
} from "./popupBounds";

const PREV_INNER = { width: window.innerWidth, height: window.innerHeight };

afterEach(() => {
  configurePopupInsets(null);
  window.innerWidth = PREV_INNER.width;
  window.innerHeight = PREV_INNER.height;
});

describe("popupBounds", () => {
  it("defaults to a zero band and the full-window frame", () => {
    window.innerWidth = 1280;
    window.innerHeight = 800;
    expect(popupInsets()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(popupViewportRect()).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
  });

  it("shrinks the popup frame by the configured band", () => {
    window.innerWidth = 1280;
    window.innerHeight = 800;
    configurePopupInsets({ top: 32, left: 48 });
    expect(popupViewportRect()).toEqual({ x: 48, y: 32, width: 1232, height: 768 });
  });

  it("replaces the whole band on re-configure and clears on null", () => {
    window.innerWidth = 1280;
    window.innerHeight = 800;
    configurePopupInsets({ top: 32, bottom: 10 });
    configurePopupInsets({ left: 64 });
    expect(popupInsets()).toEqual({ top: 0, right: 0, bottom: 0, left: 64 });
    expect(popupViewportRect()).toEqual({ x: 64, y: 0, width: 1216, height: 800 });
    configurePopupInsets(null);
    expect(popupViewportRect()).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
  });

  it("sanitizes non-finite and non-positive sides to 0", () => {
    configurePopupInsets({ top: Number.NaN, right: -5, bottom: 12, left: 0 });
    expect(popupInsets()).toEqual({ top: 0, right: 0, bottom: 12, left: 0 });
  });

  it("mirrors the band onto :root variables, zeroes included", () => {
    configurePopupInsets({ top: 32 });
    expect(document.documentElement.style.getPropertyValue(POPUP_INSET_VARS.top)).toBe("32px");
    expect(document.documentElement.style.getPropertyValue(POPUP_INSET_VARS.left)).toBe("0px");
    // Re-configure rewrites every side, so a dropped side cannot keep a
    // stale larger value.
    configurePopupInsets({ left: 64 });
    expect(document.documentElement.style.getPropertyValue(POPUP_INSET_VARS.top)).toBe("0px");
    expect(document.documentElement.style.getPropertyValue(POPUP_INSET_VARS.left)).toBe("64px");
  });

  it("collapses the frame when the band overruns the window", () => {
    window.innerWidth = 800;
    window.innerHeight = 600;
    configurePopupInsets({ top: 500, bottom: 500 });
    expect(popupViewportRect()).toEqual({ x: 0, y: 500, width: 800, height: 0 });
    configurePopupInsets({ left: 900 });
    expect(popupViewportRect()).toEqual({ x: 800, y: 0, width: 0, height: 600 });
  });

  it("reports its live band and frame to the runtime registry", () => {
    window.innerWidth = 1280;
    window.innerHeight = 800;
    configurePopupInsets({ top: 32 });
    expect(readHkRuntime("popupBounds")).toEqual({
      insets: { top: 32, right: 0, bottom: 0, left: 0 },
      viewport: { x: 0, y: 32, width: 1280, height: 768 },
    });
    // The write facet rides the same registry entry — exercise it through
    // writeHkRuntime so the op contract stays honest.
    expect(writeHkRuntime("popupBounds", { type: "configure", insets: { top: 8 } })).toBe(true);
    expect(readHkRuntime("popupBounds")).toMatchObject({
      insets: { top: 8, right: 0, bottom: 0, left: 0 },
    });
    expect(writeHkRuntime("popupBounds", { type: "nonsense" })).toBe(false);
  });
});
