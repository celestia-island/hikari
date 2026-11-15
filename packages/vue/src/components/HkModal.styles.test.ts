import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for the window-level material slot (PR #1229).
 *
 * The runtime suite pins the SLOT (the layer element, its frame-level
 * position, the `data-backdrop` mark) but Vitest stubs CSS, so nothing at
 * runtime can see the two rules the mark is supposed to key — deleting
 * either one leaves every DOM test green while the artwork breaks (the
 * M3 mutation in review survived exactly this way):
 *
 *   1. the backdrop layer rule (position/inertness/inheritance), and
 *   2. the gutter-cover suppression — without it the body's top/bottom
 *      covers repaint solid bands over the artwork, which is the
 *      "padding reads as a second material" seam this slot exists to fix.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

function ruleBody(sheet: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [
    ...sheet.matchAll(new RegExp(`(?:(?<=^)|(?<=[}{]))\\s*${escaped}\\s*\\{([^}]*)\\}`, "g")),
  ];
  expect(matches, `${selector} compiles exactly once`).toHaveLength(1);
  return matches[0]?.[1] ?? "";
}

const sheet = compile(resolve(componentDir, "HkModal.scss"), {
  style: "expanded",
}).css
  // Strip comments BEFORE flattening: the sheet-dock rule sits behind a
  // block comment in the compiled output, and its body carries an inline
  // rationale — both would break the `}`-lookbehind selector match and
  // poison the `not.toContain("transform")` negative.
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ");

describe("HkModal window material (compiled contract)", () => {
  it("positions the backdrop layer under the chrome and inside the frame's corners", () => {
    const body = ruleBody(sheet, ".hk-modal-backdrop");
    // Every property is load-bearing: the layer must be inert, clipped,
    // corner-conforming (desktop corners AND the phone sheet reveal) and
    // painted below every in-flow sibling while staying above the frame's
    // own glass fill.
    expect(body).toContain("position: absolute");
    expect(body).toContain("inset: 0");
    expect(body).toContain("z-index: -1");
    expect(body).toContain("overflow: hidden");
    expect(body).toContain("border-radius: inherit");
    expect(body).toContain("pointer-events: none");
  });

  it("sizes the handed-in artwork to the frame", () => {
    // Expanded output nests the child selector: `.hk-modal-backdrop > *`.
    const body = ruleBody(sheet, ".hk-modal-backdrop > *");
    expect(body).toContain("width: 100%");
    expect(body).toContain("height: 100%");
  });

  it("suppresses the body's gutter covers while a material is worn", () => {
    // The covers must STOP EXISTING (content:none), not merely paint
    // transparent: they also carry the scroll-pin mask semantics, and a
    // transparent cover would still sit over the artwork. The rule
    // compiles as ONE combined selector (before + after share a body) —
    // assert on that combined form. The selector is keyed on the FRAME's
    // own mark so an unrelated `data-backdrop` attribute on some outer
    // host element can never suppress a nested modal's covers.
    const body = ruleBody(
      sheet,
      ".hk-modal-content[data-backdrop] .hk-modal-body::before, .hk-modal-content[data-backdrop] .hk-modal-body::after",
    );
    expect(body).toContain("content: none");
  });

  it("keeps the plain gutter covers for frames without a material", () => {
    // The default contract is unchanged: the shared cover rule still
    // paints when no backdrop slot is handed in (the later per-side rules
    // only position the two strips).
    const shared = ruleBody(sheet, ".hk-modal-body::before, .hk-modal-body::after");
    expect(shared).toContain('content: ""');
    expect(shared).not.toContain("content: none");
  });
});


describe("HkModal JS-driven sheet dock (compiled contract)", () => {
  // Round-2 guard for PR #1335 (Via-browser field report): the class-
  // driven dock rule is the fix's whole payload, and Vitest stubs CSS —
  // deleting the 26-line block left every runtime test green. These pins
  // read the COMPILED sheet: deleting the block or any load-bearing
  // declaration fails here.
  const dock = ruleBody(sheet, ".hk-modal-content.hk-is-sheet");

  it("the dock rule compiles exactly once with the positioning subset", () => {
    expect(dock).toContain("top: auto");
    expect(dock).toContain("bottom: var(--hk-sheet-bottom-gap, 0px)");
    expect(dock).toContain("left: 0");
    expect(dock).toContain("right: 0");
    // The dock anchors by left/right/bottom — the centered base's
    // translate must be neutralized or the sheet rides half its own
    // size up-left.
    expect(dock).toContain("translate: none");
    expect(dock).toContain("max-width: 100% !important");
  });

  it("carries NO class-level transform (the slide reveal must survive)", () => {
    // Round-2 S1: a class-level `transform: none` at (0,2,0) out-ranks
    // the media query's enter-from translateY(100%) at (0,1,0) and kills
    // the slide-from-bottom on every phone. The class rule must not
    // mention transform at all.
    expect(dock).not.toContain("transform");
  });

  it("the slide reveal the dock protects is itself pinned", () => {
    // Round-3 symmetry guard, corrected in round 4: the translateY(100%)
    // literal lives ONLY in the ≤767px enter-from block (desktop rides
    // translateY(10px) scale(0.97)); the dock's transform-free rule
    // exists so that mobile literal can slide the sheet up from the
    // bottom edge. The deeper winner-level pin lives in
    // HkModal.open-close-scale.test.ts; this whole-sheet containment is
    // the cheap tripwire.
    expect(sheet).toContain("transform: translateY(100%)");
  });

  it("keeps the mobile chrome subset (radius, borders, caps)", () => {
    expect(dock).toContain("border-radius: var(--hk-modal-radius, var(--radius-xl, 16px))");
    expect(dock).toContain("border-left: 0");
    expect(dock).toContain("max-height: calc(100dvh");
  });
});
