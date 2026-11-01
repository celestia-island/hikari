import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

import {
  RAIL_FLIP_ACTIVE_ATTR,
  RAIL_FLIP_FLYING_ATTR,
  RAIL_FLIP_ICON_ATTR,
} from "../composables/useRailIconFlight";

/**
 * Sidebar rail + peek stylesheet contract (2026-10-30) — the shared
 * geometry behind HkFaceShell's sidebar, HkSidebar and bespoke hosts
 * (wowsp). Same conventions as HkSidebar.styles.test.ts / HkDrawer's
 * motion contract: assertions run on the COMPILED sheet (nesting cannot
 * hide a declaration; comments are stripped first), with a couple of
 * deliberately raw-source pins where the compiled text cannot see the
 * intent.
 *
 * What is pinned:
 *
 * 1. NOBODY CLIPS the toggle: the host is never overflow:hidden and the
 *    panel is unclipped too, because the circle straddles the panel's
 *    content-facing border and its outer half lives outside the border
 *    box. The panel's base class in HkSidebar.scss still clips, so a
 *    higher-specificity guard keeps the rail panel unclipped regardless
 *    of stylesheet order.
 * 2. The CONTENT clip moved inside the panel (.hk-sidebar-rail-clip):
 *    flex column, min-height 0, overflow hidden — that is what keeps
 *    full rows inside a 56px rail while widths animate.
 * 3. The toggle's center rides the border LINE: negative half-size inset
 *    (plus half the border), vertical centering, size token on the host.
 * 4. The host stays the LAYOUT box (position relative, width transition)
 *    and [data-peeking] only raises it to the sidebar z band now.
 * 5. Pinning: [data-pinning] kills the panel's and any nested sidebar's
 *    width transitions (the expand must not replay the slide) while the
 *    HOST width transition stays — and the pinned panel keeps the peek
 *    shadow (documented decision: it is still an overlay until the host
 *    finishes growing).
 * 6. The toggle is hidden until the REGION is engaged — both :hover and
 *    :focus-within reveals must exist (keyboard parity).
 * 7. The circle: the icon button's radius channel is overridden to a
 *    full circle inside the toggle.
 * 8. Reduced motion: no transitions anywhere in the kit.
 * 9. The granular style entry (styles/sidebar-rail.scss) compiles and
 *    carries the SAME rules — the wowsp consumption surface.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));
const srcDir = resolve(componentDir, "..");

function sheetCss(file: string): string {
  return compile(file, { style: "expanded", loadPaths: [srcDir, resolve(srcDir, "styles")] })
    .css.replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Body of the first rule whose selector text starts at `selector`. */
function ruleBody(css: string, selector: string): string | null {
  const at = css.indexOf(selector);
  if (at < 0) return null;
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return close < 0 ? null : css.slice(open + 1, close);
}

