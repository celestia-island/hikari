/**
 * Source contract: the inline landing sits FLUSH under its context. The
 * `.is-inline` variant must drop the viewport takeover's block-axis
 * padding entirely (the host pane already pads and a sibling header sits
 * immediately above — the old 1.25rem top padding floated the card a
 * full padding-frame below its context) and slim the card's page-grade
 * top padding (2.25rem desktop / 1.75rem mobile) to one space step. The
 * horizontal inset stays so a narrow pane never seats the card
 * edge-to-edge. A class-name test cannot see this; the compiled contract
 * lives here.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Extract one rule's body with nesting-aware brace matching. */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `rule ${selector} present`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced braces in ${selector}`);
}

describe("HkErrorLanding inline contract", () => {
  const css = readFileSync(join(here, "HkErrorLanding.scss"), "utf-8");
  const inline = ruleBody(css, ".hk-error-landing.is-inline");

  it("drops the block-axis padding entirely and keeps only the horizontal inset", () => {
    expect(inline).toContain("min-height: 0");
    expect(inline).toContain("padding: 0 var(--space-12, 0.75rem)");
    // The takeover padding must not survive in any form.
    expect(inline).not.toContain("1.25rem");
  });

  it("slims the card's top padding below the page-grade value", () => {
    const card = ruleBody(inline, ".hk-error-landing__card");
    // The shorthand's block-start value IS the slim step, not the
    // page-grade 2.25rem (desktop) / 1.75rem (≤480px media) top.
    expect(card).toContain("padding: var(--space-16, 1rem) ");
    expect(card).not.toContain("2.25rem");
  });
});
