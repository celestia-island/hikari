import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Source contract: the error landing's raw-details pane is a STANDING
 * frame — the larger of 9rem and ~20vh, fixed. The frame must never
 * breathe with its content: the 2026-10-01 content-hugging experiment
 * (max-height cap + inheriting body) shipped and was reverted the same
 * day after mobile review — folding the tree shrank the whole error card
 * and the jumping height read as broken. These pins keep BOTH regression
 * classes out: the breathing class (max-height instead of height on the
 * pane, an inheriting/max-capped body) and the late-re-declaration class
 * (a later same-file override re-pinning either box).
 */
const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkErrorLanding.scss"), "utf-8");

describe("HkErrorLanding standing frame contract", () => {
  const paneAt = scss.indexOf(".hk-error-landing__details-pane {");
  const bodyAt = scss.indexOf(".hk-error-landing__details-body {");

  it("declares the pane and body exactly once — no late re-declaration", () => {
    // Whole-file site count: the slice-scoped sweeps below read only up
    // to the nested tree rule, so a LATER `.hk-error-landing__details-
    // body { height: ... }` in this file would cascade over the frame
    // while every slice pin stays green (the R3-M4 mutation class).
    // Pristine file has exactly two sites (pane + body); the descendant
    // `.s-tool-json-tree` rule and the label/toggle selectors don't match.
    // Keep this pin at strict equality — softening it to >= silently
    // reopens the late-re-declaration class.
    const sites = scss.match(/\.hk-error-landing__details-(?:pane|body)\s*[,{]/g) ?? [];
    expect(sites.length, `details pane/body selector sites = ${sites.join(" | ")}`).toBe(2);
  });

  it("fixes the pane at the standing frame, never a content-driven cap", () => {
    expect(paneAt, "pane rule present").toBeGreaterThanOrEqual(0);
    const pane = scss.slice(paneAt, bodyAt);
    // Both viewport lines: the vh fallback pairs with the dvh override,
    // matching the family pattern.
    expect(pane).toContain("height: max(9rem, 20vh)");
    expect(pane).toContain("height: max(9rem, 20dvh)");
    // Every height declaration must BE the frame pair — a later `height:
    // auto` (or an extra one) would let the frame breathe again.
    const heights = [...pane.matchAll(/^\s*height:.*$/gm)].map((m) => m[0].trim());
    expect(heights.length, `pane height declarations = ${JSON.stringify(heights)}`).toBe(2);
    for (const value of heights) expect(value).toMatch(/^height: max\(9rem, 20d?vh\);$/);
    // A content-driven cap is EXACTLY the reverted breathing frame.
    expect(pane).not.toContain("max-height:");
    expect(pane).not.toContain("min-height:");
  });

  it("fills the fixed frame instead of hugging the payload", () => {
    expect(bodyAt, "body rule present").toBeGreaterThanOrEqual(0);
    const nextAt = scss.indexOf(".hk-error-landing__details-body .s-tool-json-tree");
    // The slice boundary is load-bearing: the sweeps below must never
    // silently extend to EOF (where unrelated rules would trip them).
    expect(nextAt, "tree-neutering rule present").toBeGreaterThanOrEqual(0);
    const body = scss.slice(bodyAt, nextAt);
    // The body fills the fixed frame — its ONLY height declaration is
    // the 100% fill; any other height (auto/inherit/max cap) is the
    // reverted content-hugging regression (the R2-M-D mutation class).
    const bodyHeights = [...body.matchAll(/^\s*height:.*$/gm)].map((m) => m[0].trim());
    expect(bodyHeights, `body height declarations = ${JSON.stringify(bodyHeights)}`).toEqual(["height: 100%;"]);
    expect(body).not.toContain("max-height:");
    expect(body).not.toContain("min-height:");
    // Long content still scrolls inside the frame.
    expect(body).toContain("overflow: auto");
  });

  it("keeps the mobile dvh override after its vh fallback", () => {
    // The pair is order-sensitive by convention (the later dvh line wins
    // where dvh is supported); nothing may reorder or deduplicate it.
    const vhAt = scss.indexOf("height: max(9rem, 20vh)");
    const dvhAt = scss.indexOf("height: max(9rem, 20dvh)");
    expect(vhAt, "vh fallback present").toBeGreaterThanOrEqual(0);
    expect(dvhAt, "dvh override present").toBeGreaterThan(vhAt);
  });
});
