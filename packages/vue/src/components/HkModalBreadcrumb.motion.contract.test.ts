/**
 * Compiled-CSS contract for the strip's MOTION — run against the COMPILED
 * stylesheets, not the source text (the behavioural suite runs in
 * happy-dom, which resolves no theme custom properties, so a wrong
 * literal there paints green and breaks only in a real theme).
 *
 * User direction 2026-11-07: window crumbs must animate the way the
 * windows themselves do (the B3 whole-window choreography — rise 10px,
 * settle from 97% scale, fade; leave is the true reverse). Three layers
 * carry that signature and this file pins all three:
 *
 *   1. the strip's own surface entrance/exit  (hk-modal-breadcrumb-enter/leave-*)
 *   2. each crumb's enter/leave via the list container (hk-list-surface-*)
 *   3. the shared pose constants with HkModal itself
 *
 * Compositor-only is the law here (the modal height-ride lesson): every
 * animated rule below touches ONLY opacity/transform. A layout property
 * (top/left/width/height) in any of them re-rasters the backdrop-filtered
 * strip per frame — the exact jank class that retired the height ride.
 */
import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "sass";

const here = dirname(fileURLToPath(import.meta.url));
const compiled = (sheet: string): string =>
  compile(join(here, sheet), {
    loadPaths: [here, join(here, "..", "styles")],
    style: "expanded",
  }).css;

const breadcrumb = compiled("HkModalBreadcrumb.scss");
const list = compiled("HkListTransition.scss");
const modal = compiled("HkModal.scss");

/** Brace-matched body of the first top-level block whose head starts with
 *  the given prefix (`@media …` or a selector). */
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

/** All `selector { body }` frames anywhere inside a block (one nesting
 *  level deep is enough for these sheets). A selector part that still
 *  carries the preceding comment's tail (ellipsis + comment close before
 *  the selector) is trimmed to the bare selector — sass expanded output
 *  keeps comments, and their commas would otherwise glue the comment
 *  onto the selector string. */
function frames(block: string): { selectors: string[]; body: string }[] {
  const out: { selectors: string[]; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    out.push({
      selectors: m[1]
        .split(",")
        .map((s) => {
          let t = s;
          const comment = t.lastIndexOf("*/");
          if (comment !== -1) t = t.slice(comment + 2);
          const semi = t.lastIndexOf(";");
          if (semi !== -1) t = t.slice(semi + 1);
          return t.trim();
        })
        .filter((s) => s.startsWith(".") || s.startsWith("[") || s.includes("@")),
      body: m[2].trim(),
    });
  }
  return out;
}

/** The rule whose selector LIST contains exactly the given selector. */
function rule(sheet: string, selector: string): string {
  const all = frames(sheet);
  const hit = all.find((f) => f.selectors.includes(selector));
  expect(hit, `rule ${selector} must exist`).toBeTruthy();
  return hit!.body;
}

/** Rule scoped to the body of a media block. */
function ruleIn(block: string, selector: string): string {
  const hit = frames(block).find((f) => f.selectors.includes(selector));
  expect(hit, `rule ${selector} must exist in the block`).toBeTruthy();
  return hit!.body;
}

const reducedBreadcrumb = topBlock(breadcrumb, "@media (prefers-reduced-motion: reduce)");
const reducedList = topBlock(list, "@media (prefers-reduced-motion: reduce)");

const MODAL_POSE = "translateY(10px) scale(0.97)";
/** The strip's own ride legs — px only; the centering sits on the
 *  `translate` longhand (see the carrier test below). */
const POSE_FROM = "translateY(-10px) scale(0.97)";
const POSE_TO = "translateY(0) scale(1)";
const CENTERING = "-50% -50%";
const EASE_OUT = "cubic-bezier(0.33, 1, 0.68, 1)";
const EASE_IN = "cubic-bezier(0.45, 0, 0.55, 1)";

