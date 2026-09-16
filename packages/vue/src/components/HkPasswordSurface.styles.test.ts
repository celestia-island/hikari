import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Affix interactivity contract for the password surface
 * (HkInput variant="password").
 *
 * The invisible native input spans the whole box (absolute inset:0,
 * z-index 2), so ANY consumer-provided affix content must ride above it
 * with pointer-events enabled — the text variants' affixes are ordinary
 * in-flow spans and a button inside them just works. The suffix berth
 * (.hk-pwd-suffix) and the caller-content prefix berth
 * (.hk-pwd-lock-custom) are the two places slots land; both must lift to
 * the interactive plane (z 3 + pointer-events auto). The DEFAULT lock
 * glyph stays decorative and click-through so it never steals focus from
 * the field (2026-09-17 round-4 audit finding F1: the prefix mirror of
 * the suffix lift was missing — a button in #prefix rendered dead).
 */
const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

function surfaceCss(): string {
  const file = resolve(componentDir, "HkPasswordSurface.scss");
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

describe("HkPasswordSurface affix interactivity", () => {
  const css = surfaceCss();

  it("compiles", () => {
    expect(css.length).toBeGreaterThan(0);
    // Sanity anchor so a renamed file cannot hollow this guard.
    expect(css).toContain(".hk-pwd-box");
  });

  it("lifts caller prefix content above the invisible input", () => {
    const body = ruleBody(css, ".hk-pwd-lock.hk-pwd-lock-custom");
    expect(body, "the custom-prefix lift rule exists").not.toBeNull();
    expect(body).toContain("pointer-events: auto");
    expect(body).toContain("z-index: 3");
  });

  it("lifts the suffix berth the same way", () => {
    const body = ruleBody(css, ".hk-pwd-suffix");
    expect(body).not.toBeNull();
    expect(body).toContain("pointer-events: auto");
    expect(body).toContain("z-index: 3");
  });

  it("keeps the default lock decorative and click-through", () => {
    const body = ruleBody(css, ".hk-pwd-lock");
    expect(body).not.toBeNull();
    expect(body).toContain("pointer-events: none");
    expect(body).not.toContain("z-index: 3");
  });
});
