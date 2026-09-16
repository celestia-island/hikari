/**
 * Source contract: the empty state's surface is OPT-IN (`boxed`). The
 * base `.hk-empty-state` class must stay a bare layout block — the four
 * surface declarations (background, blur, border, radius) live only in
 * `.hk-empty-state--boxed`. Pinned because every in-card empty state in
 * the family reads as a second nested placeholder layer the moment the
 * surface creeps back into the base class (hikari #567); a class-name
 * test alone cannot catch that, the compiled contract lives here.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const SURFACE_PROPERTIES = [
  "background:",
  "backdrop-filter:",
  "border:",
  "border-radius:",
] as const;

/** Extract one top-level rule block's body (`{ ... }`) by selector. */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `rule ${selector} present`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("HkEmptyState surface contract", () => {
  const css = readFileSync(join(here, "HkEmptyState.scss"), "utf-8");

  it("keeps the base class free of surface declarations", () => {
    const base = ruleBody(css, ".hk-empty-state");
    for (const property of SURFACE_PROPERTIES) {
      expect(base).not.toContain(property);
    }
  });

  it("declares the full surface on the opt-in --boxed rule only", () => {
    const boxed = ruleBody(css, ".hk-empty-state--boxed");
    for (const property of SURFACE_PROPERTIES) {
      expect(boxed).toContain(property);
    }
    // The surface is the ONLY rule allowed to paint: with the --boxed rule
    // (and comments, whose prose may name the properties) removed, no
    // declaration of a surface property may remain anywhere in the sheet.
    // (The sr-only reset's `border: 0` and box-sizing's `border-box` are
    // not surfaces — the assertions match the painted forms.)
    const commentFree = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const withoutBoxed = commentFree.replace(
      /\.hk-empty-state--boxed\s*\{[^}]*\}/g,
      "",
    );
    expect(withoutBoxed).not.toContain("background:");
    expect(withoutBoxed).not.toContain("backdrop-filter:");
    expect(withoutBoxed).not.toContain("border: 1px");
    expect(withoutBoxed).not.toContain("border-radius:");
  });
});
