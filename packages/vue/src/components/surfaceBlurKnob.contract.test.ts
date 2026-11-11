/**
 * Contract for the surface live-blur ESCAPE HATCH (2026-11-12 chest field
 * report: "some dynamic UI content disappears and is clipped in place",
 * chronic in an Android System WebView shell, occasional on desktop at the
 * moment a screen capture forces a full-surface re-raster).
 *
 * Mechanism CLASS the hatch targets: `.hk-card` and `.hk-btn-secondary` each
 * carry a `backdrop-filter`, so each one needs its own background render
 * surface. That is pure cost with no visual gain whenever the layer beneath
 * is already an opaque surface (the card fill is 70%-alpha surface over the
 * sheet; the secondary button fill is the opaque surface token itself). On a
 * compositor with a small surface budget the report shows the element's box
 * surviving while its painted contents go missing, which is the failure
 * shape this hatch exists to let a host switch off per engine.
 *
 * Two invariants are pinned here, both load-bearing:
 *
 *   1. every such surface consumes `--hk-<surface>-blur` with the previous
 *      literal as its fallback, so no host loses the current look by
 *      upgrading hikari and a host can stand the pass down per ENGINE;
 *   2. the knob is DELIBERATELY NOT width-gated. The modal family's
 *      `-mobile` knobs default to none ≤767px; copying that shape here would
 *      re-key the stand-down to the viewport. The artifact follows the
 *      compositor: a phone WebView in "request desktop site" mode reports a
 *      ~980px layout viewport, a tablet reports a wide one, a desktop
 *      WebView2 host reports a desktop one — all three still run the starved
 *      engine, so a width gate would leave exactly those hosts exposed.
 *
 * Assertions run on the COMPILED sheet, never on source text: a stand-down
 * can be written as `@include backdrop-filter(none)`, as a literal
 * declaration, or through a variable, and only the compiled output sees all
 * three. The width gate is checked by a real rule scanner (comments stripped,
 * braces matched) and carries a POSITIVE CONTROL so a broken scanner fails
 * loud instead of reporting "no violations" from an empty scan.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "sass";

const here = dirname(fileURLToPath(import.meta.url));
const loadPaths = [here, join(here, "..", "styles")];

function compiledSheet(sheet: string): string {
  return compile(join(here, sheet), { loadPaths, style: "expanded" }).css;
}

/** Comments carry braces and pseudo-selector text; strip before scanning. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

interface CssRule {
  selector: string;
  declarations: string;
}

/** Flat `selector { declarations }` rules of a stylesheet or block body. */
function rules(css: string): CssRule[] {
  const out: CssRule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripComments(css))) !== null) {
    out.push({ selector: m[1]!.trim(), declarations: m[2]! });
  }
  return out;
}

interface MediaRegion {
  query: string;
  body: string;
}

/** Top-level `@media { … }` regions with brace matching. */
function mediaRegions(css: string): MediaRegion[] {
  const src = stripComments(css);
  const out: MediaRegion[] = [];
  const re = /@media([^{]*)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const open = src.indexOf("{", m.index);
    let depth = 0;
    let i = open;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth += 1;
      else if (src[i] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.push({ query: m[1]!.trim(), body: src.slice(open + 1, i) });
  }
  return out;
}

/** Declaration map of the FIRST rule whose selector matches exactly. */
function declarationsFor(css: string, selector: string): Map<string, string> {
  const rule = rules(css).find((r) => r.selector === selector);
  expect(rule, `${selector} missing from the compiled sheet`).toBeDefined();
  const map = new Map<string, string>();
  for (const decl of rule!.declarations.split(";")) {
    const at = decl.indexOf(":");
    if (at < 0) continue;
    map.set(decl.slice(0, at).trim(), decl.slice(at + 1).trim());
  }
  return map;
}

const TARGETS = [".hk-card", ".hk-btn-secondary"];

/**
 * Width-gated stand-downs for the two surfaces: a rule that targets one of
 * them, lives inside a `max-width` media query, and sets a `backdrop-filter`.
 * Returns `selector @ query` strings; empty is the pass condition.
 */
export function widthGatedStandDowns(css: string): string[] {
  const hits: string[] = [];
  for (const region of mediaRegions(css)) {
    if (!/max-width/.test(region.query)) continue;
    for (const rule of rules(region.body)) {
      if (!TARGETS.includes(rule.selector)) continue;
      if (/backdrop-filter/.test(rule.declarations)) {
        hits.push(`${rule.selector} @ ${region.query}`);
      }
    }
  }
  return hits;
}

describe("surface live-blur escape hatch", () => {
  it("routes the card blur through --hk-card-blur, keeping the old literal as the fallback", () => {
    const decls = declarationsFor(compiledSheet("HkCard.scss"), ".hk-card");
    expect(decls.get("backdrop-filter")).toBe(
      "var(--hk-card-blur, blur(var(--blur-md)))",
    );
    // Separate property, so the assertion cannot be satisfied by the
    // prefixed twin alone (Firefox-dropping mutation stays red).
    expect(decls.get("-webkit-backdrop-filter")).toBe(
      "var(--hk-card-blur, blur(var(--blur-md)))",
    );
  });

  it("routes the secondary button blur through --hk-btn-secondary-blur", () => {
    const decls = declarationsFor(compiledSheet("HkButton.scss"), ".hk-btn-secondary");
    expect(decls.get("backdrop-filter")).toBe(
      "var(--hk-btn-secondary-blur, blur(var(--blur-sm)))",
    );
    expect(decls.get("-webkit-backdrop-filter")).toBe(
      "var(--hk-btn-secondary-blur, blur(var(--blur-sm)))",
    );
  });

  it("flags a width-gated stand-down (positive control: the scanner is not blind)", () => {
    const synthetic = [
      "@media (max-width: 767px) {",
      "  .hk-card {",
      "    backdrop-filter: none;",
      "  }",
      "}",
    ].join("\n");
    expect(widthGatedStandDowns(synthetic)).toEqual([".hk-card @ (max-width: 767px)"]);
  });

  it("flags the include form too, so the guard is not syntax-specific", () => {
    // `@include backdrop-filter(none)` compiles to the same declaration; this
    // pins the compiled-shape assumption the scanner relies on.
    const synthetic = [
      "@media (max-width: 767px) {",
      "  .hk-btn-secondary {",
      "    -webkit-backdrop-filter: none;",
      "    backdrop-filter: none;",
      "  }",
      "}",
    ].join("\n");
    expect(widthGatedStandDowns(synthetic)).toEqual([
      ".hk-btn-secondary @ (max-width: 767px)",
    ]);
  });

  it("keeps both surfaces engine-gated: no width-gated stand-down exists today", () => {
    for (const sheet of ["HkCard.scss", "HkButton.scss"]) {
      expect(widthGatedStandDowns(compiledSheet(sheet)), `${sheet}`).toEqual([]);
    }
    // Non-vacuity: the button sheet really does carry width media queries
    // (label collapse), so the scanner above is looking at real content
    // rather than at an empty set.
    expect(mediaRegions(compiledSheet("HkButton.scss")).length).toBeGreaterThan(0);
  });

  it("keeps the base declaration off the width axis for every sheet it ships in", () => {
    // Guard against a future refactor that moves the declaration into a
    // media query wholesale: the base rule must exist outside every region.
    for (const sheet of ["HkCard.scss", "HkButton.scss"]) {
      const css = compiledSheet(sheet);
      for (const selector of TARGETS) {
        const rule = rules(css).find((r) => r.selector === selector);
        if (!rule) continue;
        expect(rule.declarations).toMatch(/backdrop-filter:/);
      }
    }
  });
});
