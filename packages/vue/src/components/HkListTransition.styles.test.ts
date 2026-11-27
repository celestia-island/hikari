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

/** Body of the first top-level `selector { … }` block — a selector LIST
 *  (`.a,\n.b,\n.c {`) matches on any of its members. */
function rule(cssText: string, selector: string): string {
  let start = cssText.indexOf(`${selector} {`);
  if (start === -1) start = cssText.indexOf(`${selector},`);
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

  it("reduced motion collapses EVERY track, the move tracks included (2026-11-27 R15)", () => {
    // The family's honest scope: a `prefers-reduced-motion` host must lose
    // the whole choreography, not just the fades. Only `surface` was
    // asserted here (its window sibling pins surface too), so dropping
    // `reveal-move` — and the entire move group, five of six selectors —
    // from this media block left the whole suite green (2026-11-27 R15).
    // Enumerate all 18 tracks the `!important` sweep knows, so a new
    // variant cannot join the family without joining the collapse.
    const media = mediaBlock(css, "@media (prefers-reduced-motion: reduce)");
    const tracks = [
      ".hk-list-pop-move", ".hk-list-slide-move", ".hk-list-fade-move", ".hk-list-grow-move",
      ".hk-list-reveal-move", ".hk-list-surface-move",
      ".hk-list-pop-enter-active", ".hk-list-pop-leave-active",
      ".hk-list-slide-enter-active", ".hk-list-slide-leave-active",
      ".hk-list-fade-enter-active", ".hk-list-fade-leave-active",
      ".hk-list-grow-enter-active", ".hk-list-grow-leave-active",
      ".hk-list-reveal-enter-active", ".hk-list-reveal-leave-active",
      ".hk-list-surface-enter-active", ".hk-list-surface-leave-active",
    ];
    for (const track of tracks) {
      expect(media, `${track} collapses under reduced motion`).toContain(track);
    }
  });
});

/** The family's duration contract (2026-11-27 user direction): one default
 *  for every list-shaped surface — move `--hk-list-duration` (0.3s), enter /
 *  leave half of it (0.15s), all three starting together — and every track
 *  winning the cascade over the item sheets' own `transition`s. */