describe("strip surface enter/leave (window choreography)", () => {
  it("rides opacity + transform only — never a layout property", () => {
    for (const sel of [
      ".hk-modal-breadcrumb-enter-active",
      ".hk-modal-breadcrumb-leave-active",
      ".hk-modal-breadcrumb-enter-from",
      ".hk-modal-breadcrumb-leave-to",
    ]) {
      const block = rule(breadcrumb, sel);
      expect(block).not.toMatch(/\b(top|left|width|height|margin|padding)\s*:/);
    }
  });

  it("arrives with the window's rise + settle + fade", () => {
    const enter = rule(breadcrumb, ".hk-modal-breadcrumb-enter-active");
    expect(enter).toContain(`opacity var(--duration-normal, 0.3s) ${EASE_OUT}`);
    expect(enter).toContain(`transform var(--duration-normal, 0.3s) ${EASE_OUT}`);
    const from = rule(breadcrumb, ".hk-modal-breadcrumb-enter-from");
    expect(from).toContain("opacity: 0");
    expect(from).toContain(`transform: ${POSE_FROM}`);
    const to = rule(breadcrumb, ".hk-modal-breadcrumb-enter-to");
    expect(to).toContain("opacity: 1");
    expect(to).toContain(`transform: ${POSE_TO}`);
  });

  it("leaves as the true reverse, quicker than the windows it names", () => {
    const leave = rule(breadcrumb, ".hk-modal-breadcrumb-leave-active");
    expect(leave).toContain(`opacity var(--duration-short, 0.15s) ${EASE_IN}`);
    expect(leave).toContain(`transform var(--duration-short, 0.15s) ${EASE_IN}`);
    const to = rule(breadcrumb, ".hk-modal-breadcrumb-leave-to");
    expect(to).toContain("opacity: 0");
    expect(to).toContain(`transform: ${POSE_FROM}`);
  });

  it("carries the centring on the translate longhand, never in an animated transform", () => {
    // The strip's box changes WHILE it is up (the keyed crumb list folds its
    // tail, a late webfont reflows the labels, a crumb is re-inserted), and
    // those changes land mid-entrance. A -50% inside the transitioned
    // `transform` freezes its composited matrix against the mount-time box,
    // re-seating the strip against a stale height — the modal-frame defect
    // family hikari #1325 removed. The centring therefore rides the
    // individual `translate` longhand, which re-resolves every frame.
    //
    // BOTH carriers are guarded, because the defect can return through
    // either one: a `translate: none` (or a re-created `translate`) on a ride
    // rule un-centres / double-centres the strip for the whole ride, and a
    // `-50%` re-appended to a ride transform restores the frozen matrix. The
    // first revision of this test swept only `transform:` and let both
    // `translate:` variants pass green (R2 mutation, 2026-11-15). Comments are
    // stripped before matching: sass keeps loud `/* */` comments in expanded
    // output, and a regex would otherwise read a comment's prose as a
    // declaration.
    const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, " ");
    // EVERY declaration of a property, case-insensitively. Both halves are
    // load-bearing: CSS property names are case-insensitive (`Translate:` is
    // the same property), and a duplicate declaration is last-wins — a second
    // `translate: none` appended to the base rule paints un-centred while a
    // first-match-only reader still sees the good pair (independent delta
    // round, 2026-11-15: both bypasses survived the first-match sweep).
    // Split on `;` and test each segment: a boundary-consuming regex cannot
    // see two consecutive declarations of the same property (the match eats
    // the preceding `;`, so the second segment starts without a boundary and
    // only the LAST one is found — measured, 2026-11-15).
    const decls = (body: string, prop: string): string[] => {
      // Vendor prefixes are the same painting: `-webkit-transform` would
      // otherwise slip past an exact-name anchor (closure round, 2026-11-15).
      const re = new RegExp(`^\\s*(?:-webkit-|-moz-|-ms-)?${prop}\\s*:\\s*([\\s\\S]*)$`, "i");
      return body
        .split(";")
        .map((segment) => segment.match(re))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => m[1].trim().replace(/\s+/g, " "));
    };

    const offenders: string[] = [];
    /** The FIRST base-matching frame in source order — the top-level rule
     *  (sass emits media blocks after it). Only its declarations decide
     *  whether the strip is centred everywhere: parking the pair solely in
     *  an @media override would leave every wider viewport un-centred. */
    let topLevelBaseTranslate: string[] | null = null;
    for (const frame of frames(breadcrumb)) {
      const body = stripComments(frame.body);
      const label = frame.selectors.join(", ");
      const isBase = frame.selectors.includes(".hk-modal-breadcrumb");
      const translates = decls(body, "translate");
      if (isBase && topLevelBaseTranslate === null) topLevelBaseTranslate = translates;
      for (const transform of decls(body, "transform")) {
        if (transform !== "none" && transform.includes("%")) {
          offenders.push(`${label} { transform: ${transform} }`);
        }
      }
      for (const translate of translates) {
        if (!isBase) {
          offenders.push(`${label} { translate: ${translate} } (only the base rule may set the centring longhand)`);
        } else if (translate !== CENTERING) {
          offenders.push(`${label} { translate: ${translate} }`);
        }
      }
    }
    expect(offenders, "the centring carrier must stay the base rule's translate longhand").toEqual([]);
    expect(topLevelBaseTranslate, "the top-level base rule must exist").not.toBeNull();
    expect(topLevelBaseTranslate, "the top-level base rule must declare exactly the centring pair").toEqual([
      CENTERING,
    ]);

    // Vacuity guard (hikari #1325's first sweep shipped vacuous exactly
    // that way): the sweep's own subject is the centring longhand, so the
    // positive control asserts THAT is present in the base rule — the
    // enter-from/leave-to transforms are value-pinned by the arrive/leave
    // cases above (POSE_FROM/POSE_TO), which supersede the old bare
    // `transform:` probe (2026-11-19 sweep: presence-only, redundant).
    expect(
      topLevelBaseTranslate,
      "the sweep must see the base rule it exists to police",
    ).toEqual([CENTERING]);
  });

  it("has no keyframe animation on the base class (no double entrance)", () => {
    // The Transition enter classes replaced the old mount keyframe; a
    // reintroduced base `animation:` would stack on top of them. A regex
    // literal on purpose: a plain string would read as a `@keyframes`
    // DECLARATION to naive scanners of the source tree (see
    // registerAnimations.test.ts's parity) — the `\s` escape keeps this
    // assertion from being mistaken for one.
    expect(rule(breadcrumb, ".hk-modal-breadcrumb")).not.toMatch(/animation\s*:/);
    expect(breadcrumb).not.toMatch(/@keyframes\s+hk-modal-breadcrumb-in/);
  });

  it("drops the motion under prefers-reduced-motion", () => {
    expect(reducedBreadcrumb).toContain(".hk-modal-breadcrumb-enter-active");
    expect(reducedBreadcrumb).toContain(".hk-modal-breadcrumb-leave-active");
    expect(ruleIn(reducedBreadcrumb, ".hk-modal-breadcrumb-enter-active")).toContain(
      "transition: none",
    );
    expect(ruleIn(reducedBreadcrumb, ".hk-modal-breadcrumb-leave-active")).toContain(
      "transition: none",
    );
  });
});

