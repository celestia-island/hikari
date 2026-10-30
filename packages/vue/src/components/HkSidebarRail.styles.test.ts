import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

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
 * 1. The host is the LAYOUT box and clips by default; [data-peeking]
 *    un-clips and rises to the sidebar z band — that pair IS the
 *    "overlay, never reflow" contract.
 * 2. The panel is absolutely positioned off the INLINE-START edge
 *    (logical property — the drawer slides the right way in RTL).
 * 3. The peek casts a shadow toward the content side, mirrored in RTL.
 * 4. The toggle is hidden until the REGION is engaged — both :hover and
 *    :focus-within reveals must exist (keyboard parity).
 * 5. The circle: the icon button's radius channel is overridden to a
 *    full circle inside the toggle.
 * 6. Reduced motion: no transitions anywhere in the kit.
 * 7. The granular style entry (styles/sidebar-rail.scss) compiles and
 *    carries the SAME rules — the wowsp consumption surface.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));
const srcDir = resolve(componentDir, "..");

function sheetCss(file: string): string {
  return compile(file, { style: "expanded", loadPaths: [srcDir, resolve(srcDir, "styles")] })
    .css.replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Body of the first rule whose selector line matches exactly. */
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
      ".hk-sidebar-rail-panel",
      ".hk-sidebar-rail-toggle",
    ]) {
      expect(css).toContain(anchor);
    }
  });

  it("the host clips by default and stops clipping while peeking, rising to the sidebar z band", () => {
    const host = ruleBody(css, ".hk-sidebar-rail-host {") ?? ruleBody(css, ".hk-sidebar-rail-host");
    expect(host, "the host rule exists").not.toBeNull();
    expect(host).toContain("overflow: hidden");
    expect(host).toContain("position: relative");

    const peeking = ruleBody(css, ".hk-sidebar-rail-host[data-peeking]");
    expect(peeking, "the peeking rule exists").not.toBeNull();
    expect(peeking).toContain("overflow: visible");
    expect(peeking).toContain("z-index: var(--hk-z-sidebar, 900)");
  });

  it("the panel is an absolutely positioned overlay anchored to the inline-start edge", () => {
    const panel = ruleBody(css, ".hk-sidebar-rail-panel");
    expect(panel, "the panel rule exists").not.toBeNull();
    expect(panel).toContain("position: absolute");
    // Logical anchor — RTL docks the panel on the other side for free.
    expect(panel).toContain("inset-inline-start: 0");
    // The slide lever: the panel animates its WIDTH (the host's layout
    // width is never touched by a peek).
    expect(panel).toContain("transition: width");
  });

  it("the peek casts its shadow toward the content side, mirrored in RTL", () => {
    expect(css).toContain("box-shadow: 8px 0 24px rgba(0, 0, 0, 0.22)");
    // The house [dir=rtl] mirror (offsets cannot flip logically). Sass
    // emits the attribute unquoted ([dir=rtl]) — match both spellings.
    const rtl = css.match(/\[dir[=]["']?rtl["']?\][^{]*\{[^}]*\}/);
    expect(rtl, "an RTL peeking shadow rule exists").toBeTruthy();
    expect(rtl![0]).toContain("box-shadow: -8px 0 24px rgba(0, 0, 0, 0.22)");
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

  it("declares the toggle inset token exactly once, with its fallback, in the source", () => {
    const source = readFileSync(resolve(componentDir, "HkSidebarRail.scss"), "utf8").replace(/\r\n/g, "\n");
    expect(source).toContain("--hk-sidebar-rail-toggle-inset: 4px;");
    expect((source.match(/--hk-sidebar-rail-toggle-inset\s*:/g) ?? []).length, "the token is declared exactly once").toBe(1);
  });
});

describe("the granular style entry (styles/sidebar-rail.scss)", () => {
  it("compiles and carries the SAME rules — the bespoke-host surface", () => {
    const css = sheetCss(resolve(srcDir, "styles", "sidebar-rail.scss"));
    for (const anchor of [
      ".hk-sidebar-rail-host",
      ".hk-sidebar-rail-panel",
      ".hk-sidebar-rail-toggle .hk-icon-button",
      ".hk-sidebar-rail-host[data-peeking]",
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
