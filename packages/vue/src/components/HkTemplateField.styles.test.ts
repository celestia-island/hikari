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
 *   1. the editor rows' native scrollbar is HIDDEN (`scrollbar-width:
 *      none` + `::-webkit-scrollbar { display: none }`) — the family
 *      draws its shared overlay chrome instead, and a component that
 *      kept the native bar would show two bars (the 2026-09-08
 *      double-scroll report class);
 *   2. the scroll host is a positioning context (`position: relative`)
 *      for the overlay rails;
 *   3. the sheet's `hk-tpl-*` / `hk-template-*` selectors and the TSX's
 *      class literals agree in BOTH directions (no dead rule, no
 *      unstyled element).
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
  const css = compile(resolve(componentDir, "HkTemplateField.scss"), {
    style: "expanded",
  }).css;

  it("hides the native scrollbar of the editor rows viewport", () => {
    // Both spellings: standard property + the WebKit pseudo-element.
    expect(css).toMatch(/\.hk-tpl-editor-rows[^{]*\{[^}]*scrollbar-width:\s*none/s);
    expect(css).toMatch(/hk-tpl-editor-rows[^{]*::-webkit-scrollbar[^{]*\{[^}]*display:\s*none/s);
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
