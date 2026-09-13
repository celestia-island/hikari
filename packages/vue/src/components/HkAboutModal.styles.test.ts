import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for HkAboutModal.
 *
 * Vitest stubs CSS (`test.css` is off), so the runtime suite can never catch
 * a class the component emits that lost its rule — the #493 redesign dropped
 * the `.s-about-modal-links` rule while keeping the element and every test
 * stayed green. This test compiles the component sheet directly and asserts
 * both directions of the class contract:
 *
 *   1. every `s-about-modal-*` class the TSX renders has a rule, and
 *   2. every `s-about-modal-*` rule in the sheet is rendered by the TSX
 *      (no dead selectors).
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

function classesFrom(source: string): Set<string> {
  // The component only uses static class strings; collect them from the
  // `class="…"` attributes plus any bare `s-about-modal-*` token.
  const found = new Set<string>();
  for (const match of source.matchAll(/s-about-modal[\w-]*/g)) found.add(match[0]);
  return found;
}

describe("HkAboutModal stylesheet contract", () => {
  const tsx = readFileSync(resolve(componentDir, "HkAboutModal.tsx"), "utf8");
  const scss = readFileSync(resolve(componentDir, "HkAboutModal.scss"), "utf8");
  const css = compile(resolve(componentDir, "HkAboutModal.scss"), {
    style: "expanded",
  }).css;

  it("compiles without warnings", () => {
    expect(css).toContain(".s-about-modal");
  });

  it("gives every emitted class a rule", () => {
    // Selector-side scan of the compiled sheet (not the SCSS source): a rule
    // that failed to compile would otherwise still count as "present".
    const declared = new Set([...css.matchAll(/\.(s-about-modal[\w-]*)/g)].map((m) => m[1]!));
    const missing = [...classesFrom(tsx)].filter((name) => !declared.has(name)).sort();
    expect(missing, "classes rendered without a stylesheet rule").toEqual([]);
  });

  it("declares no rule the component never renders", () => {
    const rendered = classesFrom(tsx);
    const dead = [...new Set([...scss.matchAll(/\.(s-about-modal[\w-]*)/g)].map((m) => m[1]!))]
      .filter((name) => !rendered.has(name))
      .sort();
    expect(dead, "stylesheet selectors with no matching element").toEqual([]);
  });
});
