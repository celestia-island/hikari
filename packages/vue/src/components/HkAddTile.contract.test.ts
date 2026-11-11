/**
 * Source contract: HkAddTile's base class stays NEUTRAL — faint dashed
 * border, muted ink, no surface, no primary tint. Color belongs to the
 * drag-over state only (`--drag-over`), which carries the dashed
 * primary + primary-wash language the product's hand-drawn drag
 * overlays already use. Pinned because the tile invites every host to
 * "just tint it a little" — a class-name test cannot catch the base
 * picking up color, the source contract lives here.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Extract one top-level rule block's body (`{ ... }`) by selector,
 *  counting braces so nested `&:hover` blocks stay inside the slice. */
function fullRule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `rule ${selector} present`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced braces in ${selector}`);
}

/** The rule's DIRECT declarations only — up to the first nested block
 *  (`&:hover` and friends). Nested states may tint by design; the
 *  neutrality discipline is about what the resting state paints. */
function directDecls(css: string, selector: string): string {
  const body = fullRule(css, selector);
  const nested = body.indexOf("&:");
  return nested === -1 ? body : body.slice(0, nested);
}

describe("HkAddTile neutrality contract", () => {
  const css = readFileSync(join(here, "HkAddTile.scss"), "utf-8");

  it("resting state: dashed neutral border, no surface, no wash", () => {
    const base = directDecls(css, ".hk-add-tile");
    expect(base).toContain("border: 1px dashed");
    expect(base).toContain("background: transparent");
    expect(base).not.toContain("rgb(var(--color-primary)");
  });

  it("compact stays a plain row form: no tint in direct declarations", () => {
    const compact = directDecls(css, ".hk-add-tile--compact");
    expect(compact).toContain("flex-direction: row");
    expect(compact).not.toContain("rgb(var(--color-primary)");
  });

  it("the drag-over wash lives exclusively in --drag-over", () => {
    const drag = fullRule(css, ".hk-add-tile--drag-over");
    expect(drag).toContain("rgb(var(--color-primary) / 8%)");
    // Whole-file sweep: exactly one top-level rule chunk paints the
    // wash, and it is the drag-over rule.
    const chunks = css.split(/(?=\.hk-add-tile)/g).filter((r) => r.includes("/ 8%)"));
    expect(chunks.length).toBe(1);
    expect(chunks[0].startsWith(".hk-add-tile--drag-over")).toBe(true);
  });

  it("disabled resets to neutral (no primary anywhere in the rule)", () => {
    const disabled = fullRule(css, ".hk-add-tile--disabled");
    expect(disabled).toContain("cursor: default");
    expect(disabled).not.toContain("primary");
  });
});
