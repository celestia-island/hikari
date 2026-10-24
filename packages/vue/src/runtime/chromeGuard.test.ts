import { describe, expect, it } from "vitest";

import { chromeGuard, popChromeGuard, pushChromeGuard } from "./chromeGuard";

/**
 * chromeGuard accounting tests — the counter and the allowlist union
 * are shared module state, so every case cleans up after itself (each
 * `it` leaves the guard at depth 0) and the suite runs sequentially.
 */
describe("chromeGuard", () => {
  it("starts inactive with an empty keep set", () => {
    expect(chromeGuard.active.value).toBe(false);
    expect(chromeGuard.keep.value.size).toBe(0);
  });

  it("counts stacked windows and only deactivates at the last pop", () => {
    pushChromeGuard(["a"]);
    pushChromeGuard(["b"]);
    expect(chromeGuard.active.value).toBe(true);

    popChromeGuard(["b"]);
    expect(chromeGuard.active.value).toBe(true);

    popChromeGuard(["a"]);
    expect(chromeGuard.active.value).toBe(false);
  });

  it("publishes the union of the live windows' keep lists", () => {
    pushChromeGuard(["gear", "help"]);
    pushChromeGuard(["gear", "bell"]);

    expect(chromeGuard.keep.value.has("gear")).toBe(true);
    expect(chromeGuard.keep.value.has("help")).toBe(true);
    expect(chromeGuard.keep.value.has("bell")).toBe(true);

    popChromeGuard(["gear", "bell"]);
    // The closed window's ids leave the union the moment it pops.
    expect(chromeGuard.keep.value.has("bell")).toBe(false);
    expect(chromeGuard.keep.value.has("gear")).toBe(true);
    expect(chromeGuard.keep.value.has("help")).toBe(true);

    popChromeGuard(["gear", "help"]);
    expect(chromeGuard.keep.value.size).toBe(0);
  });

  it("accepts windows that keep nothing", () => {
    pushChromeGuard();
    expect(chromeGuard.active.value).toBe(true);
    expect(chromeGuard.keep.value.size).toBe(0);
    popChromeGuard();
    expect(chromeGuard.active.value).toBe(false);
  });

  it("pops the matching list, not just the newest push", () => {
    pushChromeGuard(["one"]);
    pushChromeGuard(["two"]);

    popChromeGuard(["one"]);
    expect(chromeGuard.active.value).toBe(true);
    // "one" left the union with its own pop even though "two" pushed last.
    expect(chromeGuard.keep.value.has("one")).toBe(false);
    expect(chromeGuard.keep.value.has("two")).toBe(true);

    popChromeGuard(["two"]);
    expect(chromeGuard.active.value).toBe(false);
  });

  it("floors at zero on an unmatched pop instead of corrupting state", () => {
    pushChromeGuard(["x"]);
    popChromeGuard(["never-pushed"]);
    // The live list survives the bogus pop; the counter floors at zero
    // only after the real pop.
    expect(chromeGuard.keep.value.has("x")).toBe(true);
    popChromeGuard(["x"]);
    expect(chromeGuard.active.value).toBe(false);
    expect(chromeGuard.keep.value.size).toBe(0);
  });
});
