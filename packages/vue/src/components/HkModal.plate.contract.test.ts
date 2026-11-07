/**
 * Compiled-CSS contract for the modal BLUR PLATE — the open-stutter fix.
 *
 * Measured root cause (2026-11-07 open-jank spike, headless rAF matrix):
 * a backdrop-filter re-filters its full-viewport backdrop on EVERY
 * composited frame while any animation is live anywhere — the enter
 * storm (frame + dim + strip + crumbs mounting together) ran at
 * 26-55% dropped frames with live plates, while the steady state
 * (nothing animating) is cached and runs 60fps. The architecture:
 *
 *   1. the blur lives on a STATIC plate that never animates and never
 *      carries a transition;
 *   2. the eye-tracked transition is the solid-color dim curtain
 *      (opacity-only composite);
 *   3. the plate is REMOVED on stack-covered windows (a present
 *      backdrop-filter element still forces the per-frame backdrop
 *      surface even computed to none — measured ~44pp worse than
 *      hidden);
 *   4. the overlay carries the default blur only for plate-less markup
 *      (the Rust-rendered modals share this compiled sheet without a
 *      plate element) and opts down to dim-only document-globally when
 *      a Vue plate exists.
 *
 * Regression risk this file pins: a future edit re-adding a
 * backdrop-filter to `.hk-modal-overlay` would double-filter the Vue
 * path and reintroduce the jank; re-adding an enter/leave-scoped
 * suppression leg would reintroduce the settle hitch; relaxing the
 * covered drop would reintroduce the stacked-blur storm.
 */
import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "sass";

const here = dirname(fileURLToPath(import.meta.url));
const css = compile(join(here, "HkModal.scss"), {
  loadPaths: [here, join(here, "..", "styles")],
  style: "expanded",
}).css;

/** Brace-matched body of the first top-level block whose head starts
 *  with the given prefix (`@media …` or a selector). */
function topBlock(cssText: string, headPrefix: string): string {
  const start = cssText.indexOf(headPrefix);
  if (start === -1) return "";
  const open = cssText.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < cssText.length; i++) {
    if (cssText[i] === "{") depth += 1;
    else if (cssText[i] === "}") {
      depth -= 1;
      if (depth === 0) return cssText.slice(open + 1, i);
    }
  }
  return "";
}

/** All `selector { body }` frames inside a block (one nesting level deep
 *  is enough). Selector parts carry preceding block-glue in expanded
 *  output (media heads, comment remains) — trimmed to the bare
 *  selector. */
function frames(block: string): { selectors: string[]; body: string }[] {
  const out: { selectors: string[]; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    out.push({
      selectors: m[1]
        .split(",")
        .map((part) => {
          let t = part;
          const comment = t.lastIndexOf("*/");
          if (comment !== -1) t = t.slice(comment + 2);
          const brace = t.lastIndexOf("{");
          if (brace !== -1) t = t.slice(brace + 1);
          const semi = t.lastIndexOf(";");
          if (semi !== -1) t = t.slice(semi + 1);
          return t.trim();
        })
        .filter((s) => s.startsWith(".") || s.startsWith("[") || s.startsWith(":")),
      body: m[2].trim(),
    });
  }
  return out;
}

/** Bodies of every rule whose selector LIST includes exactly `selector`. */
function ruleBodies(sheet: string, selector: string): string[] {
  return frames(sheet)
    .filter((f) => f.selectors.includes(selector))
    .map((f) => f.body);
}
const oneRule = (sheet: string, selector: string): string => {
  const bodies = ruleBodies(sheet, selector);
  expect(bodies.length, `rule ${selector} must exist`).toBeGreaterThan(0);
  return bodies[0];
};

const mobileBlock = topBlock(css, "@media (max-width: 767px)");

describe("modal blur plate (static filter, stack-covered removal)", () => {
  it("carries the blur; the fading overlay must NOT (vue path)", () => {
    // The core invariant: the overlay is the ANIMATED layer — a
    // backdrop-filter on it re-filters the whole viewport per frame
    // (the reported stutter). The blur lives on the never-animated
    // plate only.
    const plate = oneRule(css, ".hk-modal-blur-plate");
    expect(plate).toMatch(/backdrop-filter:\s*var\(--hk-modal-overlay-blur/);
    expect(plate).toContain("pointer-events: none");
    expect(plate).toContain("z-index: -1");
  });

  it("gives plate-less markup (rust-rendered modals) the overlay blur", () => {
    // The Rust-rendered modals share this compiled sheet but their
    // markup has no plate element: the overlay keeps the default blur
    // there.
    const overlayDefault = ruleBodies(css, ".hk-modal-overlay").find((b) =>
      b.includes("backdrop-filter: var(--hk-modal-overlay-blur"),
    );
    expect(overlayDefault, "default overlay blur must exist").toBeTruthy();
  });

  it("opts the overlay down to dim-only wherever a plate exists", () => {
    // :root:has(plate) is document-global: one Vue modal anywhere means
    // every overlay in the document is plate-backed and dim-only.
    expect(css).toMatch(
      /:root:has\(\.hk-modal-blur-plate\)\s*\.hk-modal-overlay\s*\{[^}]*backdrop-filter:\s*none/,
    );
  });

  it("removes the plate on stack-covered windows", () => {
    // A present backdrop-filter element still forces the per-frame
    // backdrop surface even computed to none (~44pp worse than hidden).
    const covered = ruleBodies(css, ".hk-modal-root[data-stack-covered] .hk-modal-blur-plate");
    expect(covered.length).toBeGreaterThanOrEqual(1);
    for (const body of covered) expect(body).toContain("display: none");
  });

  it("keeps no enter/leave-scoped suppression legs (the top plate animates with the filter)", () => {
    // The top plate's own enter measured 2% dropped WITH the filter
    // live (single live blur) — suppression legs were removed with the
    // settle hitch they created. Re-adding any leg must be a deliberate
    // re-trade.
    expect(css).not.toMatch(
      /hk-modal-content-(?:enter|leave)-(?:from|to|active) ~ \.hk-modal-blur-plate/,
    );
  });

  it("keeps the mobile stand-down on both faces", () => {
    expect(mobileBlock).toContain(".hk-modal-blur-plate");
    expect(frames(mobileBlock).some((f) => f.selectors.includes(".hk-modal-blur-plate"))).toBe(true);
    // The Vue-path opt-out must hold on phones too.
    expect(mobileBlock).toMatch(
      /:root:has\(\.hk-modal-blur-plate\)\s*\.hk-modal-overlay\s*\{[^}]*backdrop-filter:\s*none/,
    );
  });
});
