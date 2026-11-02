/**
 * Source contract for the scroll-container edge fades (the 2026-11-02
 * revision of the 2026-10 composition): each edge owns a CSS var, the
 * viewport mask is built from the gradient LAYERS listed in
 * --hk-scroll-fade-layers, and the axis rules swap that list —
 *
 *   - two-axis containers list the vertical AND horizontal gradients and
 *     intersect them, so the fade reaches zero on all four sides and the
 *     corners fall off naturally;
 *   - single-axis containers list ONE gradient on their scroll axis:
 *     a composed mask needs `mask-composite`, and engines without the
 *     standard property (Android WebViews below Chromium 120 — Tauri on
 *     Android rides the system WebView) fall back to the default ADD
 *     composition, whose union of two opaque layers is fully opaque —
 *     the fade vanished and the band ended in a hard cut at the screen
 *     edge (wowsp phone report 2026-11-02: the settings tab strip sliced
 *     its last pill mid-glyph). One layer needs no composite anywhere.
 *
 * The earlier regression this still pins (user report: "the light effect
 * is clipped at the two sides"): the pre-2026-10 sheet wrote ONE
 * `mask-image` per axis in competing cascade, so the last rule won, the
 * other axis never faded. The axis rules now swap a VAR, never the
 * property — the property pair is declared exactly once. Hence:
 *   - exactly ONE mask declaration pair lives in the sheet (the base
 *     block on the viewport) — a new per-axis `mask-image` rule is drift;
 *   - the single-axis axis rules set --hk-scroll-fade-layers to a single
 *     gradient and touch no mask property;
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
  it("declares one mask property pair on the viewport (no per-axis overrides)", () => {
    // Feature 2026-10-31: a `mask-image` is authored as
    // `@include mask-image(...)` (styles/polyfill.scss), so the include —
    // not the raw declaration — is what a sheet may carry. The mixin
    // itself owns the -webkit-/standard pair.
    const declarations = sheet.match(/^\s*@include mask-image\(/gm) ?? [];
    // Exactly THREE pairs live in the sheet, all accounted for: the base
    // block on the viewport (fed by --hk-scroll-fade-layers), and one
    // feather pair per selection-hint painter (the 2026-10-30 inline
    // falloff). Anything else is per-axis mask drift — the axis rules
    // must swap the VAR, never re-declare the property (the 2026-10
    // competing-cascade regression).
    expect(declarations.length, "one include per mask pair, no per-axis drift").toBe(3);
    expect(sheet).not.toMatch(/^\s*-webkit-mask-image:/m);
    // The composed default (two layers, four edges) still goes through
    // mask-composite — that pair belongs to the base rule only.
    expect(sheet).toContain("mask-composite: intersect");
    expect(sheet).toContain("-webkit-mask-composite: source-in");
  });

  it("declares the layer list and swaps it per axis to a single gradient", () => {
    // The base rule lists BOTH gradients (the four-edge composition) in
    // one var the mask property consumes.
    expect(sheet).toMatch(/--hk-scroll-fade-layers:[\s\S]*linear-gradient\([\s\S]*to bottom[\s\S]*linear-gradient\([\s\S]*to right/);
    // Each single-axis rule lists ONE gradient on its scroll axis — the
    // no-composite form old WebViews render instead of an opaque union.
    expect(
      sheet.match(/\[data-axis="horizontal"\][^\n]*\n\s*--hk-scroll-fade-layers: linear-gradient\(\s*to right/),
      "horizontal containers fade with one to-right gradient",
    ).toBeTruthy();
    expect(
      sheet.match(/\[data-axis="vertical"\][^\n]*\n\s*--hk-scroll-fade-layers: linear-gradient\(\s*to bottom/),
      "vertical containers fade with one to-bottom gradient",
    ).toBeTruthy();
    // The axis rules swap the var only — no composite, no mask property.
    const axisBlocks = sheet.match(
      /\.hk-scroll-container\[data-axis="(?:horizontal|vertical)"\]:is\([^)]*\)[^{]*\{[\s\S]*?\n\}/g,
    ) ?? [];
    expect(axisBlocks.length, "both axis swap rules exist").toBe(2);
    for (const block of axisBlocks) {
      expect(block).toContain("--hk-scroll-fade-layers: linear-gradient(");
      expect(block).not.toContain("mask-composite");
      expect(block).not.toContain("mask-image");
    }
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
