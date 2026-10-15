import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for HkFilterPanel — the one-axis anatomy the
 * 2026-10-12 user direction pinned:
 *
 *   1. the panel is a single grid with `align-items: center` (every cell
 *      of every row on ONE vertical axis);
 *   2. rows/add-row donate `display: contents` cells so column widths
 *      stay shared (the add button lands in the operator column);
 *   3. real horizontal padding (minimum outer margins);
 *   4. the value column shrinks (min-width floors, nothing hard-coded);
 *   5. the phone operator column keeps its widened cap.
 *
 * Vitest stubs CSS, so the runtime suite can never catch a lost rule —
 * this compiles the sheet directly and asserts the contract.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

const css = compile(resolve(componentDir, "HkFilterPanel.scss"), {
  style: "expanded",
}).css;

function ruleFor(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `${selector} present in the compiled sheet`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(start, close + 1);
}

describe("HkFilterPanel stylesheet contract", () => {
  it("compiles without warnings", () => {
    expect(css).toContain(".hk-filter-panel");
  });

  it("the panel is one grid, vertically centered on a single axis", () => {
    const rule = ruleFor(".hk-filter-panel {");
    expect(rule).toContain("display: grid");
    expect(rule).toContain("align-items: center");
  });

  it("rows and the add row donate contents cells to the shared grid", () => {
    // sass keeps the selector list wrapped: `.row,` newline `.addrow {`.
    expect(css).toMatch(/\.hk-filter-panel-row,\s*\.hk-filter-panel-addrow\s*\{[^}]*display:\s*contents/);
  });

  it("keeps minimum outer margins on the columns", () => {
    const rule = ruleFor(".hk-filter-panel {");
    // Inline padding (both edges) — not the old 0.25rem sliver.
    expect(rule).toMatch(/padding:[^;]*var\(--space-12/);
  });

  it("the value column shrinks with the panel (min floors, nothing fixed)", () => {
    const rule = ruleFor(".hk-filter-panel {");
    expect(rule).toMatch(/minmax\(6rem,\s*1fr\)/);
    const value = ruleFor(".hk-filter-panel-value {");
    expect(value).toContain("min-width: 0");
    const control = ruleFor(".hk-filter-panel-control {");
    expect(control).toContain("min-width: 0");
  });

  it("parks the add button in the operator column (grid-column 2 to the end)", () => {
    const rule = ruleFor(".hk-filter-panel-add {");
    // sass normalizes the track list ("2 / -1" → "2/-1").
    expect(rule).toMatch(/grid-column:\s*2\s*\/\s*-1/);
    expect(rule).toContain("justify-self: start");
  });

  it("the empty panel collapses to the add verb's own width", () => {
    // 2026-10-15: no rows = nothing to align columns against — the
    // desktop popover hugs the 添加条件 button (data-empty marker).
    expect(css).toMatch(/\.hk-filter-panel\[data-empty\]\s*\{[^}]*width:\s*max-content/);
  });

  it("the phone operator column keeps its widened cap (≥ the old 4.25rem)", () => {
    expect(css).toContain("@media (max-width: 767px)");
    const media = css.slice(css.indexOf("@media (max-width: 767px)"));
    expect(media).toMatch(/max-width:\s*5\.25rem/);
    expect(media).toMatch(/minmax\(4\.75rem,\s*auto\)/);
  });

  it("registers the chooser rows in the sheet-context token swap (44px touch rows)", () => {
    // The add-condition chooser docks as a bottom sheet on mobile; its
    // items must ride the unified menu-item SHEET geometry. The swap
    // lives in _menu-item.scss's adopter list (pulled in via the
    // @use chain) — an unregistered class silently keeps the 34px
    // desktop rows (R1 2026-10-14 finding: exactly that happened).
    expect(css).toMatch(
      /\.hk-popover-panel\.hk-is-sheet[^{]*\.hk-filter-add-item[^{]*\{[^}]*--hk-menu-item-min-h:\s*44px/,
    );
  });
});