describe("HkListTransition duration contract", () => {
  const HALF = "var(--duration-short, 0.15s)";

  it("every move track runs on --hk-list-duration", () => {
    for (const variant of ["pop", "slide", "fade", "grow", "reveal", "surface"]) {
      const move = rule(css, `.hk-list-${variant}-move`);
      expect(move, `${variant} move rule compiles`).not.toBe("");
      expect(move, `${variant} move duration`).toContain("var(--hk-list-duration, var(--duration-normal, 0.3s))");
    }
  });

  it("enter and leave tracks default to half the move", () => {
    for (const variant of ["pop", "slide", "fade", "grow", "reveal"]) {
      expect(rule(css, `.hk-list-${variant}-enter-active`), `${variant} enter`).toContain(
        `var(--hk-list-enter-duration, ${HALF})`,
      );
      expect(rule(css, `.hk-list-${variant}-leave-active`), `${variant} leave`).toContain(
        `var(--hk-list-leave-duration, ${HALF})`,
      );
    }
  });

  it("every track is !important so an item sheet's own transition cannot swallow it", () => {
    // Items carry their own transitions (the menu-item grammar's 0.12s hover
    // faces) at the same specificity and later in the bundle; a non-important
    // track lost that cascade and the FLIP silently snapped.
    const tracks = [
      ".hk-list-pop-move", ".hk-list-slide-move", ".hk-list-fade-move", ".hk-list-grow-move",
      ".hk-list-reveal-move", ".hk-list-surface-move",
      ".hk-list-pop-enter-active", ".hk-list-pop-leave-active",
      ".hk-list-slide-enter-active", ".hk-list-slide-leave-active",
      ".hk-list-fade-enter-active", ".hk-list-fade-leave-active",
      ".hk-list-grow-enter-active", ".hk-list-grow-leave-active",
      ".hk-list-reveal-enter-active", ".hk-list-reveal-leave-active",
      ".hk-list-surface-enter-active", ".hk-list-surface-leave-active",
    ];
    for (const sel of tracks) {
      const body = rule(css, sel);
      expect(body, `${sel} compiles`).not.toBe("");
      const decls = body
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split(";")
        .map((d) => d.trim())
        .filter((d) => /^transition/.test(d));
      expect(decls.length, `${sel} declares a transition`).toBeGreaterThan(0);
      for (const d of decls) expect(d, `${sel} → ${d}`).toMatch(/!important\s*$/);
    }
  });

  it("the move opt-out is the LAST transition rule in the compiled sheet (equal weight ⇒ order decides)", () => {
    // `.hk-list-move-disabled` (move={false} — the DEFAULT) and the `-none`
    // family (disabled) carry `transition: none !important`, exactly like
    // the variant tracks. At equal specificity and equal importance the
    // LAST declaration wins, so the opt-out must sit AFTER every track:
    // it used to sit right after the first three, and 9 of the 12 move
    // tracks came back for a default host (2026-11-27 R5).
    const optOut = css.indexOf(".hk-list-move-disabled");
    expect(optOut, "the opt-out compiles").toBeGreaterThan(-1);
    for (const track of [
      ".hk-list-pop-move", ".hk-list-slide-move", ".hk-list-fade-move",
      ".hk-list-grow-move", ".hk-list-reveal-move", ".hk-list-surface-move",
      ".hk-list-pop-enter-active", ".hk-list-pop-leave-active",
      ".hk-list-slide-enter-active", ".hk-list-slide-leave-active",
      ".hk-list-fade-enter-active", ".hk-list-fade-leave-active",
      ".hk-list-grow-enter-active", ".hk-list-grow-leave-active",
      ".hk-list-reveal-enter-active", ".hk-list-reveal-leave-active",
      ".hk-list-surface-enter-active", ".hk-list-surface-leave-active",
    ]) {
      // The compiled sheet groups selectors into comma lists
      // (`.a,\n.b {`), so the token's FIRST occurrence is the rule.
      const at = css.indexOf(track);
      expect(at, `${track} compiles`).toBeGreaterThan(-1);
      expect(optOut, `${track} must precede the opt-out`).toBeGreaterThan(at);
    }
    // …and the opt-out block itself is !important, like everything it
    // outranks.
    const block = rule(css, ".hk-list-move-disabled");
    expect(block).toMatch(/!important/);
  });

  it("the disabled/none family is !important too (it must beat a later item sheet)", () => {
    for (const sel of [".hk-list-none-enter-active", ".hk-list-none-leave-active", ".hk-list-none-move"]) {
      const decls = rule(css, sel)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split(";")
        .map((d) => d.trim())
        .filter((d) => /^transition/.test(d));
      expect(decls.length, `${sel} declares a transition`).toBeGreaterThan(0);
      for (const d of decls) expect(d, `${sel} → ${d}`).toMatch(/!important\s*$/);
    }
  });

  it("grow's stagger delay is declared, important, and driven by the leave track", () => {
    // The one-beat stagger is grow's signature (the entering row waits out
    // the leave track; the siblings wait the same beat before closing the
    // gap). Its `transition-delay` must therefore be PRESENT — dropping the
    // declaration entirely leaves the remaining `transition:` track valid
    // and the whole 605-file suite green while the beat silently
    // disappears (2026-11-27 R13) — and `!important` like every track.
    for (const sel of [".hk-list-grow-enter-active", ".hk-list-grow-move"]) {
      const body = rule(css, sel)
        .replace(/\/\*[\s\S]*?\*\//g, "");
      const delayDecls = body
        .split(";")
        .map((d) => d.trim())
        .filter((d) => /^transition-delay/.test(d));
      expect(delayDecls.length, `${sel} declares a transition-delay`).toBeGreaterThanOrEqual(1);
      for (const d of delayDecls) {
        expect(d, `${sel} → ${d}`).toMatch(/!important\s*$/);
        expect(d, `${sel} drives the beat from the leave track`).toContain(
          "var(--hk-list-leave-duration, var(--duration-short, 0.15s))",
        );
      }
    }
  });

  it("surface keeps the window family's own enter/leave timings (the documented exception)", () => {
    expect(rule(css, ".hk-list-surface-enter-active")).toContain("var(--duration-normal, 0.3s)");
    expect(rule(css, ".hk-list-surface-leave-active")).toContain("var(--duration-short, 0.15s)");
  });
});
