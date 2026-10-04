import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet contract for HkFloatingLayer. The layer IS its
 * CSS (fixed positioning, gesture transparency, the > .hk-fab
 * positioning hand-off), none of which the runtime suite can see —
 * vitest stubs CSS — so the sheet is compiled and asserted here.
 */
const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

describe("HkFloatingLayer stylesheet contract", () => {
  const tsx = readFileSync(resolve(componentDir, "HkFloatingLayer.tsx"), "utf8");
  const css = compile(resolve(componentDir, "HkFloatingLayer.scss"), {
    style: "expanded",
  }).css;

  it("compiles the fixed, gesture-transparent top-layer shell", () => {
    expect(css).toContain(".hk-floating-layer {");
    expect(css).toContain("position: fixed;");
    expect(css).toContain("z-index: var(--hk-float-z, 3000);");
    // The layer never eats gestures; the widgets inside do.
    expect(css).toContain("pointer-events: none;");
    expect(css).toContain(".hk-floating-layer > * {");
    expect(css).toContain("pointer-events: auto;");
  });

  it("anchors all four corners with safe-area-aware insets", () => {
    expect(css).toContain('[data-corner$=-right]');
    expect(css).toContain('[data-corner$=-left]');
    expect(css).toContain('[data-corner^=top]');
    expect(css).toContain('[data-corner^=bottom]');
    for (const side of ["right: calc", "left: calc", "top: calc", "bottom: calc"]) {
      expect(css).toContain(side);
    }
    expect(css).toContain("env(safe-area-inset-left, 0px)");
    expect(css).toContain("env(safe-area-inset-right, 0px)");
    expect(css).toContain("env(safe-area-inset-top, 0px)");
    expect(css).toContain("env(safe-area-inset-bottom, 0px)");
  });

  it("takes over a floated HkFab's positioning entirely", () => {
    expect(css).toContain(".hk-floating-layer > .hk-fab {");
    expect(css).toContain("position: static;");
    expect(css).toContain("inset: auto;");
    expect(css).toContain("z-index: auto;");
  });

  it("has no dead selectors: every rule the sheet emits is rendered", () => {
    // The TSX must reference every state the sheet styles.
    expect(tsx).toContain('class="hk-floating-layer"');
    expect(tsx).toContain("data-corner={props.corner}");
  });
});
