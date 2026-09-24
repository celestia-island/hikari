import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Source contract for the wallpaper backdrop's sheet and its DOM ownership.
 *
 * Two things here cannot be asserted behaviourally in happy-dom (which
 * applies no CSS) and must not be left to the consumer to remember:
 *
 *  S1  ≤767px the wallpaper layers drop `will-change` (and the ROOT drops
 *      its own promotion). This is chest's 2026-09-21 phone-IME
 *      black-block fix; it lived in the consumer's `theme.scss`, so a host
 *      that mounted the ported renderer without also copying those rules
 *      re-introduced the flicker. The rule now travels with the component.
 *      (The host's half — `body { background-attachment: scroll }` — stays
 *      in the consumer sheet: `body` is not this component's element.)
 *
 *  S2  the component writes NO page-global state: no `document.body`
 *      prepend/append, no `document.documentElement` style or dataset
 *      writes. That was the ported renderer's ownership bug in miniature
 *      (`--wallpaper-image`, `--wallpaper-solid-color`,
 *      `html[data-wallpaper-art]`); the DOM half is asserted behaviourally
 *      in HkWallpaperBackdrop.test.tsx, and this is the source fence that
 *      catches a re-introduction in a path no test happens to execute.
 *
 * Extraction discipline (the zero-hit-is-not-clean rule): every block
 * assertion proves its anchor exists first, and media containment is
 * verified by a real brace-matched scan rather than "slice to EOF".
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string): string => readFileSync(join(here, rel), "utf-8");

const sheet = read("./HkWallpaperBackdrop.scss");
const tsx = read("./HkWallpaperBackdrop.tsx");

interface MediaRegion {
  query: string;
  start: number;
  end: number;
}

/** Scan top-level `@media … { … }` regions with real brace matching. */
function mediaRegions(src: string): MediaRegion[] {
  const regions: MediaRegion[] = [];
  const re = /@media[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const start = m.index;
    let depth = 0;
    let end = src.length;
    for (let i = src.indexOf("{", start); i < src.length; i += 1) {
      if (src[i] === "{") depth += 1;
      else if (src[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    regions.push({ query: m[0], start, end });
  }
  return regions;
}

/** The declaration block of `selector` — brace-matched, so a rule appended
 *  after a nested block cannot slip past a `[^}]*` slice. */
function cssBlock(src: string, selector: string): string {
  const at = src.indexOf(selector);
  expect(at, `${selector} exists`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced block for ${selector}`);
}

describe("HkWallpaperBackdrop.scss — phone IME stand-down", () => {
  it("found the sheet's real content (positive control)", () => {
    expect(sheet).toContain(".hk-wallpaper-backdrop");
    expect(sheet).toContain("will-change: filter");
    expect(mediaRegions(sheet).length).toBeGreaterThan(0);
  });

  it("drops will-change on every wallpaper layer under 767px", () => {
    const mobile = mediaRegions(sheet).filter((r) => r.query.includes("max-width: 767px"));
    expect(mobile, "the ≤767px media region exists").toHaveLength(1);

    const region = sheet.slice(mobile[0]!.start, mobile[0]!.end);
    for (const selector of [
      ".hk-wallpaper-backdrop-img",
      ".hk-wallpaper-backdrop-video",
      ".hk-wallpaper-backdrop-canvas",
    ]) {
      expect(region, `${selector} stands down`).toContain(selector);
    }
    expect(region).toMatch(/will-change:\s*auto/);

    // …and the desktop rules still promote (the control that the mobile
    // block is a stand-down rather than the only rule).
    expect(cssBlock(sheet, ".hk-wallpaper-backdrop-img,\n.hk-wallpaper-backdrop-video")).toContain(
      "will-change: filter",
    );
    expect(cssBlock(sheet, ".hk-wallpaper-backdrop-canvas")).toContain("will-change: transform, filter");
  });

  it("keeps the viewport-fixed layering on the component's own root", () => {
    const root = cssBlock(sheet, ".hk-wallpaper-backdrop {");
    expect(root).toMatch(/position:\s*fixed/);
    expect(root).toMatch(/inset:\s*0/);
    expect(root).toMatch(/z-index:\s*-1/);
    expect(root).toMatch(/pointer-events:\s*none/);
    // The solid floor is a theme token, not a hard-coded colour.
    expect(root).toMatch(/background-color:\s*rgb\(var\(--color-background/);

    const layers = cssBlock(sheet, ".hk-wallpaper-backdrop-layer");
    expect(layers).toMatch(/position:\s*absolute/);
  });
});

/**
 * Code-only view of a source. Comments are stripped first: this component's
 * docstring NARRATES the ownership bug it fixes ("prepended them to
 * `document.body`"), and a fence that fires on its own explanation gets
 * deleted rather than fixed — the same lesson themeDecorLayout records.
 * A `//` can live inside a URL string in TSX, so line comments are only cut
 * where the line starts with one.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Placement/ownership needles, in the dialects the ported renderer used. */
const GLOBAL_WRITE_PATTERNS: Record<string, RegExp> = {
  "document.body": /\bdocument\.body\b/,
  "document.documentElement": /\bdocument\.documentElement\b/,
  "prepend(": /\bprepend\(/,
  "appendChild(": /\bappendChild\(/,
  "setProperty(": /\bsetProperty\(/,
  "dataset.": /\bdataset\./,
  "getElementById(": /\bgetElementById\(/,
};

function globalWriteHits(source: string): string[] {
  const code = stripComments(source);
  return Object.entries(GLOBAL_WRITE_PATTERNS)
    .filter(([, re]) => re.test(code))
    .map(([name]) => name);
}

describe("HkWallpaperBackdrop.tsx — no page-global DOM writes", () => {
  it("proves the detector fires on the bug it exists to prevent", () => {
    // The ported renderer's own lines, verbatim in shape.
    const knownBad = [
      'document.body.prepend(el);',
      'document.documentElement.style.setProperty("--wallpaper-image", "none");',
      'document.documentElement.dataset.wallpaperArt = "true";',
      'const el = document.getElementById("s-wallpaper-canvas");',
    ].join("\n");
    expect(globalWriteHits(knownBad)).toEqual([
      "document.body",
      "document.documentElement",
      "prepend(",
      "setProperty(",
      "dataset.",
      "getElementById(",
    ]);
    // …and prose about the same APIs is not a hit.
    expect(globalWriteHits("/* document.body.prepend() wrote --wallpaper-image */")).toEqual([]);
  });

  it("never touches document.body or documentElement", () => {
    expect(tsx).toContain("hk-wallpaper-backdrop"); // positive control
    expect(globalWriteHits(tsx)).toEqual([]);
  });

  it("does not read chest's fixed element ids", () => {
    // The registry + legacy fallback live in the theme layer, not here.
    expect(stripComments(tsx)).not.toContain("s-wallpaper-");
  });
});
