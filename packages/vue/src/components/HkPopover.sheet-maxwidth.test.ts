/**
 * Source contract for the popover sheet viewport width (2026-09-08 user
 * report: the mobile bottom sheets showed a mysterious right-hand gap —
 * the sheet docked flush left but stopped 16px short of the right
 * viewport edge, on every popover-family sheet and never on the HkModal
 * / HkSelectPanel sheets, hence "some have it, some don't").
 *
 * Root cause: the base `.hk-popover-panel` rule sets
 * `max-width: calc(100vw - 2 * 8px)` (the anchored panel's
 * anti-ratchet clamp, #421). The mobile sheet branch overrides
 * `width: auto` but inherited the max-width, over-constraining the
 * inline `left: 0; right: 0` docking — the used width resolved to
 * 100vw - 16px and LTR dropped the `right` constraint. Pinned here so
 * a refactor cannot silently reintroduce the leak.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkPopover.scss"), "utf-8");

describe("HkPopover sheet viewport width contract", () => {
  let block = "";
  beforeAll(() => {
    block = scss.match(/\.hk-popover-panel\.hk-is-sheet\s*{[\s\S]*?^\}/m)?.[0] ?? "";
  });

  it("neutralizes the base max-width clamp inside the sheet block", () => {
    expect(block).toContain("max-width: none;");
  });

  it("keeps the sheet width content-independent (width: auto)", () => {
    expect(block).toContain("width: auto;");
  });

  it("declares max-width: none after the width override (ordering sanity)", () => {
    expect(block.indexOf("max-width: none")).toBeGreaterThan(block.indexOf("width: auto"));
  });
});
