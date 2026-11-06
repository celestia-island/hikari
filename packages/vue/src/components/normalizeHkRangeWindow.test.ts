import { describe, expect, it } from "vitest";

import { normalizeHkRangeWindow } from "./HkRangeRibbon";

/**
 * Public contract of `normalizeHkRangeWindow` — the ONE normalizer the
 * ribbon and its hosts share.
 *
 * Motivation: chest's trace model mirrored this algorithm line-by-line
 * (including the 0.02 minimum) to filter its rows with the same window. A
 * mirror like that only has prose pins, so an upstream algorithm/default
 * change forks the host silently. These pins are the function's contract —
 * exact tuples, not "close enough" — because hosts bake these numbers into
 * their own filters.
 */
/** Window endpoints at double precision + the contract invariants exactly
 *  (ordered, in-domain, at least `minWidth` wide). The endpoints of an
 *  expanded window are arithmetic results (e.g. 0.5 - 0.7/2), so pinning the
 *  17th significant digit would test IEEE-754, not the contract. */
function expectWindow(
  actual: [number, number] | null,
  expected: [number, number],
  minWidth = 0.02,
): void {
  expect(actual, "a window is returned").not.toBeNull();
  expect(actual![0], "start").toBeCloseTo(expected[0], 12);
  expect(actual![1], "end").toBeCloseTo(expected[1], 12);
  expect(actual![0], "ordered").toBeLessThan(actual![1]);
  expect(actual![0], "clamped to the domain").toBeGreaterThanOrEqual(0);
  expect(actual![1], "clamped to the domain").toBeLessThanOrEqual(1);
  expect(actual![1] - actual![0], "never narrower than minWidth").toBeGreaterThanOrEqual(
    minWidth - 1e-12,
  );
}

describe("normalizeHkRangeWindow", () => {
  it("returns null for anything that is not a usable window", () => {
    expect(normalizeHkRangeWindow(null)).toBeNull();
    expect(normalizeHkRangeWindow(undefined)).toBeNull();
    // Not an array / not a pair / not finite: all mean "no window".
    expect(normalizeHkRangeWindow(0.5)).toBeNull();
    expect(normalizeHkRangeWindow("0.2,0.4")).toBeNull();
    expect(normalizeHkRangeWindow([])).toBeNull();
    expect(normalizeHkRangeWindow([0.2])).toBeNull();
    expect(normalizeHkRangeWindow([Number.NaN, 0.5])).toBeNull();
    expect(normalizeHkRangeWindow([0.2, Number.POSITIVE_INFINITY])).toBeNull();
  });

  it("orders inverted windows and clamps them to the domain", () => {
    expectWindow(normalizeHkRangeWindow([0.7, 0.3]), [0.3, 0.7]);
    // Both members beyond the end: collapsed to the trailing minimum.
    expectWindow(normalizeHkRangeWindow([1.2, 1.5]), [0.98, 1]);
    // Both members before the start: collapsed to the leading minimum.
    expectWindow(normalizeHkRangeWindow([-0.5, -0.2]), [0, 0.02]);
  });

  it("expands a degenerate window to the default minimum (0.02)", () => {
    expectWindow(normalizeHkRangeWindow([0.5, 0.5]), [0.49, 0.51]);
    // Exactly the minimum width is left alone — no gratuitous expansion.
    expectWindow(normalizeHkRangeWindow([0.49, 0.51]), [0.49, 0.51]);
  });

  it("honours a custom minWidth", () => {
    expectWindow(normalizeHkRangeWindow([0.5, 0.5], 0.2), [0.4, 0.6], 0.2);
    expectWindow(normalizeHkRangeWindow([0.5, 0.5], 0.7), [0.15, 0.85], 0.7);
  });

  it("falls back to the default for an unusable minWidth", () => {
    for (const minWidth of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectWindow(normalizeHkRangeWindow([0.5, 0.5], minWidth), [0.49, 0.51]);
    }
  });
});
