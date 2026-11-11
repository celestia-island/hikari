/**
 * Contract for the surface live-blur ESCAPE HATCH (2026-11-12 chest WebView
 * field report: "some dynamic UI content disappears and is clipped in
 * place", chronic in an Android System WebView shell, occasional on desktop
 * at the exact moment a screen capture forces a full-surface re-raster).
 *
 * Mechanism, not viewport: `.hk-card` and `.hk-btn-secondary` each carry a
 * `backdrop-filter`, so every one of them allocates its own background
 * render surface and re-samples it on each composite of its subtree. When
 * the layer beneath is already an opaque surface, the blur samples a flat
 * color — zero visual gain — while the surface allocation still competes for
 * a tile/VRAM budget. On a small-budget compositor that allocation is the
 * first thing to fail, and the failure keeps the box but drops the pixels.
 * A modal with four cards plus a secondary footer button therefore stacks
 * five of them inside one fixed, transformed, contained sheet.
 *
 * The family fix is a host-tunable knob per surface. Two invariants this
 * file pins, both of them load-bearing:
 *
 *   1. every such surface consumes `--hk-<surface>-blur` with the previous
 *      literal as its fallback, so no host loses the current look by
 *      upgrading hikari, and a host can stand the pass down per ENGINE;
 *   2. the knob is DELIBERATELY NOT width-gated. The modal family's
 *      `-mobile` knobs default to none ≤767px; copying that shape here would
 *      re-key the stand-down to the viewport, and the artifact follows the
 *      compositor, not the width — a phone WebView in "request desktop
 *      site" mode reports a ~980px layout viewport and a tablet reports a
 *      wide one, both still running the same starved engine. A future
 *      "helpful" `@media (max-width: 767px) { --hk-card-blur: none }` would
 *      silently reopen the report on exactly those hosts, so it fails here.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "sass";

const here = dirname(fileURLToPath(import.meta.url));

function compiledSheet(sheet: string, loadPaths: string[]): string {
  return compile(join(here, sheet), { loadPaths, style: "expanded" }).css;
}

const loadPaths = [here, join(here, "..", "styles")];

/** Brace-matched `@media <query> { … }` blocks of a sheet source. */
function sourceMediaBlocks(src: string): Array<{ head: string; body: string }> {
  const blocks: Array<{ head: string; body: string }> = [];
  let from = 0;
  for (;;) {
    const at = src.indexOf("@media", from);
    if (at < 0) break;
    const open = src.indexOf("{", at);
    let depth = 0;
    let i = open;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth += 1;
      else if (src[i] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    blocks.push({ head: src.slice(at + "@media".length, open).trim(), body: src.slice(open, i + 1) });
    from = i + 1;
  }
  return blocks;
}

/** Declarations the compiled sheet emits for one selector, un-prefixed. */
function declarationsFor(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} missing from the compiled sheet`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("surface live-blur escape hatch", () => {
  it("routes the card blur through --hk-card-blur, keeping the old literal as the fallback", () => {
    const decls = declarationsFor(compiledSheet("HkCard.scss", loadPaths), ".hk-card");
    expect(decls).toContain("backdrop-filter: var(--hk-card-blur, blur(var(--blur-md)));");
    // The webkit-prefixed twin rides the same knob (see styles/polyfill).
    expect(decls).toContain("-webkit-backdrop-filter: var(--hk-card-blur, blur(var(--blur-md)));");
  });

  it("routes the secondary button blur through --hk-btn-secondary-blur", () => {
    const decls = declarationsFor(
      compiledSheet("HkButton.scss", loadPaths),
      ".hk-btn-secondary",
    );
    expect(decls).toContain("backdrop-filter: var(--hk-btn-secondary-blur, blur(var(--blur-sm)));");
  });

  it.each(["HkCard.scss", "HkButton.scss"])(
    "keeps %s engine-gated: no width-gated stand-down may appear for these surfaces",
    (sheet) => {
      const src = readFileSync(join(here, sheet), "utf-8");
      // Any `--hk-card-blur` / `--hk-btn-secondary-blur` assignment inside a
      // width media query would re-key the stand-down to the viewport. Scope
      // the search to each media block's own brace-matched body — the sheet
      // legitimately carries width queries for other concerns (label
      // collapse), so "after the first @media" is not a usable boundary.
      for (const block of sourceMediaBlocks(src)) {
        if (!/max-width/.test(block.head)) continue;
        for (const knob of ["--hk-card-blur", "--hk-btn-secondary-blur"]) {
          expect(block.body, `${knob} assigned inside "${block.head}"`).not.toContain(knob);
        }
      }
    },
  );
});
