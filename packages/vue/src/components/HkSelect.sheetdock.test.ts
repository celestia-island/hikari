/**
 * Source contract for the dropdown sheet docking (2026-08-30 user
 * report: the localized input's language menu sheet "didn't look like
 * it came from the standard modal"). The HkSelectPanel sheet — the
 * shared surface under HkSelect / HkMenu / HkPopupSelect — must dock
 * with the SAME host-tunable bottom gap and home-bar safe-area padding
 * as the HkModal mobile docking, so every bottom-up window belongs to
 * one visual family. It used to be glued to `bottom: 0`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkSelect.scss"), "utf-8");

describe("HkSelectPanel mobile sheet docking contract", () => {
  it("docks the sheet on the --hk-sheet-bottom-gap hook (flush family default)", () => {
    const block = src.match(/\.hk-select-sheet-panel\s*{[^}]*}/)?.[0] ?? "";
    expect(block).toContain("bottom: var(--hk-sheet-bottom-gap");
    // Family default sits flush on the bottom edge (2026-09-04 user
    // report: the 0.375rem family default read as a seam); hosts may
    // re-add a gap via the same custom property.
    expect(block).toMatch(/--hk-sheet-bottom-gap,\s*0px/);
  });

  it("stacks the safe-area inset on the sheet list bottom padding", () => {
    const block = src.match(/\.hk-select-sheet-list\s*{[^}]*}/)?.[0] ?? "";
    expect(block).toContain("env(safe-area-inset-bottom");
  });
});