describe("HkSidebarRail geometry contract", () => {
  const css = sheetCss(resolve(componentDir, "HkSidebarRail.scss"));

  it("compiles with the full class family", () => {
    expect(css.length).toBeGreaterThan(0);
    for (const anchor of [
      ".hk-sidebar-rail-host",
      ".hk-sidebar-rail-host[data-peeking]",
      ".hk-sidebar-rail-host[data-pinning]",
      ".hk-sidebar-rail-panel",
      ".hk-sidebar-rail-clip",
      ".hk-sidebar-rail-toggle",
    ]) {
      expect(css).toContain(anchor);
    }
  });

  it("the host is the layout box and NEVER clips (the toggle straddles the panel border)", () => {
    const host = ruleBody(css, ".hk-sidebar-rail-host {") ?? ruleBody(css, ".hk-sidebar-rail-host");
    expect(host, "the host rule exists").not.toBeNull();
    expect(host).toContain("position: relative");
    expect(host, "the toggle's outer half must paint outside the panel").toContain("overflow: visible");
    expect(host, "nothing in the kit may clip the circle").not.toContain("overflow: hidden");
    expect(host, "the host width transition IS the intended motion").toContain("transition: width");
  });

  it("a peek only raises the host to the sidebar z band now (no clip flip)", () => {
    const peeking = ruleBody(css, ".hk-sidebar-rail-host[data-peeking]");
    expect(peeking, "the peeking rule exists").not.toBeNull();
    expect(peeking).toContain("z-index: var(--hk-z-sidebar, 900)");
    // The host no longer toggles overflow here — it never clips.
    expect(peeking).not.toContain("overflow");
  });

  it("the panel overlays from the inline-start edge, unclipped, and animates its width", () => {
    const panel = ruleBody(css, ".hk-sidebar-rail-panel");
    expect(panel, "the panel rule exists").not.toBeNull();
    expect(panel).toContain("position: absolute");
    // Logical anchor — RTL docks the panel on the other side for free.
    expect(panel).toContain("inset-inline-start: 0");
    // The slide lever: the panel animates its WIDTH, and the peek shadow
    // fades on its own (the shadow clears at the grace, the retract still
    // has the width transition to play — see the sheet's comment).
    expect(panel).toContain("transition:");
    expect(panel).toContain("width var(--duration-normal, 0.3s) ease");
    expect(panel).toContain("box-shadow var(--duration-fast, 0.15s) ease");
    // Unclipped: the toggle's outer half lives outside this border box.
    expect(panel).toContain("overflow: visible");
  });

  it("out-specifies HkSidebar's clipping .hk-sidebar-panel for the rail panel", () => {
    // HkSidebar.scss (shared, not part of this sheet) still declares
    // overflow: hidden on .hk-sidebar-panel, which the rail panel also
    // carries in HkSidebar's rail mode. Without this guard the circle
    // loses its outside half whenever that sheet loads later.
    const guard = ruleBody(css, ".hk-sidebar-rail-host .hk-sidebar-rail-panel");
    expect(guard, "the specificity guard exists").not.toBeNull();
    expect(guard).toContain("overflow: visible");
  });

  it("keeps the content clip INSIDE the panel (header/body/footer stay in the footprint)", () => {
    const clip = ruleBody(css, ".hk-sidebar-rail-clip");
    expect(clip, "the clip wrapper rule exists").not.toBeNull();
    expect(clip).toContain("flex: 1");
    expect(clip).toContain("min-height: 0");
    expect(clip).toContain("overflow: hidden");
    expect(clip).toContain("display: flex");
    expect(clip).toContain("flex-direction: column");
  });

  it("the swap holds every generation at its OWN width (the no-reflow pin)", () => {
    // The crossfade handoff (HkSidebarRailSwap): the generations carry
    // their widths INLINE and HkCrossfade's auto track never shrinks
    // below the widest mounted generation, so neither generation is ever
    // laid out at the panel's transient width while it animates — the
    // structural guarantee behind "content is never squeezed". The swap
    // host itself only needs to not STRETCH with the animating clip
    // (align-self): the host box is not the layout reference for the
    // generations inside it.
    const swap = ruleBody(css, ".hk-sidebar-rail-clip > .hk-sidebar-rail-swap");
    expect(swap, "the swap sizing rule exists").not.toBeNull();
    expect(swap).toContain("flex: 1");
    expect(swap).toContain("min-height: 0");
    expect(swap).toContain("align-self: flex-start");
    // The swap host IS the flight layer's containing block: its
    // inline-start edge is the docked edge (stable in LTR and RTL while
    // only the inline-END edge tracks the animating clip width), and it
    // sits OUTSIDE both dissolving items — clones must not inherit an
    // item's enter fade (enter-from holds opacity 0 for the flight's
    // first frames; an item-anchored clone blinks out at arm time).
    expect(swap).toContain("position: relative");
    // The dissolving items must NOT become containing blocks: a
    // relative item would put the clones inside the very opacity group
    // the flight exists to bypass.
    expect(
      ruleBody(css, ".hk-sidebar-rail-swap .hk-crossfade-item"),
      "the dissolve item must not become the clone's containing block",
    ).toBeNull();

    // Each generation is the flex column the bands expect, filling the
    // swap's height (spacer + footer-at-bottom behave as they did as
    // direct children of the clip).
    const gen = ruleBody(css, ".hk-sidebar-rail-swap .hk-sidebar-rail-generation");
    expect(gen, "the generation rule exists").not.toBeNull();
    expect(gen).toContain("height: 100%");
    expect(gen).toContain("display: flex");
    expect(gen).toContain("flex-direction: column");
  });

  it("straddles the panel border: half the toggle outside, center on the border line", () => {
    const toggle = ruleBody(css, ".hk-sidebar-rail-toggle");
    expect(toggle, "the toggle rule exists").not.toBeNull();
    // The negative half-size inset is the straddle: the circle's center
    // lands ON the panel's inline-end border (half of it outside).
    expect(toggle).toContain("inset-inline-end: calc(var(--hk-sidebar-rail-toggle-size, 24px) / -2");
    expect(toggle).toContain("--hk-sidebar-rail-border-width, 1px) / 2");
    // Vertical centering on the edge.
    expect(toggle).toContain("inset-block-start: 50%");
    expect(toggle).toContain("translate: 0 -50%");
    // Above the panel + content.
    expect(toggle).toContain("z-index: 2");
  });

  it("the peek casts its shadow toward the content side, mirrored in RTL", () => {
    expect(css).toContain("box-shadow: 8px 0 24px rgba(0, 0, 0, 0.22)");
    // The house [dir=rtl] mirror (offsets cannot flip logically). Sass
    // emits the attribute unquoted ([dir=rtl]) — match both spellings.
    const rtl = css.match(/\[dir[=]["']?rtl["']?\][^{]*\{[^}]*\}/);
    expect(rtl, "an RTL peeking shadow rule exists").toBeTruthy();
    expect(rtl![0]).toContain("box-shadow: -8px 0 24px rgba(0, 0, 0, 0.22)");
  });

  it("pin window: panel + nested sidebars snap, the HOST width transition stays", () => {
    const pinned = ruleBody(css, ".hk-sidebar-rail-host[data-pinning] .hk-sidebar-rail-panel");
    expect(pinned, "the pin rule exists").not.toBeNull();
    expect(pinned).toContain("transition: none");

    // The same kill list must cover a nested HkSidebar, whose own width
    // transitions would otherwise replay the slide the user reported.
    const pinGroup = css.slice(css.indexOf(".hk-sidebar-rail-host[data-pinning] .hk-sidebar-rail-panel"));
    expect(pinGroup).toContain(".hk-sidebar-rail-host[data-pinning] .hk-sidebar,");
    expect(pinGroup).toContain(".hk-sidebar-rail-host[data-pinning] .hk-sidebar-panel {");

    // …and the documented decision: the pinned panel still reads as the
    // elevated overlay while the host grows into it.
    const shadowRule = ruleBody(css, ".hk-sidebar-rail-host[data-pinning] .hk-sidebar-rail-panel {");
    expect(shadowRule, "the pinned panel rule exists").not.toBeNull();
    expect(shadowRule).toContain("box-shadow: 8px 0 24px rgba(0, 0, 0, 0.22)");

    // The HOST's own rule never joins the kill list.
    const hostRule = ruleBody(css, ".hk-sidebar-rail-host {") ?? ruleBody(css, ".hk-sidebar-rail-host");
    expect(hostRule, "the host keeps its width transition").toContain("transition: width");
  });

  it("the toggle hides until the region is engaged — by hover AND focus-within", () => {
    const toggle = ruleBody(css, ".hk-sidebar-rail-toggle");
    expect(toggle, "the toggle rule exists").not.toBeNull();
    expect(toggle).toContain("opacity: 0");
    expect(toggle).toContain("pointer-events: none");

    // One reveal rule, two gates — compiled as a GROUPED selector (sass
    // wraps the comma onto its own line, so the rule is located through
    // its :focus-within arm and both arms' presence is asserted).
    expect(css).toContain(".hk-sidebar-rail-host:hover .hk-sidebar-rail-toggle");
    const reveal = ruleBody(css, ".hk-sidebar-rail-host:focus-within .hk-sidebar-rail-toggle");
    expect(reveal, "the focus-within reveal arm exists").not.toBeNull();
    expect(reveal).toContain("opacity: 1");
    expect(reveal).toContain("pointer-events: auto");
    // The two arms are ONE rule: the hover arm is the selector text
    // immediately before the focus arm's comma join.
    expect(css).toMatch(/:hover \.hk-sidebar-rail-toggle,\n\.hk-sidebar-rail-host:focus-within/);
  });

  it("the button is a circle — the radius channel is overridden locally", () => {
    const btn = ruleBody(css, ".hk-sidebar-rail-toggle .hk-icon-button");
    expect(btn, "the icon-button override exists").not.toBeNull();
    expect(btn).toContain("--hi-icon-button-radius: 9999px");
  });

  it("hosts the rail flip's icon flight: paint-only layer, dead clones, triply-scoped hide", () => {
    // useRailIconFlight clones the flipping icons onto a layer ABOVE the
    // dissolve. The layer is chrome: it must never intercept a pointer
    // (the leaving generation is pointer-dead for the dissolve and the
    // layer rides above it) and it lives INSIDE the swap host, so the
    // nobody-clips contract above is untouched.
    const layer = ruleBody(css, ".hk-sidebar-rail-flight");
    expect(layer, "the flight layer rule exists").not.toBeNull();
    expect(layer).toContain("position: absolute");
    expect(layer).toContain("inset: 0");
    expect(layer).toContain("z-index: 2");
    expect(layer).toContain("pointer-events: none");

    const clone = ruleBody(css, ".hk-sidebar-rail-flight-clone");
    expect(clone, "the clone rule exists").not.toBeNull();
    expect(clone).toContain("position: absolute");
    expect(clone).toContain("pointer-events: none");

    // The hide rule enforces the SINGLE-GLYPH CONTRACT (2026-11-02 user
    // direction: the clone and the dissolving-in entering icon used to
    // double-expose mid-flight): while a flight is armed
    // ([data-flipping] on the swap host), every cell the choreographer
    // marked ([data-flip-flying] — stamped on BOTH ends of a matched
    // pair, swept with the layer) hides, so the clone is the one
    // visible glyph from arm to landing. Deliberately NOT scoped to the
    // items' dissolve classes — those are transient engine state (the
    // happy-dom lesson), and the mark alone already names exactly the
    // substituted cells. The selector is composed from the composable's
    // EXPORTED CONSTANTS — the welding that keeps the JSX/SCSS literals
    // and the JS pairings one vocabulary (a literal drift anywhere turns
    // this red instead of silently double-exposing the glyph).
    const hideSelector =
      `.hk-sidebar-rail-swap[${RAIL_FLIP_ACTIVE_ATTR}] ` +
      `.hk-menu-item-icon[${RAIL_FLIP_FLYING_ATTR}]`;
    // Rule-boundary anchored: ruleBody's plain match is a SUBSTRING
    // lookup, so a longer selector that merely CONTAINS the welded form
    // (a namespaced prefix, a malformed double selector) would pass.
    // Demanding a rule edge (start of stylesheet or a closing brace)
    // before the selector closes that hole.
    const hide = css.match(
      new RegExp(
        "(^|})\\s*" + hideSelector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}",
      ),
    );
    expect(hide, "the single-glyph hide rule exists as ITS OWN rule").not.toBeNull();
    // Group 2 is the rule body (group 1 is the boundary anchor).
    expect(hide![2]).toContain("visibility: hidden");
    // The sheet must not hide on the OPT-IN attribute alone — that
    // spelling would vanish unmatched fallbacks without a substitute.
    expect(
      ruleBody(
        css,
        `.hk-sidebar-rail-swap[${RAIL_FLIP_ACTIVE_ATTR}] ` +
          `.hk-menu-item-icon[${RAIL_FLIP_ICON_ATTR}]`,
      ),
      "hiding keyed to the opt-in attribute alone is the S1-1 regression",
    ).toBeNull();
  });

  it("leaves no flight transition for reduced motion to kill (the flight is JS-driven)", () => {
    // useRailIconFlight skips itself under prefers-reduced-motion, so the
    // sheet must not grow CSS transitions for the layer/clone that the
    // kit's reduced-motion block would then have to enumerate — a
    // transition here would mean the choreography drifted into CSS.
    const layer = ruleBody(css, ".hk-sidebar-rail-flight");
    expect(layer).not.toContain("transition");
    const clone = ruleBody(css, ".hk-sidebar-rail-flight-clone");
    expect(clone).not.toContain("transition");
  });

  it("kills every transition under reduced motion", () => {
    const reduceAt = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(reduceAt, "the reduced-motion block exists").toBeGreaterThanOrEqual(0);
    const block = css.slice(reduceAt);
    for (const anchor of [
      ".hk-sidebar-rail-host",
      ".hk-sidebar-rail-panel",
      ".hk-sidebar-rail-toggle",
    ]) {
      expect(block, anchor + " resets its transition").toContain(anchor);
    }
    expect(block).toContain("transition: none");
  });

  it("declares its geometry tokens exactly once, on the host, in the source", () => {
    const source = readFileSync(resolve(componentDir, "HkSidebarRail.scss"), "utf8").replace(/\r\n/g, "\n");
    expect(source).toContain("--hk-sidebar-rail-toggle-size: 24px;");
    expect(source).toContain("--hk-sidebar-rail-border-width: 1px;");
    for (const token of ["--hk-sidebar-rail-toggle-size", "--hk-sidebar-rail-border-width"]) {
      expect(
        (source.match(new RegExp(token + "\\s*:", "g")) ?? []).length,
        token + " is declared exactly once",
      ).toBe(1);
    }
    // The declaration lives INSIDE the host rule (a host-level token beats
    // anything an ancestor declares — the custom-property trap).
    const hostRule = source.slice(source.indexOf(".hk-sidebar-rail-host {"));
    expect(hostRule.slice(0, hostRule.indexOf("}"))).toContain("--hk-sidebar-rail-toggle-size: 24px;");
  });
});

describe("the granular style entry (styles/sidebar-rail.scss)", () => {
  it("compiles and carries the SAME rules — the bespoke-host surface", () => {
    const css = sheetCss(resolve(srcDir, "styles", "sidebar-rail.scss"));
    for (const anchor of [
      ".hk-sidebar-rail-host",
      ".hk-sidebar-rail-panel",
      ".hk-sidebar-rail-clip",
      ".hk-sidebar-rail-toggle .hk-icon-button",
      ".hk-sidebar-rail-host[data-peeking]",
      ".hk-sidebar-rail-host[data-pinning]",
    ]) {
      expect(css, anchor + " ships through the subpath").toContain(anchor);
    }
  });

  it("is a pure re-export of the component sheet — no re-declared geometry beside it", () => {
    const source = readFileSync(resolve(srcDir, "styles", "sidebar-rail.scss"), "utf8").replace(/\r\n/g, "\n");
    expect(source).toContain('@use "../components/HkSidebarRail.scss";');
    expect(source.match(/\{/g) ?? [], "no css blocks of its own").toHaveLength(0);
  });
});
