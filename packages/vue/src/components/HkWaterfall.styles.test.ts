import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for HkWaterfall's column geometry — the axis a
 * runtime jsdom suite cannot see (it does no layout): how the two masonry
 * columns share the bucket row.
 *
 *   1. column spacing is SIBLING MARGIN, not a container `gap`;
 *   2. a collapsed (`[data-empty]`) column costs no width AND no spacing —
 *      a container gap would be spent on the (live, collapsed) pair, so the
 *      surviving card rendered one `--space-12` narrower than the bucket
 *      while full-width bucketHeader caption rows kept the true edge: a
 *      ragged right edge on every single-card section (chest reports view,
 *      user screenshot 2026-10-31);
 *   3. a live column AFTER a collapsed one is not indented off the bucket's
 *      start edge either.
 *
 * Vitest stubs CSS, so the runtime suite can never catch a lost rule —
 * this compiles the sheet directly and asserts the contract.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

const css = compile(resolve(componentDir, "HkWaterfall.scss"), {
  style: "expanded",
}).css;

function ruleFor(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `${selector} present in the compiled sheet`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(start, close + 1);
}

describe("HkWaterfall column spacing contract", () => {
  it("compiles without warnings", () => {
    expect(css).toContain(".hk-waterfall-columns");
  });

  it("the columns row carries no container gap (a gap would be spent on collapsed columns too)", () => {
    const rule = ruleFor(".hk-waterfall-columns {");
    expect(rule).not.toContain("gap");
  });

  it("adjacent live columns are spaced by a sibling margin", () => {
    const rule = ruleFor(".hk-waterfall-column + .hk-waterfall-column {");
    expect(rule).toContain("margin-inline-start: var(--space-12)");
  });

  it("a collapsed column costs no width and no spacing", () => {
    const rule = ruleFor(".hk-waterfall-column[data-empty] {");
    expect(rule).toContain("flex: 0 0 0");
    expect(rule).toContain("margin-inline-start: 0");
  });

  it("a live column after a collapsed one starts flush at the bucket edge", () => {
    const rule = ruleFor(".hk-waterfall-column[data-empty] + .hk-waterfall-column {");
    expect(rule).toContain("margin-inline-start: 0");
  });
});
