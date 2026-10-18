import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Side-drawer motion contract (2026-10-19 phone recording).
 *
 * The left/right drawer used to share the scrim's opacity fade: at
 * halfway through the close the panel was still on screen but its right
 * half was transparent, so the page behind showed through and the right
 * rounded corners dissolved — it read as a width shrink. Side drawers
 * must slide as an opaque surface (transform only); the scrim keeps its
 * own fade, and top/bottom sheets keep the fade.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkDrawer.scss"), "utf-8");

// The side-drawer overrides sit after the generic blocks and before the
// reduced-motion block (which also lists the active classes with
// `transition: none`, so the full-file last occurrence would find that).
const sideStart = src.indexOf("/* Side drawers slide as an OPAQUE surface.");
const reduceStart = src.indexOf("@media (prefers-reduced-motion: reduce)");
const side = src.slice(sideStart, reduceStart);

/** Body of the LAST rule for a selector — the side overrides are declared
 *  after the generic four-direction blocks. */
function lastRule(selector: string, from = src): string {
  const at = from.lastIndexOf(selector);
  expect(at, `${selector} exists`).toBeGreaterThanOrEqual(0);
  const open = from.indexOf("{", at);
  const close = from.indexOf("}", open);
  return from.slice(open + 1, close);
}

describe("HkDrawer side motion (opaque slide)", () => {
  it("does not fade the left/right panel out", () => {
    for (const sel of [
      ".hk-drawer-left-enter-active",
      ".hk-drawer-left-leave-active",
      ".hk-drawer-right-enter-active",
      ".hk-drawer-right-leave-active",
    ]) {
      const rule = lastRule(sel, side);
      expect(rule, sel).toContain("transform");
      expect(rule, sel).not.toContain("opacity");
    }
    for (const sel of [
      ".hk-drawer-left-enter-from",
      ".hk-drawer-left-leave-to",
      ".hk-drawer-right-enter-from",
      ".hk-drawer-right-leave-to",
    ]) {
      expect(lastRule(sel, side), sel).toContain("opacity: 1");
    }
  });

  it("keeps the fade for top/bottom sheets", () => {
    expect(lastRule(".hk-drawer-top-enter-from")).toContain("opacity: 0");
    expect(lastRule(".hk-drawer-bottom-enter-from")).toContain("opacity: 0");
  });
});
