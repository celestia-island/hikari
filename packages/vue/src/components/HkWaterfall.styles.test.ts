import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for HkWaterfall's column geometry — the axis a
 * runtime suite cannot see (happy-dom applies no stylesheets): how the two
 * masonry columns share the bucket row.
 *
 * The invariant this pins: column spacing is SIBLING MARGIN, and a collapsed
 * (`[data-empty]`) column costs no width AND no spacing. A container `gap`
 * would be spent on the (live, collapsed) pair, so the surviving card
 * rendered one `--space-12` narrower than the bucket while full-width
 * bucketHeader caption rows kept the true edge — a ragged right edge on
 * every single-card section (chest reports view, user screenshot
 * 2026-10-31).
 *
 * Enforcement is ownership-based, not spell-based: the compiled sheet must
 * contain EXACTLY the five column rules below, each with EXACTLY its pinned
 * declaration list (whitespace-normalized, in compiled order), and NOTHING
 * else in the sheet may mention the columns. That closes every escape the
 * R2/R3 attack round found on the earlier spell-based pins — physical
 * aliases (`margin-left`), logical shorthands (`margin-inline`),
 * padding into the zero-basis item, duplicate declarations (last wins) and
 * `!important` all change a pinned list or add a rule, and turn this red —
 * and it stays honest about scope: vertical spacing on buckets, or rules
 * that never mention the columns, are NOT this guard's business.
 *
 * Vitest stubs CSS, so the runtime suite can never catch a lost rule —
 * this compiles the sheet directly and asserts the contract.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

const compiled = compile(resolve(componentDir, "HkWaterfall.scss"), {
  style: "expanded",
}).css;

// Expanded sass keeps comments inline and may emit an @charset preamble;
// both must go before rule parsing or they glue onto captured selectors.
const css = compiled
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^@charset[^;]*;/m, "");

/** The sheet is flat by contract. Source nesting flattens at compile time,
 *  so output nesting would mean at-rules (keyframes &c.) — none belong
 *  here. Any surviving `@` (media/supports/font-face/…, known or future)
 *  or nested brace fails loud instead of being silently mis-sliced. */
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

/** The ONE rule whose selector is exactly `selector`, with EXACTLY these
 *  declarations (normalized; a duplicate, an `!important` suffix, an extra
 *  or edited declaration all fail the equality). */
function expectRule(selector: string, decls: string[]): void {
  const hits = allRules().filter((r) => r.selector === selector);
  expect(hits, `exactly one "${selector}" rule`).toHaveLength(1);
  expect(hits[0].decls, `declarations of "${selector}"`).toEqual(decls);
}

/** Every rule whose selector mentions the columns. */
function columnRules(): { selector: string; decls: string[] }[] {
  return allRules().filter((r) => r.selector.includes("hk-waterfall-column"));
}

describe("HkWaterfall column spacing contract", () => {
  it("compiles into the expected flat sheet", () => {
    expect(css).toContain(".hk-waterfall-columns");
  });

  it("the column machinery is exactly five rules with exactly these declarations", () => {
    // Ownership pin: these five ARE the column rules, whole and sole. The
    // spacing mechanism (sibling margin, cancelled on a collapsed column on
    // both edges) and the intra-column card gap are spelled out to the last
    // declaration — any physical alias, shorthand, duplicate, !important or
    // extra rule shifts spacing outside this list and fails.
    expect(columnRules().map((r) => r.selector).sort()).toEqual(
      [
        ".hk-waterfall-column",
        ".hk-waterfall-columns",
        ".hk-waterfall-column + .hk-waterfall-column",
        ".hk-waterfall-column[data-empty]",
        ".hk-waterfall-column[data-empty] + .hk-waterfall-column",
      ].sort(),
    );
    expectRule(".hk-waterfall-columns", [
      "display: flex",
      "align-items: flex-start",
    ]);
    expectRule(".hk-waterfall-column", [
      "flex: 1 1 0",
      "min-width: 0",
      "display: flex",
      "flex-direction: column",
      "gap: var(--space-12)",
    ]);
    expectRule(".hk-waterfall-column + .hk-waterfall-column", [
      "margin-inline-start: var(--space-12)",
    ]);
    expectRule(".hk-waterfall-column[data-empty]", [
      "flex: 0 0 0",
      "margin-inline-start: 0",
    ]);
    expectRule(".hk-waterfall-column[data-empty] + .hk-waterfall-column", [
      "margin-inline-start: 0",
    ]);
  });
});
