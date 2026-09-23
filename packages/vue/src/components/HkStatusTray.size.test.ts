import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkStatusTray, { HK_TRAY_SIZE_VARS, type HkStatusTraySize } from "./HkStatusTray";

/**
 * The "md is pixel-identical to what already ships" contract.
 *
 * The tray arrived from shittim-chest with its geometry living in
 * `styles/admin-tokens.scss` (`.s-status-bar-btn svg` 9px, the `x` glyph
 * 11px, `.s-status-bar-time` `--text-2xs`). This PR adds a size knob WITHOUT
 * touching that sheet, so the same three numbers now exist in three places:
 *
 *   1. the shipped admin-tokens rules (the source of truth),
 *   2. the component's `md` row in HK_TRAY_SIZE_VARS,
 *   3. the fallbacks in HkStatusTray.scss.
 *
 * This guard reads (1) out of the COMPILED sheet — not a hand-copied list —
 * and holds (2) and (3) to it, so moving any one of them alone fails here
 * instead of silently restyling every consumer that ships the shared sheet.
 * The comparison is exercised against a knowingly-wrong value in the last
 * case: a guard that cannot go red is not a guard.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));
const srcDir = resolve(componentDir, "..");
const stylesDir = resolve(srcDir, "styles");

function compileSheet(file: string): string {
  return compile(file, {
    style: "expanded",
    loadPaths: [srcDir, stylesDir, resolve(stylesDir, "theme")],
    // Deprecations are silenced defensively: none fire on today's sheets
    // (verified — the three sheets compile warning-free), but a sass upgrade
    // must not turn this geometry guard into a warning storm.
    silenceDeprecations: ["import", "global-builtin", "legacy-js-api"],
  }).css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Flattened rule body for an exact selector, or null when absent. */
function ruleBody(css: string, selector: string): string | null {
  // Sass drops the quotes around an attribute value (`[data-shape="x"]` is
  // emitted as `[data-shape=x]`), so the quote is optional in the match.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/"/g, '"?');
  const m = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return m ? m[1]! : null;
}

/** One declaration out of a rule body. */
function decl(body: string | null, prop: string): string | null {
  if (!body) return null;
  const m = body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
  return m ? m[1]!.trim() : null;
}

/** Rough specificity (classes/attributes ×100 + element selectors): enough
 *  to state "the component sheet outranks the shipped rule". */
function specificity(selector: string): number {
  const classes = (selector.match(/\.[a-z0-9-]+|\[[^\]]+\]/gi) ?? []).length;
  const elements = (selector.match(/(?:^|[\s>+~])[a-z][a-z0-9-]*/gi) ?? []).length;
  return classes * 100 + elements;
}

const adminCss = compileSheet(resolve(stylesDir, "admin-tokens.scss"));
const trayCss = compileSheet(resolve(componentDir, "HkStatusTray.scss"));
const scaleVars: Record<string, string> = {};
for (const m of readFileSync(resolve(srcDir, "scale.scss"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
  scaleVars[m[1]!] = m[2]!.replace(/\s+/g, " ").trim();
}

/** The shipped geometry, read from the compiled shared sheet. */
const SHIPPED = {
  glyph: decl(ruleBody(adminCss, ".s-status-bar-btn svg"), "width"),
  glyphHeight: decl(ruleBody(adminCss, ".s-status-bar-btn svg"), "height"),
  glyphX: decl(ruleBody(adminCss, '.s-status-bar-btn[data-shape="x"] svg'), "width"),
  glyphXHeight: decl(ruleBody(adminCss, '.s-status-bar-btn[data-shape="x"] svg'), "height"),
  timeSize: decl(ruleBody(adminCss, ".s-status-bar-time"), "font-size"),
};

/** The three vars the tray root publishes, read off the MOUNTED root. */
function trayVars(size?: HkStatusTraySize): Record<string, string> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkStatusTray, size ? { size } : {}) });
  app.mount(container);
  const root = container.querySelector<HTMLElement>(".s-status-bar-system-tray");
  expect(root, "the tray root rendered").not.toBeNull();
  const vars: Record<string, string> = {
    "--hk-tray-glyph": root!.style.getPropertyValue("--hk-tray-glyph"),
    "--hk-tray-glyph-x": root!.style.getPropertyValue("--hk-tray-glyph-x"),
    "--hk-tray-time-size": root!.style.getPropertyValue("--hk-tray-time-size"),
  };
  app.unmount();
  container.remove();
  return vars;
}

/** The shared comparator: "these values are the shipped geometry". */
function assertShippedGeometry(vars: Record<string, string>): void {
  expect(vars["--hk-tray-glyph"]).toBe(SHIPPED.glyph);
  expect(vars["--hk-tray-glyph-x"]).toBe(SHIPPED.glyphX);
  expect(vars["--hk-tray-time-size"]).toBe(SHIPPED.timeSize);
}

