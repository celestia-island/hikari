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
 * item sat flush against the footer boundary), so the rail now declares
 * an option-sized `--hk-sidebar-scroll-tail` and both density variants
 * of the body spend it as their block-end padding.
 *
 * The assertions run on the COMPILED sheet, not the source text, so a
 * declaration cannot hide behind SCSS nesting, and comments are stripped
 * first so a commented-out tail cannot keep a hollow guard green.
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

  it("keeps the same tail on the collapsed body", () => {
    const body = ruleBody(css, ".hk-sidebar[data-collapsed] .hk-sidebar-body");
    expect(body, "the collapsed body rule exists").not.toBeNull();
    expect(body).toContain("padding-block: var(--space-12) var(--hk-sidebar-scroll-tail)");
  });

  it("reads the tail fallback from the scss source, not a drifted literal", () => {
    // The fallback lives once, next to the token it mirrors — pin the
    // source line so a retune of the token cannot leave a stale literal
    // behind (the compiled-sheet pins above would both have to move).
    const source = readFileSync(resolve(componentDir, "HkSidebar.scss"), "utf8");
    expect(source).toContain("--hk-sidebar-scroll-tail: var(--space-24, 1.5rem);");
  });

  it("declares the tail token exactly once in the sheet", () => {
    // The rule-body pins above inspect only specific rules, so a second
    // --hk-sidebar-scroll-tail declaration sneaking into a mid-tree rule
    // (.hk-sidebar-panel, .hk-sidebar-body-wrap, the collapsed block)
    // would silently re-kill the host knob — nearest-ancestor
    // declaration wins over the rail's — while every pin stays green.
    // Counting the source occurrences closes that hollow path (and
    // enforces the fallback's uniqueness for real, unlike toContain).
    const source = readFileSync(resolve(componentDir, "HkSidebar.scss"), "utf8");
    expect(source.match(/--hk-sidebar-scroll-tail:\s/g)).toHaveLength(1);
  });
});
