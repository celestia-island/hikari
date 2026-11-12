// Contract tests for the app-chrome popup bounds context.
//
// AI disclosure: drafted by GLM via the ZCode agent, directed and
// reviewed by langyo — SySL-1.0 §2.3.
import { afterEach, describe, expect, it, vi } from "vitest";

import { readHkRuntime, writeHkRuntime } from "./registry";
import { CHROME_OWNER_ATTR } from "./windowChrome";
import {
  configurePopupInsets,
  popupInsets,
  popupViewportRect,
  POPUP_INSET_VARS,
} from "./popupBounds";

const PREV_INNER = { width: window.innerWidth, height: window.innerHeight };

afterEach(() => {
  configurePopupInsets(null);
  document.documentElement.removeAttribute(CHROME_OWNER_ATTR);
  document.documentElement.style.removeProperty("--hk-chrome-band-inset");
  vi.restoreAllMocks();
  window.innerWidth = PREV_INNER.width;
  window.innerHeight = PREV_INNER.height;
});

/** Declare a claimed native shell whose caption band measures bandInset. */
function claimBand(bandInset: string): void {
  document.documentElement.setAttribute(CHROME_OWNER_ATTR, "app");
  document.documentElement.style.setProperty("--hk-chrome-band-inset", bandInset);
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    getPropertyValue: (name: string) =>
      name === "--hk-chrome-band-inset" ? bandInset : "",
  } as unknown as CSSStyleDeclaration);
}

describe("popupBounds chrome-band floor", () => {
  it("floors the frame below the caption band plus the minimum gap", () => {
    window.innerWidth = 1280;
    window.innerHeight = 800;
    claimBand("48px");
    // 48px band + the 4px minimum gap: popups occupy y >= 52 without any
    // explicit configuration.
    expect(popupViewportRect()).toEqual({ x: 0, y: 52, width: 1280, height: 748 });
  });

  it("lets a larger configured top inset win over the band floor", () => {
    window.innerWidth = 1280;
    window.innerHeight = 800;
    claimBand("48px");
    configurePopupInsets({ top: 80 });
    expect(popupViewportRect().y).toBe(80);
    // ...and a smaller one loses to the floor (max, not override).
    configurePopupInsets({ top: 10 });
    expect(popupViewportRect().y).toBe(52);
  });

  it("ignores the token without the chrome claim (browser faces)", () => {
    window.innerWidth = 1280;
    window.innerHeight = 800;
    // The var is declared but nobody claimed the chrome — a browser face
    // must keep the byte-identical raw-window frame.
    document.documentElement.style.setProperty("--hk-chrome-band-inset", "48px");
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) =>
        name === "--hk-chrome-band-inset" ? "48px" : "",
    } as unknown as CSSStyleDeclaration);
    expect(popupViewportRect()).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
  });

  it("degrades a zero or unreadable token to no floor", () => {
    window.innerWidth = 1280;
    window.innerHeight = 800;
    claimBand("0px");
    configurePopupInsets({ top: 12 });
    expect(popupViewportRect().y).toBe(12);
  });
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
