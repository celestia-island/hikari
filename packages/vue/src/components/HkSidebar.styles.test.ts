import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Scroll end-cap contract for the HkSidebar body.
 *
 * The sidebar body is the scroll viewport for every nav list the library
 * hosts (desktop rail, mobile drawer). When the list overflows, the air
 * BELOW the last row is the only "this is the end" signal a scroller
 * gets: a tail the size of a hairline reads as "keep going". The 4px
 * tail let the final item kiss the panel's bottom edge at full scroll
 * (user screenshot on the chest admin sidebar, 2026-10-01 — the last
 * item sat flush against the panel's bottom boundary), so the rail now
 * declares an option-sized `--hk-sidebar-scroll-tail` and both density
 * variants of the body spend it as their block-end padding.
 *
 * The structural assertions run on the COMPILED sheet, not the source
 * text, so a declaration cannot hide behind SCSS nesting, and comments
 * are stripped first so a commented-out tail cannot keep a hollow guard
 * green. Two pins deliberately break that rule and read the raw source:
 * the fallback literal and the single-declaration count (each explains
 * why in place).
 */
const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

function sidebarCss(): string {
  const file = resolve(componentDir, "HkSidebar.scss");
  return compile(file, { style: "expanded", loadPaths: [componentDir] }).css.replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

function ruleBody(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return m ? m[1]! : null;
}

/** The exact token expression the tail is declared with. */
const TAIL_DECL = "--hk-sidebar-scroll-tail: var(--space-24, 1.5rem)";

describe("HkSidebar scroll end-cap", () => {
  const css = sidebarCss();

  it("compiles", () => {
    expect(css.length).toBeGreaterThan(0);
    // Sanity anchors so a renamed file cannot hollow this guard.
    expect(css).toContain(".hk-sidebar-body");
    expect(css).toContain(".hk-sidebar-footer");
  });

  it("declares the tail token on the rail, not the body", () => {
    // The rail-level declaration is what makes the knob real for hosts:
    // an element's own custom-property declaration always beats an
    // inherited value, so a body-level declaration would silently kill
    // ancestor retunes (the menu-item sheet-token trap).
    const rail = ruleBody(css, ".hk-sidebar");
    expect(rail, "the rail rule exists").not.toBeNull();
    expect(rail).toContain(TAIL_DECL);
    const body = ruleBody(css, ".hk-sidebar-body");
    expect(body, "the body rule exists").not.toBeNull();
    expect(body).not.toContain("--hk-sidebar-scroll-tail:");
  });

  it("spends the tail as the body's block-end padding", () => {
    const body = ruleBody(css, ".hk-sidebar-body");
    expect(body).toContain("padding-block: var(--space-20) var(--hk-sidebar-scroll-tail)");
    // The old hairline tail must not sneak back through another spelling.
    expect(body).not.toMatch(/padding-block:[^;]*--space-4/);
  });

  it("the density dress keeps every vertical metric at the expanded value", () => {
    // Vertical rhythm is density-invariant (2026-10-31 user direction:
    // the collapse toggle must not move rows). The body's ONLY density
    // declaration is the rail row square's inline track (2026-11-02 user
    // screenshot: the collapsed selected pill was a 32×34 oblong; the
    // track narrows to 11px a side so the 100%-wide row fills exactly its
    // 34px min-height square) — the leading air AND the scroll tail ride
    // the single base rule in both densities, and the header/footer dress
    // rules keep the expanded BLOCK padding, narrowing only the inline
    // track for the rail column.
    // ruleBody needs the arm its brace follows; the dress compiles to one
    // comma-grouped rule per band, so the generation arm is the one the
    // helper can read (the legacy arm shares its body).
    const bodySquare = css.match(
      /\.hk-sidebar\[data-collapsed\]\s*\.hk-sidebar-body[^{]*\{([^}]*)\}/,
    );
    expect(bodySquare, "the rail body inline-track rule exists").not.toBeNull();
    expect(
      bodySquare![1]!.trim(),
      "the body dress is the row square's inline track ALONE — any block spelling here moves rows",
    ).toBe("padding-inline: 11px;");
    const header = ruleBody(css, ".hk-sidebar-rail-generation[data-rail] .hk-sidebar-header");
    expect(header, "the collapsed header rule exists (grouped density carriers)").not.toBeNull();
    expect(header).toContain("padding: var(--space-16) var(--space-8)");
    const footer = ruleBody(css, ".hk-sidebar-rail-generation[data-rail] .hk-sidebar-footer");
    expect(footer, "the collapsed footer rule exists (grouped density carriers)").not.toBeNull();
    expect(footer).toContain("padding: var(--space-16) var(--space-8)");
    // The stronger, spelling-proof form (whole-dress scan): EVERY
    // padding declaration in ANY dress rule must be EXACTLY one of the
    // two sanctioned values — the expanded two-track shorthand (header/
    // footer bands) or the body's square track — exact, not a prefix: a
    // three-track spelling (`padding: var(--space-16) var(--space-8)
    // var(--space-12)`) drifts the block END past a block-start-only
    // check, and a longhand (`padding-block-start:`) hides from a
    // shorthand-only one; both green-holed earlier rounds. Physical
    // `bottom` longhands are banned beside the logical ones; an
    // `padding-inline` on any NON-body rule is rejected the same way (a
    // band that truly needs different block metrics must move the BASE
    // rule for BOTH densities). Margins are banned outright — the bands
    // separate by their paddings alone — and so are the block-FLOW
    // metrics that move rows just the same (gap/row-gap/height/
    // min-height/max-height).
    // Keyed on the carrier SUBSTRINGS, not their bracket spelling: a
    // `[data-collapsed="true"]`-style variant of the same carrier must
    // not slip the scan (2026-11-02 review: the exact-literal filter was
    // a green hole). Boundary (restored): a brand-new carrier MECHANISM
    // — a class-based hook or a third density attribute under a new
    // name — is a new dress and must re-run this contract; not
    // mechanically foreseeable here.
    const dressRules = css
      .split("}")
      .filter((rule) => rule.includes("data-collapsed") || rule.includes("data-rail"));
    expect(dressRules.length, "the density dress rules exist").toBeGreaterThan(1);
    for (const rule of dressRules) {
      for (const decl of rule.matchAll(
        /\bpadding(?:-(?:top|bottom|block(?:-(?:start|end))?|inline(?:-(?:start|end))?))?\s*:[^;}]*/g,
      )) {
        const text = decl[0].trim();
        if (/^padding-inline/.test(text)) {
          // Chunk-anchored, not chunk-containment: the chunk carries the
          // rule's own selector before its "{" — requiring THE SELECTOR
          // to be the body's is what actually confines the inline track
          // to the body rule (a raw chunk toContain would pass on a
          // neighbor's selector too — 2026-11-02 review).
          const selector = rule.slice(0, rule.indexOf("{"));
          expect(
            selector,
            `a dress inline track outside the body rule: ${rule}`,
          ).toContain(".hk-sidebar-body");
          expect(
            text,
            `a dress inline track drifted from the row square: ${text}`,
          ).toBe("padding-inline: 11px");
        } else {
          expect(
            text,
            `a dress padding is not the expanded two-track shorthand: ${text}`,
          ).toBe("padding: var(--space-16) var(--space-8)");
        }
      }
      expect(rule, `a margin crept into the dress: ${rule}`).not.toMatch(
        /\bmargin(?:-(?:top|bottom|block(?:-(?:start|end))?))?\s*:/,
      );
      // block-FLOW metrics that move rows just the same (line-height
      // already falls under the `height` alternative via the word
      // boundary; the logical `block-size` family spelled out
      // separately — "min-block-size" carries no "height" substring,
      // 2026-11-02 review), plus the block-EDGE spellings a
      // padding/margin scan cannot see (border-block-start-width and
      // inset-block drifted rows while every padding check stayed
      // green).
      expect(rule, `block-flow metric in the dress: ${rule}`).not.toMatch(
        /\b(?:gap|row-gap|height|min-height|max-height|(?:min-|max-)?block-size)\s*:/,
      );
      expect(rule, `block-edge border in the dress: ${rule}`).not.toMatch(/\bborder-block/);
      expect(rule, `block-edge inset in the dress: ${rule}`).not.toMatch(/\binset-block/);
      // The PHYSICAL block-edge borders: the lookbehind above deliberately
      // spares "-top"/"-bottom" INSIDE longer words, which let
      // `border-top-width: 6px` push every row below it down while every
      // logical check stayed green (2026-11-02 review).
      expect(rule, `physical block-edge border in the dress: ${rule}`).not.toMatch(
        /\bborder-(?:top|bottom)\b/,
      );
      expect(rule, `physical block offset in the dress: ${rule}`).not.toMatch(
        /(?<![-\w])(?:top|bottom)\s*:/,
      );
    }
  });

  it("reads the tail fallback from the scss source, not a drifted literal", () => {
    // The fallback lives once, next to the token it mirrors — pin the
    // source line so a retune of the token cannot leave a stale literal
    // behind (the compiled-sheet pins above would both have to move).
    const source = readFileSync(resolve(componentDir, "HkSidebar.scss"), "utf8");
    expect(source).toContain("--hk-sidebar-scroll-tail: var(--space-24, 1.5rem);");
  });

  it("declares the tail token exactly once in the source", () => {
    // The rule-body pins above inspect only specific rules, so a second
    // --hk-sidebar-scroll-tail declaration sneaking into a mid-tree rule
    // (.hk-sidebar-panel, .hk-sidebar-body-wrap, the collapsed block)
    // would silently re-kill the host knob — nearest-ancestor
    // declaration wins over the rail's — while every pin stays green.
    // Counting the source occurrences closes that hollow path (and
    // enforces the fallback's uniqueness for real, unlike toContain).
    // The pattern takes any colon spelling, spaced or not.
    const source = readFileSync(resolve(componentDir, "HkSidebar.scss"), "utf8");
    expect(source.match(/--hk-sidebar-scroll-tail\s*:/g)).toHaveLength(1);
  });
});
