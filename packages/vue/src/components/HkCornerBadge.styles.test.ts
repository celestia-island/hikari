import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for HkCornerBadge — the anchoring contract
 * (2026-10-15, two placement families since 2026-11-05): the anchor
 * wrapper is a relative inline-flex host (any child can carry the mark);
 * the four CORNER placements overlay it, centering ON the corner via
 * translate(±50%,±50%) with each data-placement flipping the right axes;
 * the SIDE placements (`right` / `left`) return the mark to the flow,
 * centered on the wrapper's row by `align-self: center`, and the mark's
 * own margin spaces it from the anchor (gap + offset), so the anchor's
 * own box — and its other children's alignment — is never touched.
 * Vitest stubs CSS, so the runtime suite can never catch a lost rule.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

const css = compile(resolve(componentDir, "HkCornerBadge.scss"), {
  style: "expanded",
}).css;

function ruleFor(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `${selector} present in the compiled sheet`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(start, close + 1);
}

describe("HkCornerBadge stylesheet contract", () => {
  it("compiles", () => {
    expect(css).toContain(".hk-corner-badge");
  });

  it("the anchor is a relative inline-flex wrapper (any child carries the mark)", () => {
    const rule = ruleFor(".hk-corner-badge-anchor {");
    expect(rule).toContain("position: relative");
    expect(rule).toContain("display: inline-flex");
  });

  it("the mark never takes pointer events and never wraps", () => {
    const rule = ruleFor(".hk-corner-badge {");
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("pointer-events: none");
    expect(rule).toContain("white-space: nowrap");
  });

  it("each corner flips the translate axes", () => {
    expect(ruleFor('.hk-corner-badge[data-placement=top-right] {')).toContain("--hk-corner-badge-tx: 50%");
    expect(ruleFor('.hk-corner-badge[data-placement=top-left] {')).toContain("--hk-corner-badge-tx: -50%");
    expect(ruleFor('.hk-corner-badge[data-placement=bottom-right] {')).toContain("--hk-corner-badge-ty: 50%");
    expect(ruleFor('.hk-corner-badge[data-placement=bottom-left] {')).toContain("--hk-corner-badge-tx: -50%");
  });

  it("side placements return to the flow and space themselves from the anchor", () => {
    const right = ruleFor('.hk-corner-badge[data-placement=right] {');
    expect(right).toContain("position: static");
    expect(right).toContain("transform: none");
    expect(right).toContain("align-self: center");
    expect(right).toContain("margin-inline-start: calc(var(--hk-corner-badge-gap");
    const left = ruleFor('.hk-corner-badge[data-placement=left] {');
    expect(left).toContain("position: static");
    expect(left).toContain("align-self: center");
    expect(left).toContain("order: -1");
    expect(left).toContain("margin-inline-end: calc(var(--hk-corner-badge-gap");
  });

  it("the dot is round and the pill is a tabular-numbers chip", () => {
    const dot = ruleFor(".hk-corner-badge--dot {");
    expect(dot).toContain("border-radius: 50%");
    const pill = ruleFor(".hk-corner-badge--pill {");
    expect(pill).toContain("font-variant-numeric: tabular-nums");
  });
});
