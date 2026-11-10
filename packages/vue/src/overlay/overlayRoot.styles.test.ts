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
    // Production sources only: the ladder guard must see inline
    // document-space elevations written from TS too (hudRoot.ts is one),
    // while test files' assertions are not consumers.
    else if (
      /\.(scss|tsx|ts)$/.test(entry) &&
      !/\.test\.(ts|tsx)$/.test(entry)
    ) {
      out.push(path);
    }
  }
  return out;
}

describe("overlay root accessibility contract (#1206)", () => {
  it("creates a root that is NOT aria-hidden", () => {
    // The root USED to be created wholesale aria-hidden (2026-11-10
    // a11y review). Since HkModal / HkDrawer / HkToast / every floating
    // layer teleport INTO this root, that hid the whole popup subtree
    // from the accessibility tree — role="dialog", aria-modal,
    // aria-label and aria-busy never reached AT. Decorative layers
    // declare their own aria-hidden where needed (the modal blur
    // plate); the root itself must stay out of the hiding business,
    // exactly like hudRoot's documented contract.
    const root = ensureOverlayRoot();
    if (!root) throw new Error("overlay root was not created");
    expect(root.id).toBe("hk-overlay-root");
    expect(root.hasAttribute("aria-hidden")).toBe(false);
  });

  it("keeps the root free of an aria-hidden writer", () => {
    // Guard the fix at the source level too: the module must not grow a
    // new setAttribute writer for the root's aria-hidden (the same
    // regression the runtime assertion above catches, caught statically).
    // The comment deliberately NAMES the attribute to explain its
    // absence, so this matches the writer shape, not the word.
    const source = readFileSync(resolve(overlayDir, "overlayRoot.ts"), "utf8");
    expect(source).not.toMatch(/setAttribute\(["']aria-hidden/);
  });
});

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

  it("parks the band between the floating bands and the HUD/error/titlebar", () => {
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
    // Below the ambient HUD (always-visible annotations must paint above
    // the whole popup tree) and below the two surfaces that intentionally
    // stay on top, exactly as in the pre-isolation global scale.
    expect(band).toBeLessThan(value("hud"));
    expect(value("hud")).toBeLessThan(value("error"));
    expect(value("hud")).toBeLessThan(value("titlebar"));
  });

  it("inlines a self-sufficient pre-stylesheet elevation", () => {
    const root = ensureOverlayRoot();
    // A null root is a failure of the very contract under test, so say so
    // instead of letting a TypeError stand in for it.
    if (!root) throw new Error("overlay root was not created");
    expect(root.id).toBe("hk-overlay-root");
    expect(root.style.getPropertyValue("z-index")).toContain(
      "var(--hk-z-overlay-root",
    );
    expect(root.style.getPropertyValue("position")).toBe("relative");
  });

  it("keeps every z-index consumer on a sanctioned rung of the ladder", () => {
    // The exact gap class the 2026-10-15 fix closed: a document-space
    // surface that must own the top (hikari's error landing) sat at
    // --hk-z-modal = 5000, and the elevated root silently jumped over
    // it. Every --hk-z-* consumer must resolve STRICTLY below the root
    // band (content chrome), be one of the two intentional top-owners
    // (which must stay ABOVE it), or be the ambient HUD band — the ONE
    // sanctioned rung between the popup tree and the top-owners
    // (2026-11-05 identify defect: the card must out-paint the modal
    // backdrop). Nothing ties a band (a tie would be DOM-order
    // roulette). Consumers are matched anywhere INSIDE a
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
    for (const required of ["overlay-root", "hud", "error", "titlebar", "toolbar"]) {
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
    // The root rung has the same two-owner shape as the HUD rung: the
    // sheet owns the CSS declaration, the factory owns the inline
    // pre-stylesheet one.
    const rootOwners = new Set([rootSheet, resolve(overlayDir, "overlayRoot.ts")]);
    const hudSheet = resolve(overlayDir, "hudRoot.scss");
    // The HUD rung has TWO owners that must agree: the sheet (CSS) and the
    // factory (inline, pre-stylesheet). Both are allowlisted; a third
    // consumer at 90050 would race the root by DOM order.
    const hudOwners = new Set([hudSheet, resolve(overlayDir, "hudRoot.ts")]);
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
            rootOwners.has(file),
            `--hk-z-overlay-root consumed at ${file} — only ${[...rootOwners].join(" / ")} may tie the band`,
          ).toBe(true);
        }
      } else if (name === "hud") {
        // The one sanctioned band BETWEEN the popup tree and the
        // top-owners: the ambient HUD root (2026-11-05 identify
        // defect). It must stay strictly above the overlay root and
        // strictly below error/titlebar, and only its own sheet may
        // consume it — a second consumer at 90050 would race the HUD
        // root by DOM order.
        expect(
          value!,
          `--hk-z-hud (${value}) must sit strictly above the overlay root ` +
            `(${OVERLAY_ROOT_DOCUMENT_Z}) and below the error band — consumers: ` +
            `${[...files].join(", ")}`,
        ).toBeGreaterThan(OVERLAY_ROOT_DOCUMENT_Z);
        expect(value!).toBeLessThan(bandValues.get("error")!);
        for (const file of files) {
          expect(
            hudOwners.has(file),
            `--hk-z-hud consumed at ${file} — only ${[...hudOwners].join(" / ")} may own the HUD band`,
          ).toBe(true);
        }
      } else {
        expect(
          value!,
          `--hk-z-${name} (${value}) at ${[...files].join(", ")} must resolve ` +
            `strictly below the overlay root band (${OVERLAY_ROOT_DOCUMENT_Z}) ` +
            `— ties and the band between the root and error are reserved for ` +
            `their owners (hudRoot.scss / the two top-owners)`,
        ).toBeLessThan(OVERLAY_ROOT_DOCUMENT_Z);
      }
    }
  });
});

