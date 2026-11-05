/**
 * Source contract for the HkCalendarHeatmap weekday rail geometry
 * (2026-11-05 user report from the chest quota card: the Monday/Sunday
 * labels sat one marker strip too high, and a hard-coded surface fill
 * painted a visible stripe behind them).
 *
 * jsdom does no layout, so the row alignment itself cannot be asserted
 * here; these pins hold the two sheet decisions the fix rests on:
 *
 * 1. `align-self: flex-end` — the -cells box is one marker strip taller
 *    than the grid (the month labels ride above it); a stretched rail
 *    starts its seven rows on the markers. The rail's natural height
 *    (7 cells + 6 gaps) equals the grid's exactly, so end-alignment is
 *    row-exact. This also assumes the grid stays the LAST child of
 *    -cells with no trailing padding — the third pin below.
 * 2. no sticky mask — a hard-coded surface can't match every host
 *    card, and sticky without a mask lets cells slide beneath the
 *    labels during horizontal scroll. The rail scrolls with the
 *    calendar (the GitHub convention).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sheet = readFileSync(join(here, "HkCalendarHeatmap.scss"), "utf-8");

// The `&-rail` rule up to its closing brace (two-space indent inside
// the `.hk-calendar-heatmap` block) — keeps the assertions scoped to
// the rail (a background elsewhere in the sheet is legitimate).
const rail = sheet.match(/&-rail \{[\s\S]*?\n  \}/)?.[0] ?? "";
// Same for `-cells`, whose last-child geometry the alignment relies on.
const cells = sheet.match(/&-cells \{[\s\S]*?\n  \}/)?.[0] ?? "";

describe("HkCalendarHeatmap weekday rail contract", () => {
  it("extracts the rail rule from the sheet", () => {
    expect(rail, "the &-rail rule must exist").toContain("&-rail {");
  });

  it("bottom-aligns the rail with the grid, not the markers row", () => {
    expect(rail, "rail must carry align-self: flex-end").toContain(
      "align-self: flex-end",
    );
  });

  it("carries no sticky mask (no hard-coded surface fill)", () => {
    expect(rail, "rail must not paint a hard-coded surface").not.toContain(
      "background:",
    );
    expect(rail, "rail must not go sticky").not.toContain("position: sticky");
    expect(rail, "sticky's scroll pin has no business left behind").not.toContain(
      "z-index",
    );
  });

  it("keeps the grid the flush last child of -cells", () => {
    expect(cells, "the &-cells rule must exist").toContain("&-cells {");
    expect(cells, "trailing padding would break the end-alignment").not.toContain(
      "padding",
    );
  });
});
