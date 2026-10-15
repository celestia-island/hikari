import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

import { OVERLAY_ROOT_DOCUMENT_Z, ensureOverlayRoot } from "./overlayRoot";

/**
 * Compiled-stylesheet + cross-file contract for the overlay root's
 * document-space elevation. `isolation` fences the root's INTERNAL
 * ordinals but does not lift the root above app chrome — without the
 * elevation, any fixed/sticky bar with a positive z-index (the admin
 * status bar's --hk-z-toolbar: 50) painted over every floating layer
 * and the connection popover ended up behind the panel footer
 * (2026-10-15 defect report). These assertions pin the elevation in
 * all three places it must agree: scale.scss (the band), the compiled
 * sheet, and the inline self-sufficient cssText.
 */
const overlayDir = resolve(dirname(fileURLToPath(import.meta.url)));
const vueSrc = resolve(overlayDir, "..");

function sourcesIn(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourcesIn(path));
    else if (/\.(scss|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

describe("overlay root document-space elevation contract", () => {
  const css = compile(resolve(overlayDir, "overlayRoot.scss"), {
    style: "expanded",
  }).css;
  const scale = readFileSync(resolve(vueSrc, "scale.scss"), "utf8");
  const source = readFileSync(resolve(overlayDir, "overlayRoot.ts"), "utf8");

  it("declares the elevation in the sheet, with the fence kept", () => {
    expect(css).toContain("z-index: var(--hk-z-overlay-root, 90000);");
    expect(css).toContain("isolation: isolate;");
    expect(css).toContain("position: relative;");
  });

  it("keeps scale.scss, the sheet fallback and the TS fallback on one value", () => {
    const band = scale.match(/--hk-z-overlay-root:\s*(\d+)/);
    // A missing match is a broken contract, not an empty pass.
    expect(band).not.toBeNull();
    expect(Number(band![1])).toBe(OVERLAY_ROOT_DOCUMENT_Z);
    // The inline cssText interpolates the same constant.
    expect(source).toContain(
      "z-index:var(--hk-z-overlay-root,${OVERLAY_ROOT_DOCUMENT_Z})",
    );
  });

  it("parks the band between the floating bands and error/titlebar", () => {
    const value = (name: string) => {
      const m = scale.match(new RegExp(`--hk-z-${name}:\\s*(\\d+)`));
      expect(m, `--hk-z-${name} must stay defined in scale.scss`).not.toBeNull();
      return Number(m![1]);
    };
    const band = value("overlay-root");
    // Above every content-chrome band (the defect: footer at 50 won).
    expect(band).toBeGreaterThan(value("tooltip"));
    expect(band).toBeGreaterThan(value("modal"));
    expect(band).toBeGreaterThan(value("toolbar"));
    // Below the two surfaces that intentionally stay on top, exactly as
    // in the pre-isolation global scale.
    expect(band).toBeLessThan(value("error"));
    expect(band).toBeLessThan(value("titlebar"));
  });

  it("inlines a self-sufficient pre-stylesheet elevation", () => {
    const root = ensureOverlayRoot();
    expect(root.id).toBe("hk-overlay-root");
    expect(root.style.getPropertyValue("z-index")).toContain(
      "var(--hk-z-overlay-root",
    );
    expect(root.style.getPropertyValue("position")).toBe("relative");
  });

  it("lets no z-index consumer land between the root band and the error band", () => {
    // The exact gap class the 2026-10-15 fix closed: a document-space
    // surface that must own the top (hikari's error landing) sat at
    // --hk-z-modal = 5000, and the elevated root silently jumped over
    // it. Every --hk-z-* consumer must resolve STRICTLY below the root
    // band (content chrome) or be one of the two intentional
    // top-owners, which must stay ABOVE it — nothing ties the band
    // (a tie would be DOM-order roulette) and nothing lands between
    // the two bands. Consumers are matched anywhere INSIDE a
    // z-index-bearing line, so calc()/nested-fallback wrappers
    // (`var(--x, var(--hk-z-scrollbar))`) are still inventoried; their
    // ARITHMETIC is not evaluated (a calc() offset off a top-owner
    // token is textual guessing — same out-of-scope class as raw
    // numbers, audited by hand at ≤ 51 in this package). Single-line
    // declarations only.
    const bandValues = new Map<string, number>();
    for (const [, name, num] of scale.matchAll(/--hk-z-([a-z-]+):\s*(\d+)/g)) {
      bandValues.set(name, Number(num));
    }
    // The ladder itself must be present — a broken parse must not
    // masquerade as an empty pass.
    expect(bandValues.size).toBeGreaterThanOrEqual(10);
    expect(bandValues.get("overlay-root")).toBe(OVERLAY_ROOT_DOCUMENT_Z);

    const sources = sourcesIn(vueSrc);
    // Positive floor for the walk: hundreds of sheets/components live
    // under src/ — fewer means the glob broke, not that the code did.
    expect(sources.length).toBeGreaterThanOrEqual(200);

    const found = new Map<string, Set<string>>(); // token name -> files
    for (const file of sources) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (!/\bz-index\s*[:=]|\bzIndex\s*[:=]/.test(line)) continue;
        for (const [, name] of line.matchAll(/var\(\s*--hk-z-([a-z-]+)/g)) {
          if (!found.has(name)) found.set(name, new Set());
          found.get(name)!.add(file);
        }
      }
    }
    // Positive controls: the scan must see the known top-owners and the
    // root itself, or the line patterns stopped matching.
    for (const required of ["overlay-root", "error", "titlebar", "toolbar"]) {
      expect(
        found.has(required),
        `scan lost the --hk-z-${required} consumer — patterns rotted`,
      ).toBe(true);
    }

    // File binding, not just name presence: the error takeover's
    // "never covered" promise lives in ONE sheet — assert IT consumes
    // the top-owner band, so the promise survives even if a second
    // --hk-z-error consumer appears elsewhere.
    const errorSheet = join(vueSrc, "errorReporting", "HkErrorReportingOverlay.scss");
    expect(readFileSync(errorSheet, "utf8")).toMatch(
      /z-index:\s*var\(\s*--hk-z-error[\s,)]/,
    );
    const titlebarSheet = join(vueSrc, "components", "HkTitleBar.scss");
    expect(readFileSync(titlebarSheet, "utf8")).toMatch(
      /z-index:\s*var\(\s*--hk-z-titlebar[\s,)]/,
    );

    const topOwners = new Set(["error", "titlebar"]);
    const rootSheet = resolve(overlayDir, "overlayRoot.scss");
    for (const [name, files] of found) {
      const value = bandValues.get(name);
      expect(
        value,
        `--hk-z-${name} consumed (e.g. ${files.values().next().value}) but not defined in scale.scss`,
      ).not.toBeUndefined();
      if (topOwners.has(name)) {
        // A top-owner demoted to/below the root band would be painted
        // over by the floating tree (the error landing sat at
        // --hk-z-modal = 5000 when this guard was born).
        expect(
          value!,
          `--hk-z-${name} (${value}) must stay above the overlay root band ` +
            `(${OVERLAY_ROOT_DOCUMENT_Z}) — consumers: ${[...files].join(", ")}`,
        ).toBeGreaterThan(OVERLAY_ROOT_DOCUMENT_Z);
      } else if (name === "overlay-root") {
        // The band itself: ONLY the root's own sheet may sit at it —
        // any other consumer at exactly 90000 races the root by DOM
        // order.
        for (const file of files) {
          expect(
            file,
            `--hk-z-overlay-root consumed at ${file} — only ${rootSheet} may tie the band`,
          ).toBe(rootSheet);
        }
      } else {
        expect(
          value!,
          `--hk-z-${name} (${value}) at ${[...files].join(", ")} must resolve ` +
            `strictly below the overlay root band (${OVERLAY_ROOT_DOCUMENT_Z}) ` +
            `or above the error band — ties and in-between values get painted ` +
            `over by (or paint over) the floating tree`,
        ).toBeLessThan(OVERLAY_ROOT_DOCUMENT_Z);
      }
    }
  });
});

