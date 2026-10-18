/**
 * Source contract for the strip's trigger/reveal interaction face.
 *
 * The behavioural suite runs in happy-dom, which resolves no theme
 * custom properties — a rule that falls back to a WRONG literal paints
 * fine in the suite and breaks only in a real theme. That is exactly
 * what shipped: the hover/open faces colored their glyphs with a
 * var() reference to --hi-color-text (fallback #1f2328) — a token NO
 * theme defines (the family spells it --hi-color-text-primary), so the
 * light-theme ink #1f2328 won
 * — and on a phone the tap leaves :hover stuck, making the "…" trigger
 * near-invisible on every dark theme right after the tap (2026-10-18
 * user report). The pins live here, next to the reason each exists.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkModalBreadcrumb.scss"), "utf-8");

function rule(selector: string): string {
  return scss.match(new RegExp(`${selector}\\s*{[^}]*}`, "m"))?.[0] ?? "";
}

describe("HkModalBreadcrumb trigger face tokens", () => {
  it("never references the nonexistent --hi-color-text alias", () => {
    // The alias family defines --hi-color-text-primary; --hi-color-text
    // does not exist, so any var() use silently takes its light-theme
    // fallback. (Matched as var() usage so prose in comments about the
    // alias itself stays legal.)
    expect(scss).not.toMatch(/var\(\s*--hi-color-text[,)]/);
  });

  it("paints the trigger's hover AND open face from live theme tokens", () => {
    // One legible face for both states: the tap on a phone leaves :hover
    // stuck on the trigger, so aria-expanded must share the rule.
    const group = scss.match(
      /\.hk-modal-breadcrumb-more:hover,\s*\n\.hk-modal-breadcrumb-more\[aria-expanded="true"\]\s*{[^}]*}/,
    )?.[0];
    expect(group).toBeTruthy();
    expect(group).toContain("var(--hi-color-text-primary");
    // The wash falls back to the menu-item grammar's own primary-subtle —
    // a raw rgba(0,0,0,…) fallback vanished on dark surfaces.
    expect(group).toContain("var(--c-primary-subtle");
    expect(group).not.toContain("rgba(0, 0, 0");
    // The host knob still wins when declared.
    expect(group).toContain("--hk-breadcrumb-more-hover");
  });

  it("gives the cut-label reveal button the same token contract", () => {
    const group = scss.match(
      /\.hk-modal-breadcrumb-item-reveal:hover,\s*\n\.hk-modal-breadcrumb-item-reveal\[aria-expanded="true"\]\s*{[^}]*}/,
    )?.[0];
    expect(group).toBeTruthy();
    expect(group).toContain("var(--hi-color-text-primary");
    expect(group).toContain("var(--c-primary-subtle");
    expect(group).not.toContain("rgba(0, 0, 0");
  });

  it("keeps the base faces on the tokens the strip already used", () => {
    // Untouched by the fix, pinned so a refactor cannot quietly
    // reintroduce a raw literal here either.
    expect(rule(".hk-modal-breadcrumb-more")).toContain(
      "color: var(--hi-color-text-secondary",
    );
    expect(rule(".hk-modal-breadcrumb-item")).toContain(
      "color: var(--hi-color-text-secondary",
    );
  });

  it("colors the revealed full name from a live token too", () => {
    // The reveal body text rode the same broken alias — near-black ink
    // on every dark theme.
    expect(rule(".hk-modal-breadcrumb-reveal")).toContain(
      "color: var(--hi-color-text-primary",
    );
  });
});
