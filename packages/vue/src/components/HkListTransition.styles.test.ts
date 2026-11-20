/**
 * Compiled-CSS pins for the pop variant's LEAVE rule (2026-11-20).
 *
 * `HkListTransition.scss` is compiled twice (Vue + the Rust-side
 * vue-mirror) and nothing read the sheet, so a revert of the two
 * properties below stayed green repo-wide (2026-11-20 review, mutation
 * M9: the whole 6616-test suite passed with the rule deleted; only the
 * mirror-drift check noticed, and a two-copy edit defeats that).
 *
 * Pinned like its sibling variant (HkModalBreadcrumb.motion.contract
 * .test.ts pins `.hk-list-surface-leave-active` the same way):
 *
 *  - a dying row takes no clicks. The primitive's `inert` pin covers it
 *    only when layout metrics exist, so the CSS belt is what still
 *    dead-ends a tap in a non-layout environment or when the pin
 *    skipped. The bell is the first `pop` consumer whose rows carry
 *    buttons (copy / dismiss / restore).
 *  - reduced motion really drops the choreography (house pattern).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = compile(join(here, "HkListTransition.scss"), {
  loadPaths: [here, join(here, "..", "styles")],
  style: "expanded",
}).css;

/** Body of the first top-level `selector { … }` block. */
function rule(cssText: string, selector: string): string {
  const start = cssText.indexOf(`${selector} {`);
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

/** Top-level `@media` block body (brace matched). */
function mediaBlock(cssText: string, headPrefix: string): string {
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

describe("HkListTransition pop variant", () => {
  it("the leaving ghost is out of flow and takes no clicks", () => {
    const leave = rule(css, ".hk-list-pop-leave-active");
    expect(leave, "the pop leave-active rule compiles").not.toBe("");
    // The primitive pins the ghost's box from its pre-patch offsets while
    // this rule lifts it out of flow — the pin's premise.
    expect(leave).toContain("position: absolute");
    // A fading row must not swallow a click meant for what is underneath
    // it (or for the row that just slid up under the cursor).
    expect(leave).toContain("pointer-events: none");
  });

  it("reduced motion collapses every variant's leave", () => {
    const media = mediaBlock(css, "@media (prefers-reduced-motion: reduce)");
    expect(media, "the reduced-motion block compiles").not.toBe("");
    for (const variant of ["pop", "slide", "fade", "grow", "reveal", "surface"]) {
      expect(media, `${variant} leave collapses`).toContain(
        `.hk-list-${variant}-leave-active`,
      );
    }
  });
});
