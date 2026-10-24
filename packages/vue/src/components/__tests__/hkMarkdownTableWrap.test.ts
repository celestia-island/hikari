import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Source contract for the markdown table rail (2026-10-24: a wide table —
 * many columns or one unbreakable cell — pushed every ancestor's
 * min-content width past its box, and clipping hosts (the chest report
 * modal's reading region, chat bubbles, report cards) left the far columns
 * unreachable).
 *
 * vitest never resolves stylesheets, and the renderer's marked/DOMPurify
 * are lazy dynamic imports, so this pins the three moving parts as source
 * contracts in the same idiom as hkMarkdownLang.test.ts:
 *
 *   - the renderer overrides `table` to wrap the emitted table in a
 *     `.hk-md-table-wrap` rail, delegating to the base Renderer for the
 *     table markup itself;
 *   - the stylesheet gives that wrapper the horizontal rail with the
 *     hidden-native-chrome contract (the 2026-10-01 native-bar rule);
 *   - the overlay-scrollbar reconciliation covers the wrapper alongside
 *     `.hk-md-code`, so the rail gets the shared chrome and detaches with
 *     the block.
 */
const here = dirname(fileURLToPath(import.meta.url));
const tsx = readFileSync(join(here, "../HkMarkdownRenderer.tsx"), "utf-8");
const scss = readFileSync(join(here, "../HkMarkdownRenderer.scss"), "utf-8");

describe("markdown table rail contract", () => {
  it("the renderer wraps tables in the rail via the base renderer", () => {
    // The override must DELEGATE (base table markup) and then wrap — a
    // replacement that dropped the delegation would lose marked's table
    // rendering; a wrap without the override is the dead-selector shape.
    expect(tsx).toMatch(
      /return\s*`<div class="hk-md-table-wrap">\$\{inner\}<\/div>`;/,
    );
    expect(tsx).toMatch(
      /RendererCtor\.prototype as \{ table: \(t: unknown\) => string \}\)\.table\.call\(this, token\)/,
    );
  });

  it("the rail stylesheet keeps native chrome hidden", () => {
    expect(scss).toMatch(
      /\.hk-md-table-wrap\s*\{[^}]*overflow-x:\s*auto/,
    );
    expect(scss).toMatch(
      /\.hk-md-table-wrap\s*\{[^}]*scrollbar-width:\s*none/,
    );
  });

  it("the overlay reconciliation covers the rail alongside code blocks", () => {
    expect(tsx).toMatch(
      /querySelectorAll<HTMLElement>\("\.hk-md-code, \.hk-md-table-wrap"\)/,
    );
  });
});
