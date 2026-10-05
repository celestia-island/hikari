import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for the template surfaces. Vitest stubs CSS,
 * so the runtime suite can never catch a lost rule — this test compiles
 * the sheet directly and pins the pieces the runtime tests cannot see:
 *
 *   1. the editor rows' native scrollbar is HIDDEN inside the DESKTOP
 *      branch only (`scrollbar-width: none` + `::-webkit-scrollbar {
 *      display: none }` under `.hk-popover-panel:not(.hk-is-sheet)`) —
 *      the family draws its shared overlay chrome instead, and the
 *      mobile sheet must keep the panel as the ONE scroll region;
 *   2. the scroll host is a positioning context (`position: relative`)
 *      for the overlay rails;
 *   3. a curated class list checks TSX→CSS (no unstyled element) and a
 *      reverse scan flags any `hk-tpl-*`/`hk-template-*` selector in the
 *      sheet that no source file renders (no dead rule).
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

function classTokensFrom(source: string): Set<string> {
  const found = new Set<string>();
  for (const match of source.matchAll(/\b(?:hk|s)-[\w-]+/g)) {
    found.add(match[0]);
  }
  return found;
}

describe("HkTemplateField stylesheet contract", () => {
  const tsx = readFileSync(resolve(componentDir, "HkTemplateField.tsx"), "utf8");
  const rendererTsx = readFileSync(resolve(componentDir, "HkTemplateText.tsx"), "utf8");
  const grammars = readFileSync(resolve(componentDir, "templateGrammar.ts"), "utf8");
  const css = compile(resolve(componentDir, "HkTemplateField.scss"), {
    style: "expanded",
  }).css;

  it("hides the native scrollbar of the editor rows viewport (desktop branch only)", () => {
    // Both spellings: standard property + the WebKit pseudo-element,
    // and both under the `:not(.hk-is-sheet)` scoping — a bare rule
    // would also strip the sheet's native bar while no overlay is
    // attached there (sheet attaches none; the panel owns its scroll).
    expect(css).toMatch(
      /\.hk-popover-panel:not\(\.hk-is-sheet\)[^{]*\.hk-tpl-editor-rows[^{]*\{[^}]*scrollbar-width:\s*none/s,
    );
    // The WebKit spelling gets the SAME desktop scoping (R2 M8c: the
    // unscoped form of this rule survived every assertion).
    expect(css).toMatch(
      /\.hk-popover-panel:not\(\.hk-is-sheet\)[^{]*hk-tpl-editor-rows[^{]*::-webkit-scrollbar[^{]*\{[^}]*display:\s*none/s,
    );
    // EVERY rule that hides a native bar must carry the desktop scoping
    // — regardless of how its selector is spelled. Two spellings hide a
    // bar: `scrollbar-width: none` (a declaration, body) and a
    // `::-webkit-scrollbar` marker (a SELECTOR, not a declaration — the
    // R3 P3-1 correction). At-rule preludes (`@media …`) are skipped:
    // the naive block splitter attributes an at-rule's inner rules to
    // its prelude, which would false-positive on any future media query.
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/gs)];
    let barHiding = 0;
    for (const [, selector, body] of rules) {
      const sel = selector ?? "";
      if (sel.trimStart().startsWith("@")) continue;
      const hidesBar = (body ?? "").includes("scrollbar-width: none") || sel.includes("::-webkit-scrollbar");
      if (!hidesBar) continue;
      barHiding += 1;
      expect(sel, `bar-hiding rule must be sheet-scoped: ${sel}`).toContain(
        ":not(.hk-is-sheet)",
      );
    }
    // Extraction sanity (verification-loop rule: a 0-hit scan is a
    // pattern bug until proven otherwise) — the sheet does hide the bar
    // somewhere, so the loop above must have inspected at least one rule.
    expect(barHiding).toBeGreaterThan(0);
  });

  it("has no dead template selector in the sheet", () => {
    // Reverse direction: every `hk-tpl-*` / `hk-template-*` selector in
    // the compiled CSS must appear in one of the two source files.
    const sources = tsx + rendererTsx + grammars;
    const selectors = new Set<string>();
    for (const m of css.matchAll(/\.((?:hk-tpl|hk-template)[\w-]*)/g)) {
      selectors.add(m[1]!);
    }
    expect(selectors.size).toBeGreaterThan(5); // extraction sanity (R1: never trust a 0-hit)
    for (const sel of selectors) {
      expect(sources.includes(sel), `no source renders ${sel}`).toBe(true);
    }
  });

  it("keeps the heading band on the label class, not the group wrapper", () => {
    // The wrapper is a bare layout box; carrying the band's chrome
    // (padding/font-weight) there would pad every row run.
    expect(css).toMatch(/\.hk-tpl-group-label\s*\{[^}]*font-weight:\s*600/s);
    expect(css).not.toMatch(/\.hk-tpl-group\s*\{[^}]*font-weight/s);
    expect(css).not.toMatch(/\.hk-tpl-group\s*\{[^}]*padding/s);
  });

  it("keeps group headings free of text-transform (the host owns casing)", () => {
    // R2 M13: re-adding `text-transform: uppercase` used to stay green.
    expect(css).not.toMatch(/\.hk-tpl-group[^{]*\{[^}]*text-transform/s);
  });

  it("gives the scroll host a positioning context for the overlay rails", () => {
    expect(css).toMatch(/\.hk-tpl-editor-scroll\s*\{[^}]*position:\s*relative/s);
  });

  it("styles every editor class the TSX renders", () => {
    const emitted = classTokensFrom(tsx);
    for (const cls of ["hk-template-field", "hk-template-field-edit", "hk-template-field-box",
      "hk-template-field-label", "hk-tpl-chip", "hk-tpl-row", "hk-tpl-rows", "hk-tpl-group",
      "hk-tpl-editor", "hk-tpl-editor-rows", "hk-tpl-editor-scroll"]) {
      expect(emitted.has(cls), `TSX renders ${cls}`).toBe(true);
      expect(css.includes(`.${cls}`), `sheet styles ${cls}`).toBe(true);
    }
  });

  it("keeps the read-only renderer's classes styled by the shared sheet", () => {
    expect(rendererTsx).toContain("hk-template-text");
    expect(css.includes(".hk-template-text")).toBe(true);
    // The read-only chips ride the SAME chip class as the editor's.
    expect(rendererTsx).toContain("hk-tpl-chip");
  });
});
