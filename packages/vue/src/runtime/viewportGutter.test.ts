import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DESKTOP_GUTTER_PX,
  MOBILE_GUTTER_PX,
  VIEWPORT_GUTTER_VAR,
  clampWithGutter,
  viewportGutterPx,
} from "./viewportGutter";

const here = dirname(fileURLToPath(import.meta.url));
const scaleSrc = readFileSync(join(here, "../scale.scss"), "utf-8");
const vendoredSrc = readFileSync(join(here, "../styles/theme/scale.scss"), "utf-8");

const PREV_INNER_WIDTH = window.innerWidth;

afterEach(() => {
  window.innerWidth = PREV_INNER_WIDTH;
  vi.restoreAllMocks();
});

/** Force the :root computed style to answer `value` for the gutter var. */
function stubRootVar(value: string) {
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(((el: Element) => {
    if (el === document.documentElement) {
      return {
        getPropertyValue: (name: string) => (name === VIEWPORT_GUTTER_VAR ? value : ""),
      } as unknown as CSSStyleDeclaration;
    }
    return original(el);
  }) as typeof window.getComputedStyle);
}

describe("viewportGutterPx", () => {
  it("reads a positive px token off :root verbatim", () => {
    stubRootVar("20px");
    expect(viewportGutterPx()).toBe(20);
  });

  it("ignores non-px, garbage and non-positive token values", () => {
    // A var() can reach the reader unresolved ("1rem" parseFloats to 1)
    // and a garbage value must never SHRINK the gutter — all fall back.
    for (const bad of ["", "  ", "bogus", "1rem", "0px", "-4px", "16"]) {
      stubRootVar(bad);
      expect(viewportGutterPx(), `token ${JSON.stringify(bad)}`).toBe(
        PREV_INNER_WIDTH < 768 ? MOBILE_GUTTER_PX : DESKTOP_GUTTER_PX,
      );
    }
  });

  it("falls back by breakpoint without a token: 8px mobile / 16px desktop", () => {
    window.innerWidth = 375;
    expect(viewportGutterPx()).toBe(MOBILE_GUTTER_PX);
    window.innerWidth = 767;
    expect(viewportGutterPx()).toBe(MOBILE_GUTTER_PX);
    window.innerWidth = 768;
    expect(viewportGutterPx()).toBe(DESKTOP_GUTTER_PX);
    window.innerWidth = 1280;
    expect(viewportGutterPx()).toBe(DESKTOP_GUTTER_PX);
  });

  it("keeps the token and the breakpoint fallback numerically in sync", () => {
    // The media query in scale.scss writes the same numbers this module
    // falls back to — the contract that lets CSS caps and JS clamps
    // never drift.
    expect(scaleSrc).toContain(`${VIEWPORT_GUTTER_VAR}: ${DESKTOP_GUTTER_PX}px;`);
    const media = scaleSrc.match(
      new RegExp(`@media \\(max-width: 767px\\)\\s*{\\s*:root\\s*{[^}]*${VIEWPORT_GUTTER_VAR}: ${MOBILE_GUTTER_PX}px;`),
    );
    expect(media, "mobile media override in scale.scss").not.toBeNull();
  });

  it("ships the token in the vendored scale sheet too", () => {
    // vendoredSync.test.ts enforces byte-level sync; this pins the
    // semantic (a host loading only the composed sheets still gets the
    // token the JS reader looks for).
    expect(vendoredSrc).toContain(`${VIEWPORT_GUTTER_VAR}: ${DESKTOP_GUTTER_PX}px;`);
  });
});

describe("clampWithGutter", () => {
  it("keeps a fitting box untouched", () => {
    expect(clampWithGutter(100, 200, 1200, 16)).toBe(100);
  });

  it("pins an overflowing box to the far gutter", () => {
    expect(clampWithGutter(1100, 200, 1200, 16)).toBe(984);
    expect(clampWithGutter(-70, 180, 1200, 16)).toBe(16);
  });

  it("collapses to the gutter when the box cannot fit at all", () => {
    expect(clampWithGutter(50, 5000, 1200, 16)).toBe(16);
  });
});
