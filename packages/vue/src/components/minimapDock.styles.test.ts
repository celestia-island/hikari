import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for the minimap DOCK contract: a positioned
 * dock wrapper (HkNodeCanvas's `.hk-node-canvas-minimap`, HkBoard's
 * `.hk-board-minimap`) owns the corner inset, and the docked card is
 * reset to `position: static` so it sizes the dock's shrink-to-fit box.
 * Without the reset the card stacked its own self-docking absolute
 * offset (`.hk-minimap`'s bottom + inset-inline-end) on top of the
 * dock's, and the map sat twice as far from its corner as designed —
 * measurably lopsided against the undocked axes. Vitest stubs CSS, so
 * the runtime suites can never catch a lost rule; this reads the
 * compiled sheet.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

function compileSheet(name: string): string {
  return compile(resolve(componentDir, name), { style: "expanded" }).css;
}

const canvasCss = compileSheet("HkNodeCanvas.scss");
const boardCss = compileSheet("HkBoard.scss");

function ruleFor(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `${selector} present in the compiled sheet`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(start, close + 1);
}

describe("minimap dock stylesheet contract", () => {
  it("HkNodeCanvas's wrapper is the single anchor: the docked card is static", () => {
    const rule = ruleFor(canvasCss, ".hk-node-canvas-minimap > .hk-minimap");
    expect(rule).toContain("position: static");
  });

  it("HkBoard's dock is the single anchor: the docked card is static", () => {
    const rule = ruleFor(boardCss, ".hk-board-minimap > .hk-minimap");
    expect(rule).toContain("position: static");
  });

  it("the docks keep their own corner insets (the anchor that remains)", () => {
    // The wrapper still carries the placement insets — the static card
    // has not REPLACED the dock's geometry, only stopped doubling it.
    // (Compiled attribute selectors lose their quotes: bottom-right.)
    expect(canvasCss).toContain(".hk-node-canvas-minimap[data-placement=bottom-right]");
    const dock = ruleFor(boardCss, ".hk-board-minimap");
    expect(dock).toContain("position: absolute");
    expect(dock).toContain("inset-inline-end");
    expect(dock).toContain("bottom");
  });

  it("the card's self-docking form survives for direct mounts", () => {
    // TreemapStage / HkBoard3D mount the card directly on a positioned
    // surface with no dock wrapper — the root rule must keep its own
    // absolute corner for them.
    const minimapCss = compileSheet("HkMinimap.scss");
    const root = ruleFor(minimapCss, ".hk-minimap {");
    expect(root).toContain("position: absolute");
  });

  it("the static reset survives sheet read round-trips (no @extend loss)", () => {
    // The selector is plain and direct (no nesting tricks), so a future
    // Sass rewrite cannot silently drop it from the compiled output.
    expect(canvasCss.match(/position: static/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(boardCss.match(/position: static/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("board scss raw source still documents the single-anchor reason", () => {
    // The WHY lives next to the rule (comments are stripped from the
    // compiled output, so guard the source text).
    const src = readFileSync(resolve(componentDir, "HkBoard.scss"), "utf8");
    expect(src).toContain("ONE anchor");
  });
});