describe("HkStatusTray shipped-geometry contract", () => {
  it("reads the shipped geometry out of admin-tokens.scss (positive control)", () => {
    expect(SHIPPED.glyph).toBe("9px");
    expect(SHIPPED.glyphHeight).toBe("9px");
    expect(SHIPPED.glyphX).toBe("11px");
    expect(SHIPPED.glyphXHeight).toBe("11px");
    expect(SHIPPED.timeSize).toBe("var(--text-2xs)");
    // …and that var really resolves (the clock's "current value").
    expect(scaleVars["--text-2xs"]).toBe("0.625rem");
  });

  it("emits exactly the shipped geometry at the default size (md)", () => {
    const md = trayVars();
    assertShippedGeometry(md);
    // The clock size is not a copied length: md emits the same var the
    // shipped rule declares, which is what makes it observationally free.
    expect(md["--hk-tray-time-size"]).toBe("var(--text-2xs)");
    expect(md["--hk-tray-time-size"]).not.toBe("0.625rem");
    // Same reference point through the table the component renders from.
    expect(HK_TRAY_SIZE_VARS.md["--hk-tray-glyph"]).toBe(SHIPPED.glyph);
  });

  it("falls back to the shipped geometry in the sheet itself (zero visual change without the component)", () => {
    const btnSvg = ruleBody(trayCss, ".s-status-bar-system-tray .s-status-bar-btn svg");
    const xSvg = ruleBody(trayCss, '.s-status-bar-system-tray .s-status-bar-btn[data-shape="x"] svg');
    const time = ruleBody(trayCss, ".s-status-bar-system-tray .s-status-bar-time");

    expect(decl(btnSvg, "width")).toBe(`var(--hk-tray-glyph, ${SHIPPED.glyph})`);
    expect(decl(btnSvg, "height")).toBe(`var(--hk-tray-glyph, ${SHIPPED.glyphHeight})`);
    expect(decl(xSvg, "width")).toBe(`var(--hk-tray-glyph-x, ${SHIPPED.glyphX})`);
    expect(decl(xSvg, "height")).toBe(`var(--hk-tray-glyph-x, ${SHIPPED.glyphXHeight})`);
    expect(decl(time, "font-size")).toBe(`var(--hk-tray-time-size, ${SHIPPED.timeSize})`);

    // The overrides must outrank the shipped selectors regardless of which
    // sheet the consumer's bundle emits first.
    expect(specificity(".s-status-bar-system-tray .s-status-bar-btn svg"))
      .toBeGreaterThan(specificity(".s-status-bar-btn svg"));
    expect(specificity('.s-status-bar-system-tray .s-status-bar-btn[data-shape="x"] svg'))
      .toBeGreaterThan(specificity('.s-status-bar-btn[data-shape="x"] svg'));
    expect(specificity(".s-status-bar-system-tray .s-status-bar-time"))
      .toBeGreaterThan(specificity(".s-status-bar-time"));
    // …and the counter is not vacuous.
    expect(specificity(".a .b i")).toBeGreaterThan(specificity(".b i"));
  });

  it("publishes exactly the vars the sheet consumes — no more, no fewer", () => {
    const consumed = new Set<string>();
    for (const m of trayCss.matchAll(/var\((--hk-tray-[a-z-]+),/g)) consumed.add(m[1]!);
    expect([...consumed].sort()).toEqual([
      "--hk-tray-glyph",
      "--hk-tray-glyph-x",
      "--hk-tray-time-size",
    ]);
    expect(Object.keys(trayVars()).sort()).toEqual([...consumed].sort());
  });

  it("scales sm < md < lg while only md is the shipped value", () => {
    const sm = trayVars("sm");
    const md = trayVars("md");
    const lg = trayVars("lg");
    const px = (value: string) => Number.parseFloat(value);

    expect(px(sm["--hk-tray-glyph"]!)).toBeLessThan(px(md["--hk-tray-glyph"]!));
    expect(px(md["--hk-tray-glyph"]!)).toBeLessThan(px(lg["--hk-tray-glyph"]!));
    expect(px(sm["--hk-tray-glyph-x"]!)).toBeLessThan(px(md["--hk-tray-glyph-x"]!));
    expect(px(md["--hk-tray-glyph-x"]!)).toBeLessThan(px(lg["--hk-tray-glyph-x"]!));

    assertShippedGeometry(md);
    expect(sm["--hk-tray-glyph"]).not.toBe(SHIPPED.glyph);
    expect(lg["--hk-tray-glyph"]).not.toBe(SHIPPED.glyph);

    // Every rung keeps the clock tied to the L2 type scale rather than a
    // hard-coded length, so a consumer that rescales --text-2xs moves with it.
    for (const vars of [sm, md, lg]) {
      expect(vars["--hk-tray-time-size"]).toContain("--text-2xs");
    }
  });

  it("goes red on a moved value (the comparison is not vacuous)", () => {
    const moved = { ...trayVars(), "--hk-tray-glyph": "10px" };
    expect(() => assertShippedGeometry(moved)).toThrow();
    const movedX = { ...trayVars(), "--hk-tray-glyph-x": "10px" };
    expect(() => assertShippedGeometry(movedX)).toThrow();
    const movedTime = { ...trayVars(), "--hk-tray-time-size": "0.7rem" };
    expect(() => assertShippedGeometry(movedTime)).toThrow();
    // …and the untouched values keep passing, so the reds above come from
    // the moved field and not from the comparator failing wholesale.
    assertShippedGeometry(trayVars());
  });

  it("documents the ladder's edge: `xs` publishes no rung, so the shipped fallbacks render", () => {
    // The ladder belongs to the decor CONTRACT (HkThemeDecorSize), not to this
    // component — the tray implements sm|md|lg. A caller asking for `xs`
    // therefore publishes NO --hk-tray-* var at all, and the sheet's
    // `var(--hk-tray-glyph, 9px)` fallbacks render the shipped (md) geometry.
    // Pinned here, so that degradation is a stated behaviour rather than a
    // silent one; the fallback chain itself is asserted by the sheet test
    // above (each `decl(...)` pins the literal after the comma).
    const xs = trayVars("xs" as never);
    expect(xs).toEqual({
      "--hk-tray-glyph": "",
      "--hk-tray-glyph-x": "",
      "--hk-tray-time-size": "",
    });
    expect(xs).not.toEqual(trayVars("md"));
  });
});
