// AI-generated: developed with a DeepSeek Harness agent (model GLM-5.3-flash); human-directed.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for HkMasonry's column geometry — the axis a
 * runtime suite cannot see (happy-dom applies no stylesheets).
 *
 * The invariant this pins: columns are independent flex stacks whose
 * spacing is SIBLING MARGIN, cancelled on a collapsed ([data-empty])
 * column on both edges — never a container `gap` (a gap is spent on the
 * (live, collapsed) pair too and shaves the survivor narrower than the
 * host's other full-width children), and NEVER a CSS-multicol property
 * (`columns` / `break-inside`), the fragmentation layout this component
 * exists to replace. Same ownership discipline as the HkWaterfall sheet
 * guard: the compiled sheet must contain EXACTLY the rules below, each
 * with EXACTLY its pinned declaration list, and nothing else in the sheet
 * may mention the columns.
 *
 * Vitest stubs CSS, so the runtime suite can never catch a lost rule —
 * this compiles the sheet directly and asserts the contract.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

const compiled = compile(resolve(componentDir, "HkMasonry.scss"), {
  style: "expanded",
}).css;

// Expanded sass keeps comments inline and may emit an @charset preamble;
// both must go before rule parsing or they glue onto captured selectors.
const css = compiled
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^@charset[^;]*;/m, "");

function rules(source: string): { selector: string; decls: string[] }[] {
  expect(source, "no at-rule may appear in the compiled sheet").not.toContain(
    "@",
  );
  expect(source, "no nested braces in the compiled sheet").not.toMatch(
    /\{[^{}]*\{/,
  );
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].replace(/\s+/g, " ").trim(),
    decls: m[2]
      .split(";")
      .map((d) => d.replace(/\s+/g, " ").trim())
      .filter(Boolean),
  }));
}

const allRules = (): { selector: string; decls: string[] }[] => rules(css);

function expectRule(selector: string, decls: string[]): void {
  const hits = allRules().filter((r) => r.selector === selector);
  expect(hits, `exactly one "${selector}" rule`).toHaveLength(1);
  expect(hits[0].decls, `declarations of "${selector}"`).toEqual(decls);
}

function columnRules(): { selector: string; decls: string[] }[] {
  return allRules().filter((r) => r.selector.includes("hk-masonry-col"));
}

describe("HkMasonry column spacing contract", () => {
  it("compiles into the expected flat sheet", () => {
    expect(css).toContain(".hk-masonry");
  });

  it("the column machinery is exactly five rules with exactly these declarations", () => {
    expect(columnRules().map((r) => r.selector).sort()).toEqual(
      [
        ".hk-masonry-col",
        ".hk-masonry-col + .hk-masonry-col",
        ".hk-masonry-col[data-empty]",
        ".hk-masonry-col[data-empty] + .hk-masonry-col",
      ].sort(),
    );
    expectRule(".hk-masonry-col", [
      "flex: 1 1 0",
      "min-width: 0",
      "display: flex",
      "flex-direction: column",
      "gap: var(--hk-masonry-gap, var(--space-12))",
    ]);
    expectRule(".hk-masonry-col + .hk-masonry-col", [
      "margin-inline-start: var(--hk-masonry-gap, var(--space-12))",
    ]);
    expectRule(".hk-masonry-col[data-empty]", [
      "flex: 0 0 0",
      "margin-inline-start: 0",
    ]);
    expectRule(".hk-masonry-col[data-empty] + .hk-masonry-col", [
      "margin-inline-start: 0",
    ]);
  });

  it("the sheet never speaks fragmentation layout", () => {
    // The whole point of the component: no multicol anywhere, in any rule,
    // under any alias the shorthand family offers.
    expect(css).not.toMatch(/\bcolumns\s*:/);
    expect(css).not.toMatch(/break-inside/);
    expect(css).not.toMatch(/column-(gap|count|fill|width)/);
  });
});
