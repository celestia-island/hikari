/**
 * Source contract for the popover sheet docking (2026-08-30 user
 * report: the theme toggle's bottom-up sheet didn't read as part of
 * the standard sheet family). HkPopover's sheetOnMobile mode must dock
 * with the SAME host-tunable --hk-sheet-bottom-gap as the HkModal and
 * HkSelectPanel dockings, and keep its content clear of the home bar
 * via the safe-area inset. The inline style used to pin hard
 * `bottom: "0"`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tsx = readFileSync(join(here, "HkPopover.tsx"), "utf-8");
const scss = readFileSync(join(here, "HkPopover.scss"), "utf-8");

describe("HkPopover mobile sheet docking contract", () => {
  it("docks the sheet above the shared bottom gap (inline sheet style)", () => {
    const block = tsx.slice(tsx.indexOf("panelStyle"));
    expect(block).toContain("var(--hk-sheet-bottom-gap");
    // Same default as the HkModal sheet contract.
    expect(block).toMatch(/--hk-sheet-bottom-gap,\s*0\.375rem/);
  });

  it("keeps sheet content clear of the home bar via the safe-area inset", () => {
    const block = scss.match(/\.hk-popover-panel\.hk-is-sheet\s*{[^}]*}/)?.[0] ?? "";
    // Stacked on the family 12px base so the glass dropdown chrome's
    // bottom padding survives on non-notched phones too.
    expect(block).toContain("calc(var(--space-12");
    expect(block).toContain("env(safe-area-inset-bottom");
  });
});
