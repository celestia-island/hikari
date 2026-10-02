/**
 * Source contract: the inline landing CENTERS inside its host region. The
 * `.is-inline` variant must fill the host container's height (so the base
 * centering seats the card mid-container — the inline twin of the page
 * variant centering in the viewport), carry no block-axis padding (the
 * #695 lesson: a hardcoded top inset read as "floating too low" under a
 * sibling header), and center the card via overflow-safe auto margins
 * (collapse to top-anchored when the card is taller than the container,
 * instead of a both-edge clip nothing can scroll to). The horizontal
 * inset stays so a narrow pane never seats the card edge-to-edge. A
 * class-name test cannot see this; the compiled contract lives here.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Strip SCSS comments — line and block form — so a contract literal can
 *  only ever be satisfied by a REAL declaration, never by prose: a
 *  commented-out `margin: auto` (line-comment mutation found in R1,
 *  block-comment in R2) would otherwise false-green `toContain`. A `//`
 *  preceded by `:` is a URL scheme (`https://`) and survives. Block
 *  comments go first so a `//` hidden inside them can't leak through. */
function stripComments(css: string): string {
  return stripLineComments(css.replace(/\/\*[\s\S]*?\*\//g, ""));
}

/** Strip SCSS `//` line comments; `://` URL schemes survive. */
function stripLineComments(css: string): string {
  return css
    .split("\n")
    .map((line) => {
      let i = line.indexOf("//");
      while (i !== -1 && line[i - 1] === ":") {
        i = line.indexOf("//", i + 1);
      }
      return i === -1 ? line : line.slice(0, i);
    })
    .join("\n");
}

/** Extract one rule's body with nesting-aware brace matching, prose
 *  stripped. */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `rule ${selector} present`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return stripComments(css.slice(open + 1, i));
    }
  }
  throw new Error(`unbalanced braces in ${selector}`);
}

describe("contract-test comment stripping", () => {
  it("strips comments (positive control — the guard must be able to bite)", () => {
    // Without this control a broken stripper would silently turn every
    // assertion above into prose-matching; 0-strip must be LOUD.
    const dirty = "// min-height: 100%\n  min-height: 100%;";
    expect(stripComments(dirty)).not.toContain("//");
    expect(stripComments(dirty).trim()).toBe("min-height: 100%;");
    // Block comments are prose too (the R2 mutation shape: a commented-out
    // declaration must never satisfy the contract).
    const blocked = "margin: initial; /* margin: auto */";
    expect(stripComments(blocked)).toContain("margin: initial;");
    expect(stripComments(blocked)).not.toContain("margin: auto");
    // URL schemes survive intact.
    expect(stripComments('icon: url("https://cdn.example/x.svg");')).toContain("://");
  });
});

describe("HkErrorLanding inline contract", () => {
  const css = readFileSync(join(here, "HkErrorLanding.scss"), "utf-8");
  const inline = ruleBody(css, ".hk-error-landing.is-inline");

  it("fills the host region's height so the shared centering can seat the card", () => {
    // `min-height: 0` collapsed the root to its content height, which
    // silently disabled the base align/justify centering and glued the
    // card to the container's top edge.
    expect(inline).toContain("min-height: 100%");
    expect(inline).not.toContain("min-height: 0");
  });

  it("drops the block-axis padding entirely and keeps only the horizontal inset", () => {
    expect(inline).toContain("padding: 0 var(--space-12, 0.75rem)");
    // The takeover padding must not survive in any form.
    expect(inline).not.toContain("1.25rem");
  });

  it("centers the card through overflow-safe auto margins", () => {
    const card = ruleBody(inline, ".hk-error-landing__card");
    // Auto margins absorb positive free space (centering) and collapse to
    // 0 on overflow (no both-edge clip).
    expect(card).toContain("margin: auto");
    // The overflow anchor: with the margins collapsed the card must pin
    // to the container's TOP edge — reachable — never float mid-clip.
    expect(inline).toContain("align-items: flex-start");
  });

  it("slims the card's top padding below the page-grade value", () => {
    const card = ruleBody(inline, ".hk-error-landing__card");
    // The shorthand's block-start value IS the slim step, not the
    // page-grade 2.25rem (desktop) / 1.75rem (≤480px media) top.
    expect(card).toContain("padding: var(--space-16, 1rem) ");
    expect(card).not.toContain("2.25rem");
  });
});

describe("HkErrorLanding multiline headline contract", () => {
  const css = readFileSync(join(here, "HkErrorLanding.scss"), "utf-8");
  const title = ruleBody(css, ".hk-error-landing__title");

  it("renders authored line breaks in the headline as breaks", () => {
    // Catalogs ship per-line copy (a dash clause moved onto its own
    // line); without pre-line the h1 collapses those breaks to spaces.
    expect(title).toContain("white-space: pre-line");
    expect(title).toContain("overflow-wrap: anywhere");
  });
});

describe("HkErrorLanding page-variant seating contract", () => {
  const css = readFileSync(join(here, "HkErrorLanding.scss"), "utf-8");
  const base = ruleBody(css, ".hk-error-landing");

  it("fills the viewport and centers the card in it", () => {
    // The page variant's whole seating model: a full-viewport backdrop
    // with the card centered in it (standalone error pages, the chest
    // overlay, the reporting takeover all ride this rule). R2 flipped
    // align-items to flex-end and every landing test stayed green — this
    // pin closes that hole.
    expect(base).toContain("min-height: 100vh");
    expect(base).toContain("min-height: 100dvh");
    expect(base).toContain("align-items: center");
    expect(base).toContain("justify-content: center");
  });
});