describe("crumb list surface variant (HkListTransition)", () => {
  it("animates each crumb with the same window pose", () => {
    const from = rule(list, ".hk-list-surface-enter-from");
    expect(from).toContain("opacity: 0");
    expect(from).toContain(`transform: ${MODAL_POSE}`);
    const leaveTo = rule(list, ".hk-list-surface-leave-to");
    expect(leaveTo).toContain("opacity: 0");
    expect(leaveTo).toContain(`transform: ${MODAL_POSE}`);
  });

  it("uses the window family's curves at crumb pace", () => {
    const enter = rule(list, ".hk-list-surface-enter-active");
    expect(enter).toContain(`opacity var(--duration-normal, 0.3s) ${EASE_OUT}`);
    expect(enter).toContain(`transform var(--duration-normal, 0.3s) ${EASE_OUT}`);
    const leave = rule(list, ".hk-list-surface-leave-active");
    expect(leave).toContain(`opacity var(--duration-short, 0.15s) ${EASE_IN}`);
    expect(leave).toContain(`transform var(--duration-short, 0.15s) ${EASE_IN}`);
    // The leaving crumb is lifted out of flow so the space collapses and
    // the siblings glide (FLIP move) into it.
    expect(leave).toContain("position: absolute");
    // A sinking ghost takes no clicks — neither the row nor the buttons
    // inside it, whose own pointer-events:auto would otherwise beat
    // inheritance (the strip re-enables only its buttons).
    expect(leave).toContain("pointer-events: none");
    expect(rule(list, ".hk-list-surface-leave-active button")).toContain(
      "pointer-events: none",
    );
    const move = rule(list, ".hk-list-surface-move");
    expect(move).toContain("transform");
    expect(move).toContain(EASE_OUT);
    // Insurance: if a mis-classified ghost is ever stamped with the move
    // class, its shorthand must not REPLACE the leave's opacity
    // transition (a transform-only move would cancel the fade).
    expect(move).toContain("opacity");
    expect(move).toContain(EASE_IN);
  });

  it("shares the pose constants with HkModal itself", () => {
    // Single source of truth by equality: retune the window's pose in the
    // modal sheet and this fails until the crumbs follow (or the reviewer
    // rules the divergence in — deliberately loud either way).
    expect(rule(modal, ".hk-modal-content-enter-from")).toContain(MODAL_POSE);
    expect(list).toContain(MODAL_POSE);
    expect(list).toContain(EASE_OUT);
  });

  it("drops the motion under prefers-reduced-motion", () => {
    expect(reducedList).toContain(".hk-list-surface-enter-active");
    expect(reducedList).toContain(".hk-list-surface-leave-active");
    expect(reducedList).toContain(".hk-list-surface-move");
    // The shared guard rule's BODY matters, not just the selector list —
    // pin it (mirrors the strip-side ruleIn assertions above).
    expect(ruleIn(reducedList, ".hk-list-surface-enter-active")).toContain(
      "transition: none !important",
    );
    expect(ruleIn(reducedList, ".hk-list-surface-leave-active")).toContain(
      "transition: none !important",
    );
    expect(ruleIn(reducedList, ".hk-list-surface-move")).toContain("transition: none !important");
  });
});

describe("crumb list host (HkModalBreadcrumb → HkListTransition)", () => {
  it("renders the group as display:contents — the nav stays the sole layout owner", () => {
    expect(rule(breadcrumb, ".hk-modal-breadcrumb-levels")).toContain("display: contents");
  });
});
