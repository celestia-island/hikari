import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for HkAboutModal.
 *
 * Vitest stubs CSS (`test.css` is off), so the runtime suite can never catch
 * a class the component emits that lost its rule — the #493 redesign dropped
 * the `.s-about-modal-links` rule while keeping the element and every test
 * stayed green. This test compiles the component sheet directly and asserts
 * both directions of the class contract:
 *
 *   1. every `s-about-modal-*` class the TSX renders has a rule, and
 *   2. every `s-about-modal-*` rule in the sheet is rendered by the TSX
 *      (no dead selectors).
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

function classesFrom(source: string): Set<string> {
  // The component only uses static class strings; collect them from the
  // `class="…"` attributes plus any bare `s-about-modal-*` token.
  const found = new Set<string>();
  for (const match of source.matchAll(/s-about-modal[\w-]*/g)) found.add(match[0]);
  return found;
}

describe("HkAboutModal stylesheet contract", () => {
  const tsx = readFileSync(resolve(componentDir, "HkAboutModal.tsx"), "utf8");
  const scss = readFileSync(resolve(componentDir, "HkAboutModal.scss"), "utf8");
  const css = compile(resolve(componentDir, "HkAboutModal.scss"), {
    style: "expanded",
  }).css;

  it("compiles without warnings", () => {
    expect(css).toContain(".s-about-modal");
  });

  it("gives every emitted class a rule", () => {
    // Selector-side scan of the compiled sheet (not the SCSS source): a rule
    // that failed to compile would otherwise still count as "present".
    const declared = new Set([...css.matchAll(/\.(s-about-modal[\w-]*)/g)].map((m) => m[1]!));
    const missing = [...classesFrom(tsx)].filter((name) => !declared.has(name)).sort();
    expect(missing, "classes rendered without a stylesheet rule").toEqual([]);
  });

  it("declares no rule the component never renders", () => {
    const rendered = classesFrom(tsx);
    const dead = [...new Set([...scss.matchAll(/\.(s-about-modal[\w-]*)/g)].map((m) => m[1]!))]
      .filter((name) => !rendered.has(name))
      .sort();
    expect(dead, "stylesheet selectors with no matching element").toEqual([]);
  });

  /**
   * Declaration-level guards for the two link faces.
   *
   * The checks above only compare class *names*, so the whole
   * `[data-face="plain"]` contract — the part the user actually asked for —
   * was invisible to them: emptying that rule (Dart Sass then drops the
   * selector entirely), re-adding a pill padding, or losing `font-size:
   * inherit` all left the suite green while turning bare text links back
   * into chips. These assertions read the compiled declarations instead.
   */
  describe("link faces", () => {
    /**
     * Body of one compiled rule, by exact selector (Sass drops the quotes
     * around an attribute value: `[data-face=plain]`).
     *
     * The selector must compile exactly once: a second copy — say inside a
     * media query, or a later override — would otherwise stay invisible here
     * while still winning the cascade.
     */
    function ruleBody(sheet: string, selector: string): string {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = [...sheet.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))];
      expect(matches, `${selector} compiles exactly once`).toHaveLength(1);
      return matches[0]?.[1] ?? "";
    }

    /**
     * One declaration's value inside a rule body.
     *
     * A property declared twice is a failure rather than a coincidence: CSS
     * resolves a repeat last-wins, so a first-match reader would report the
     * stale value and happily accept the override.
     */
    function declaration(body: string, property: string): string {
      const values = [
        ...body.matchAll(new RegExp(`(?:^|;)\\s*${property}\\s*:([^;]*)`, "g")),
      ].map((match) => match[1]!.trim());
      expect(values.length, `${property} is declared at most once`).toBeLessThanOrEqual(1);
      return values[0] ?? "";
    }

    const PLAIN = ".s-about-modal-link[data-face=plain]";

    it("keeps the plain face a bare text link", () => {
      const plain = ruleBody(css, PLAIN);
      expect(plain, "the plain-face rule must survive compilation").not.toBe("");
      expect({
        padding: declaration(plain, "padding"),
        border: declaration(plain, "border"),
        radius: declaration(plain, "border-radius"),
        background: declaration(plain, "background"),
        // Inherited colour and size are what let a name melt into the credits
        // sentence (13px) or a domain into the 12px link row, instead of
        // keeping the chip's own 12px scale.
        color: declaration(plain, "color"),
        fontSize: declaration(plain, "font-size"),
        lineHeight: declaration(plain, "line-height"),
      }).toEqual({
        padding: "0",
        border: "0",
        radius: "0",
        background: "none",
        color: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
      });
      // Both faces promise "no underline" (these rows are text with a click
      // target, not document links): the base rule turns the UA underline off
      // and the plain face must not bring one back.
      expect(declaration(ruleBody(css, ".s-about-modal-link"), "text-decoration")).toBe("none");
      expect(declaration(plain, "text-decoration")).not.toContain("underline");
    });

    it("keeps the plain hover a colour shift, not a tinted box", () => {
      const hover = ruleBody(css, `${PLAIN}:hover`);
      expect(declaration(hover, "background")).toBe("none");
      expect(declaration(hover, "color")).toBe("rgb(var(--color-primary))");
      expect(declaration(ruleBody(css, `${PLAIN}:active`), "background")).toBe("none");
    });

    const ACCENT = ".s-about-modal-link[data-face=accent]";

    it("keeps the accent face a bare text link tinted in the primary colour", () => {
      const accent = ruleBody(css, ACCENT);
      expect(accent, "the accent-face rule must survive compilation").not.toBe("");
      expect({
        padding: declaration(accent, "padding"),
        border: declaration(accent, "border"),
        radius: declaration(accent, "border-radius"),
        background: declaration(accent, "background"),
        // The tint IS the face: bare geometry like `plain`, but the colour
        // comes from the theme's primary token rather than `inherit`.
        color: declaration(accent, "color"),
        fontSize: declaration(accent, "font-size"),
        lineHeight: declaration(accent, "line-height"),
      }).toEqual({
        padding: "0",
        border: "0",
        radius: "0",
        background: "none",
        color: "rgb(var(--color-primary))",
        fontSize: "inherit",
        lineHeight: "inherit",
      });
      // No underline at rest — the tint is the cue; the hover adds one.
      expect(declaration(accent, "text-decoration")).not.toContain("underline");
    });

    it("gives the accent hover an added cue beyond the resting tint", () => {
      // The accent face already rests in the primary colour, so a hover that
      // only re-set the same colour would be invisible — the deepened tint
      // plus the underline is the contract.
      const hover = ruleBody(css, `${ACCENT}:hover`);
      expect(declaration(hover, "background")).toBe("none");
      expect(declaration(hover, "text-decoration")).toContain("underline");
      expect(declaration(ruleBody(css, `${ACCENT}:active`), "background")).toBe("none");
    });

    it("keeps an icon link one aligned unit with a visible mark", () => {
      const iconLink = ruleBody(css, ".s-about-modal-link.s-about-modal-link-has-icon");
      expect(declaration(iconLink, "display")).toBe("inline-flex");
      expect(declaration(iconLink, "align-items")).toBe("center");
      // The wrapper is what the alignment hangs off — a hidden or collapsing
      // one takes the mark with it, leaving an icon-only link as an invisible
      // target (the failure the empty-entry filter exists to prevent).
      const iconWrap = ruleBody(css, ".s-about-modal-link-icon");
      expect(declaration(iconWrap, "flex-shrink")).toBe("0");
      expect(declaration(iconWrap, "display")).not.toBe("none");
      // Icon-only: the mark carries no text, so the padding is the target.
      expect(declaration(ruleBody(css, `${PLAIN}.s-about-modal-link-has-icon`), "padding")).toBe(
        "0 var(--space-6, 0.375rem)",
      );
    });

    it("sizes every row the plain face inherits from", () => {
      // The plain face inherits, so the rows own the type scale the chips used
      // to bring themselves (16px body text otherwise): the credits sentence
      // supplies the names' 13px, the link row the domains' 12px, the legal
      // row the filings' 10px.
      expect(declaration(ruleBody(css, ".s-about-modal-credits-line"), "font-size")).toBe(
        "var(--text-sm, 0.8125rem)",
      );
      expect(declaration(ruleBody(css, ".s-about-modal-links-list"), "font-size")).toBe(
        "var(--text-xs, 0.75rem)",
      );
      expect(declaration(ruleBody(css, ".s-about-modal-footer-links"), "font-size")).toBe(
        "var(--text-2xs, 0.625rem)",
      );
    });

    it("keeps the pill the hosts that ask for nothing already ship", () => {
      // The plain face is additive: a consumer passing `{ label, href }` must
      // keep exactly the tag it had, so the chip's geometry is pinned here
      // instead of being assumed.
      const chip = ruleBody(css, ".s-about-modal-link");
      expect(declaration(chip, "padding")).toBe(
        "var(--space-2, 0.125rem) var(--space-10, 0.625rem)",
      );
      expect(declaration(chip, "border")).toContain("1px solid var(--border-subtle");
      expect(declaration(chip, "border-radius")).toBe("var(--radius-full, 9999px)");
      expect(declaration(chip, "color")).toBe("rgb(var(--color-muted))");
    });

    it("keeps the icon rule after the plain rule it refines", () => {
      // Both are (0,2,0), so source order is the only thing that turns an
      // icon link into inline-flex rather than the plain `inline` — the
      // tie-break is part of the contract, not an accident of file layout.
      const plainAt = css.indexOf(`${PLAIN} {`);
      const iconAt = css.indexOf(".s-about-modal-link.s-about-modal-link-has-icon {");
      expect(plainAt).toBeGreaterThanOrEqual(0);
      expect(iconAt).toBeGreaterThan(plainAt);
    });
  });
});
