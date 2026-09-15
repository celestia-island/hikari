/**
 * Source contract for the sheet family's morph-performance grammar
 * (2026-09-15 chest mobile report: bottom sheets — model dialog, select
 * sheets, drawers — flickered in patches while their height changed;
 * a phone's raster of a backdrop-filtered fixed layer lags the layer's
 * animated geometry, and an animated `height` relaid out the sheet
 * subtree every frame on the same main thread that was streaming the
 * page behind).
 *
 * The family answer, pinned here so a refactor cannot silently regress:
 *   - growth morphs REVEAL through clip-path (--hk-sheet-morph: clip on
 *     the docking surfaces, useSizeMorph does the pin-instantly +
 *     sweep-up dance) — paint/compositor-level, zero per-frame layout;
 *     the frame stylesheet carries the clip-path transition on the SAME
 *     duration/ease tokens as the height transition, so the stretch look
 *     and its reduced-motion / data-css-animations governance are intact
 *   - docked phone surfaces NEVER backdrop-filter (mobile-guard tokens
 *     defaulting to none: --hk-modal-blur-mobile, --hk-modal-overlay-
 *     blur-mobile, --hk-drawer-blur-mobile, --hk-drawer-overlay-blur-
 *     mobile, --hk-popover-blur-mobile) — the scrim's dim reads alone
 *   - docking surfaces carry `contain: layout style` so the streaming
 *     page behind and the sheet subtree stop invalidating into each
 *     other
 *
 * The JS half of the contract (pin instantly, sweep from the old edge,
 * clear on transitionend / new dance / stop) lives in
 * composables/useSizeMorph.test.ts.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string): string => readFileSync(join(here, name), "utf-8");
const modal = read("HkModal.scss");
const select = read("HkSelect.scss");
const drawer = read("HkDrawer.scss");
const popover = read("HkPopover.scss");

describe("sheet family morph-performance contract", () => {
  let mobileModal = "";
  beforeAll(() => {
    mobileModal = modal.slice(modal.indexOf("@media (max-width: 767px)"));
  });

  it("flags the docked modal sheet for clip-mode growth morphs", () => {
    expect(mobileModal).toContain("--hk-sheet-morph: clip");
  });

  it("carries a clip-path transition on the morph timing tokens", () => {
    // Same duration/ease pair as the height morph — the reveal must keep
    // the stretch look, not invent new timing.
    const frame = modal.match(/\.hk-modal-content\s*{[^}]*}/)?.[0] ?? "";
    expect(frame).toContain(
      "clip-path var(--duration-fast, 0.15s) var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1))",
    );
  });

  it("never backdrop-filters the docked modal sheet or its scrim", () => {
    expect(mobileModal).toContain("--hk-modal-blur-mobile, none");
    expect(mobileModal).toContain("--hk-modal-overlay-blur-mobile, none");
  });

  it("scopes the docked modal sheet with layout containment", () => {
    expect(mobileModal).toContain("contain: layout style");
  });

  it("applies the same grammar to the select sheet panel", () => {
    const panel = select.match(/\.hk-select-sheet-panel\s*{[\s\S]*?^}/m)?.[0] ?? "";
    expect(panel).toContain("--hk-sheet-morph: clip");
    expect(panel).toContain("contain: layout style");
    expect(panel).toContain(
      "clip-path var(--duration-fast, 0.15s) var(--ease-standard, cubic-bezier(0.4, 0, 0.2, 1))",
    );
    // Opaque already — the panel must not regress to a translucent
    // finish that re-composites against the streaming page.
    expect(panel).toContain("background: rgb(var(--color-surface))");
  });

  it("token-gates the drawer panel blur and guards it on phones", () => {
    // Desktop keeps its finish through the token; the hard-coded blur
    // must not return (it escaped the mobile guard entirely).
    const panel = drawer.match(/\.hk-drawer-panel\s*{[^}]*}/)?.[0] ?? "";
    expect(panel).toContain("backdrop-filter: var(--hk-drawer-blur, blur(12px))");
    expect(panel).toContain("contain: layout style");

    const mobile = drawer.slice(drawer.indexOf("@media (max-width: 767px)"));
    expect(mobile).toContain("--hk-drawer-blur-mobile, none");
    expect(mobile).toContain("--hk-drawer-overlay-blur-mobile, none");
  });

  it("keeps the drawer's mobile rules in ONE media block", () => {
    // HkDrawer.sheetfamily.test.ts slices the source from the FIRST
    // max-width: 767px block and regex-matches rules after it — where
    // that first block sits decides which rules its slice can even see
    // (a guard block placed before the .hk-drawer-bottom base rule once
    // redirected the family match to the base rule and reddened the
    // contract). One block, one concern: the mobile guards live inside
    // the family block, and no second block may wander in.
    expect(drawer.match(/@media \(max-width: 767px\)/g)).toHaveLength(1);
  });

  it("guards the popover sheet variant the same way", () => {
    const sheet = popover.match(/\.hk-popover-panel\.hk-is-sheet\s*{[\s\S]*?^}/m)?.[0] ?? "";
    expect(sheet).toContain("--hk-popover-blur-mobile, none");
    expect(sheet).toContain("contain: layout style");
  });
});
