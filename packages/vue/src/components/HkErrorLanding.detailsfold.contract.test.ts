import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Source contract: the error landing's raw-details pane follows its
 * content under a hard ceiling (2026-10-01 screenshot round). The frame
 * used to stand at a fixed ~20vh — folding the tree then left a tall
 * empty box behind a single summary row. The pane now hugs the payload
 * (max-height cap + inheriting body) while tall stack traces still clamp
 * and scroll inside the frame. These pins keep the standing-frame
 * regression class (any `height:` declaration here re-pins the box) and
 * the unbounded-growth class (a missing body cap) out.
 */
const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkErrorLanding.scss"), "utf-8");

describe("HkErrorLanding details fold contract", () => {
  const paneAt = scss.indexOf(".hk-error-landing__details-pane {");
  const bodyAt = scss.indexOf(".hk-error-landing__details-body {");

  it("declares the pane and body exactly once — no late re-declaration", () => {
    // Whole-file site count: the slice-scoped sweeps below read only up
    // to the nested tree rule, so a LATER `.hk-error-landing__details-
    // body { height: ... }` in this file would cascade over the fold
    // while every slice pin stays green (R3's M4 mutation proved it).
    // Pristine file has exactly two sites (pane + body); the descendant
    // `.s-tool-json-tree` rule and the label/toggle selectors don't match.
    const sites = scss.match(/\.hk-error-landing__details-(?:pane|body)\s*[,{]/g) ?? [];
    expect(sites.length, `details pane/body selector sites = ${sites.join(" | ")}`).toBe(2);
  });

  it("sizes the pane by cap, never by fixed height", () => {
    expect(paneAt, "pane rule present").toBeGreaterThanOrEqual(0);
    const pane = scss.slice(paneAt, bodyAt);
    // Both viewport lines: the vh fallback pairs with the dvh override,
    // matching the family pattern.
    expect(pane).toContain("max-height: max(9rem, 20vh)");
    expect(pane).toContain("max-height: max(9rem, 20dvh)");
    // ANY height/min-height declaration re-pins the standing frame —
    // exactly the regression this fold fixes (a min-height would force
    // the folded pane back up; R2 F3) — so the pane carries none.
    const heights = [...pane.matchAll(/^\s*(?:min-)?height:.*$/gm)].map((m) => m[0].trim());
    expect(heights, `pane height declarations = ${JSON.stringify(heights)}`).toEqual([]);
  });

  it("clamps the scrolling body with the inherited pane cap", () => {
    expect(bodyAt, "body rule present").toBeGreaterThanOrEqual(0);
    const nextAt = scss.indexOf(".hk-error-landing__details-body .s-tool-json-tree");
    const body = scss.slice(bodyAt, nextAt);
    // Percentage height against an auto-height parent is circular; the
    // body must take the pane's cap itself.
    expect(body).toContain("max-height: inherit");
    // A fixed body height re-pins the standing frame through the back
    // door even with the inherit present (R2 F2) — same sweep as the
    // pane: no height/min-height declarations at all.
    const bodyHeights = [...body.matchAll(/^\s*(?:min-)?height:.*$/gm)].map((m) => m[0].trim());
    expect(bodyHeights, `body height declarations = ${JSON.stringify(bodyHeights)}`).toEqual([]);
    // The clamp only bites when the body may actually shrink and scroll.
    expect(body).toContain("overflow: auto");
  });
});
