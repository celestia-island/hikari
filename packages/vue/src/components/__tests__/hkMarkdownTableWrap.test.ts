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
 * are lazy dynamic imports, so this pins the moving parts as source
 * contracts in the same idiom as hkMarkdownLang.test.ts:
 *
 *   - the renderer overrides `table` to wrap the emitted table in the
 *     two-level rail shape (host + scroller), delegating to the base
 *     Renderer for the table markup itself;
 *   - the stylesheet gives the scroller the horizontal rail with the
 *     hidden-native-chrome contract (the 2026-10-01 native-bar rule) and
 *     makes the wrap a positioned rail host carrying the vertical margin;
 *   - the overlay-scrollbar reconciliation covers the scroller alongside
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
    // The wrap is TWO-level (`.hk-md-table-wrap` host containing the
    // `.hk-md-table-scroll` viewport): the overlay engine anchors its
    // track in the viewport's PARENT, so a single-level wrap would rail
    // against the whole `.hk-markdown-body` instead of the table.
    expect(tsx).toMatch(
      /return\s*`<div class="hk-md-table-wrap"><div class="hk-md-table-scroll">\$\{inner\}<\/div><\/div>`;/,
    );
    expect(tsx).toMatch(
      // Delegation shape: the override calls the BASE Renderer's `table` with
      // the override's own `this`, so marked's table markup (alignments, head/
      // body split) survives. The call moved from a hoisted constructor handle
      // to `marked.Renderer.prototype` when the renderer wiring was retyped;
      // the contract is the delegation itself, not the handle's spelling.
      /marked\.Renderer\.prototype\.table\.call\(this, token\)/,
    );
  });

  it("the rail stylesheet keeps native chrome hidden on the scroller", () => {
    expect(scss).toMatch(
      /\.hk-md-table-scroll\s*\{[^}]*overflow-x:\s*auto/,
    );
    expect(scss).toMatch(
      /\.hk-md-table-scroll\s*\{[^}]*scrollbar-width:\s*none/,
    );
  });

  it("the wrap is a positioned host carrying the table's vertical margin", () => {
    // Host: wraps ONLY the scroller and is positioned, so the rail hugs
    // the table (no guard promotion of `.hk-markdown-body`); the margin
    // lives here because the scroll box never collapses margins with its
    // children — this keeps normal tables' surrounding rhythm identical
    // to the pre-wrap bare table.
    expect(scss).toMatch(
      /\.hk-md-table-wrap\s*\{[^}]*position:\s*relative/,
    );
    expect(scss).toMatch(
      /\.hk-md-table-wrap\s*\{[^}]*margin:\s*0\.75em\s+0/,
    );
    expect(scss).toMatch(
      // `0\s*;` — a bare `margin:\s*0` would also prefix-match the
      // bare-table `margin: 0.75em 0` and false-pass the very double-margin
      // regression this reset exists to prevent.
      /\.hk-markdown \.hk-md-table-wrap table\s*\{[^}]*margin:\s*0\s*;/,
    );
  });

  it("the overlay reconciliation covers the rail alongside code blocks", () => {
    expect(tsx).toMatch(
      /querySelectorAll<HTMLElement>\("\.hk-md-code, \.hk-md-table-scroll"\)/,
    );
  });
});
