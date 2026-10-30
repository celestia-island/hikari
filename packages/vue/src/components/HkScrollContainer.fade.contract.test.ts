/**
 * Source contract for the scroll-container edge fades (the 2026-10
 * revision): each edge owns a CSS var and the viewport mask INTERSECTS a
 * vertical and a horizontal gradient, so a two-axis container fades on all
 * four sides and the corners fall off naturally.
 *
 * The regression this pins (user report: "the light effect is clipped at
 * the two sides"): the old sheet wrote ONE `mask-image` per axis, so the
 * last matching rule won, the other axis never faded, and its band ended in
 * a hard cut. Vertical fades were missing entirely. Hence:
 *   - exactly ONE mask declaration pair lives in the sheet (the composed
 *     block on the viewport) — a new per-axis `mask-image` rule is drift;
 *   - all four edge vars are declared (top/right/bottom/left, 0px base);
 *   - start/end/both rules exist for BOTH axes;
 *   - RTL swaps the horizontal vars instead of rewriting the mask.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sheet = readFileSync(join(here, "HkScrollContainer.scss"), "utf-8");

describe("scroll fade composition contract", () => {
  it("declares one composed mask on the viewport (no per-axis overrides)", () => {
    const declarations = sheet.match(/^\s*-?(?:webkit-)?mask-image:/gm) ?? [];
    // Exactly THREE pairs live in the sheet, all accounted for: the
    // composed two-axis block on the viewport, and one feather pair per
    // selection-hint painter (the 2026-10-30 inline falloff). Anything
    // else is per-axis mask drift.
    expect(declarations.length).toBe(6);
    expect(sheet).toContain("mask-composite: intersect");
    expect(sheet).toContain("-webkit-mask-composite: source-in");
  });

  it("declares the four edge vars with zero defaults", () => {
    for (const edge of ["top", "right", "bottom", "left"]) {
      expect(sheet).toContain(`--hk-scroll-fade-${edge}: 0px;`);
    }
  });

  it("fades both axes from the sensed overflow", () => {
    for (const axis of ["v", "h"]) {
      for (const state of ["start", "end", "both"]) {
        expect(sheet).toContain(
          `[data-${axis}-overflow="${state}"]`,
        );
      }
    }
    // The vertical half is what the old sheet was missing entirely.
    expect(sheet).toContain('--hk-scroll-fade-top: var(--hk-scroll-fade-size)');
    expect(sheet).toContain('--hk-scroll-fade-bottom: var(--hk-scroll-fade-size)');
  });

  it("swaps horizontal sides under RTL instead of rewriting the mask", () => {
    expect(sheet).toContain(
      '[dir="rtl"] .hk-scroll-container[data-fade="true"][data-h-overflow="start"]',
    );
    expect(sheet).toContain(
      '[dir="rtl"] .hk-scroll-container[data-fade="true"][data-h-overflow="end"]',
    );
  });

  it("routes the dock fades through the same edge vars", () => {
    expect(sheet).toContain('--hk-scroll-fade-bottom: var(--hk-scroll-dock-fade, 2rem)');
    expect(sheet).toContain('--hk-scroll-fade-top: var(--hk-scroll-dock-fade, 2rem)');
  });
});
