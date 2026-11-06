/**
 * Source contract for the scroll-container edge fades (the 2026-11-06
 * progressive revision of the 2026-11-02 composition): each edge owns a
 * CSS var, the viewport mask is built from the gradient LAYERS listed in
 * --hk-scroll-fade-layers, the axis rules swap that list, and every lit
 * band is the fade size scaled by a live strength the component
 * publishes from the hidden-content depth (the progressive fade) —
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
 *
 * And the regression this file now exists to keep dead (2026-11-06,
 * user report "still hard-clipped while swiping", measured in a real
 * engine): #902 (2026-10-29) declared the four zero defaults on the
 * VIEWPORT base rule, and a directly declared custom property beats any
 * inherited value, so the viewport's own 0px shadowed every root state
 * rule's band — no edge ever faded again (resolved mask stops
 * `rgb(0,0,0) 0px … rgb(0,0,0) 100%`), every faded strip hard-clipped,
 * and the dock fades died with it. The defaults therefore live on the
 * ROOT rule that also carries the strength fallbacks, and the viewport
 * declares only the layers/mask pair.
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

  it("declares the zero defaults on the ROOT, never on the viewport (the #902 shadowing)", () => {
    // A directly declared custom property beats any inherited value: the
    // moment the viewport base rule re-declares these defaults, every
    // root state rule's band is shadowed back to 0px and the fades die
    // silently (the 2026-10-29..11-06 hard-clip regression, measured in
    // a real engine). The viewport rule declares only the layer list.
    const viewportBase = sheet.match(
      /\.hk-scroll-container:is\(\[data-fade="true"\], \[data-dock-fade\]\) > \.hk-scroll-container-viewport \{[\s\S]*?\n\}/,
    );
    expect(viewportBase, "the viewport base rule exists").toBeTruthy();
    for (const edge of ["top", "right", "bottom", "left"]) {
      expect(viewportBase![0]).not.toContain(`--hk-scroll-fade-${edge}: 0px;`);
    }
    // And the root rule that carries them exists with the strengths.
    const rootDefaults = sheet.match(
      /\.hk-scroll-container:is\(\[data-fade="true"\], \[data-dock-fade\]\) \{[\s\S]*?\n\}/,
    );
    expect(rootDefaults, "the root defaults rule exists").toBeTruthy();
    for (const edge of ["top", "right", "bottom", "left"]) {
      expect(rootDefaults![0]).toContain(`--hk-scroll-fade-${edge}: 0px;`);
      expect(rootDefaults![0]).toContain(`--hk-scroll-fade-strength-${edge}: 1;`);
    }
  });

  it("scales every lit band by the published strength (the progressive fade)", () => {
    // Band = fade size × strength, so the component's hidden-content
    // depth (0..1 over fadeDistance) deepens each edge from a hard cut
    // to the full band. A bare `var(--hk-scroll-fade-size)` band in a
    // state rule is the pre-progressive binary shape — drift.
    const bandRules = sheet.match(
      /^\.hk-scroll-container\[data-fade="true"\]\[data-[hv]-overflow="(?:start|end|both)"\] \{[^}]*\}/gm,
    ) ?? [];
    expect(bandRules.length, "six lit-band state rules (3 per axis)").toBe(6);
    for (const block of bandRules) {
      const declarations = block.match(/--hk-scroll-fade-(?:top|right|bottom|left): [^;]+;/g) ?? [];
      expect(declarations.length, "each state rule lights at least one band").toBeGreaterThan(0);
      for (const declaration of declarations) {
        expect(
          declaration,
          `strength-scaled band: ${declaration}`,
        ).toMatch(/^--hk-scroll-fade-(?:top|right|bottom|left): calc\(var\(--hk-scroll-fade-size\) \* var\(--hk-scroll-fade-strength-(?:top|right|bottom|left), 1\)\);$/);
      }
    }
    expect(sheet).not.toMatch(/--hk-scroll-fade-(?:top|right|bottom|left): var\(--hk-scroll-fade-size\);/);
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
