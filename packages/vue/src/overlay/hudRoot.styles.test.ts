import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

import { HUD_ROOT_DOCUMENT_Z, HUD_ROOT_SELECTOR, ensureHudRoot } from "./hudRoot";

/**
 * Contract for the ambient HUD root (2026-11-05 identify defect): the
 * root must lift always-visible, non-interactive annotations ABOVE the
 * whole popup tree — the modal backdrop included — while staying below
 * the error landing and the window titlebar. The three agreeing places
 * (scale.scss band, compiled sheet, inline self-sufficient cssText) are
 * pinned here, mirroring overlayRoot.styles.test.ts.
 */
const overlayDir = resolve(dirname(fileURLToPath(import.meta.url)));
const vueSrc = resolve(overlayDir, "..");

describe("ambient HUD root elevation contract", () => {
  const css = compile(resolve(overlayDir, "hudRoot.scss"), {
    style: "expanded",
  }).css;
  const scale = readFileSync(resolve(vueSrc, "scale.scss"), "utf8");
  const source = readFileSync(resolve(overlayDir, "hudRoot.ts"), "utf8");

  it("declares the elevation in the sheet, with the fence kept", () => {
    expect(css).toContain("z-index: var(--hk-z-hud, 90050);");
    expect(css).toContain("isolation: isolate;");
    expect(css).toContain("position: relative;");
    // The root itself is a ghost: only the layers inside it may take
    // pointer input (and the identify card never does).
    expect(css).toContain("pointer-events: none;");
  });

  it("keeps scale.scss, the sheet fallback and the TS fallback on one value", () => {
    const band = scale.match(/--hk-z-hud:\s*(\d+)/);
    expect(band, "--hk-z-hud must be defined in scale.scss").not.toBeNull();
    expect(Number(band![1])).toBe(HUD_ROOT_DOCUMENT_Z);
    // The inline cssText interpolates the same constant.
    expect(source).toContain(
      "z-index:var(--hk-z-hud,${HUD_ROOT_DOCUMENT_Z})",
    );
  });

  it("parks the HUD between the popup tree and the two top-owners", () => {
    const value = (name: string) => {
      const m = scale.match(new RegExp(`--hk-z-${name}:\\s*(\\d+)`));
      expect(m, `--hk-z-${name} must stay defined in scale.scss`).not.toBeNull();
      return Number(m![1]);
    };
    // Above the popup tree (the defect: the modal backdrop buried the
    // hand-written z-index 5000 card)…
    expect(value("hud")).toBeGreaterThan(value("overlay-root"));
    // …and below the deliberate top-owners.
    expect(value("hud")).toBeLessThan(value("error"));
    expect(value("hud")).toBeLessThan(value("titlebar"));
  });

  it("creates a pointer-transparent, non-aria-hidden root", () => {
    const root = ensureHudRoot();
    if (!root) throw new Error("HUD root was not created");
    expect(root.id).toBe("hk-hud-root");
    expect(document.querySelector(HUD_ROOT_SELECTOR)).toBe(root);
    expect(root.style.getPropertyValue("z-index")).toContain("var(--hk-z-hud");
    expect(root.style.getPropertyValue("position")).toBe("relative");
    expect(root.style.getPropertyValue("isolation")).toBe("isolate");
    expect(root.style.getPropertyValue("pointer-events")).toBe("none");
    // Unlike #hk-overlay-root, HUD content may announce itself
    // (role="status" on the identify card), so the root must NOT be
    // wholesale hidden from the accessibility tree.
    expect(root.hasAttribute("aria-hidden")).toBe(false);
  });

  it("idempotently reuses the existing root", () => {
    const first = ensureHudRoot();
    const second = ensureHudRoot();
    expect(second).toBe(first);
    expect(document.querySelectorAll(HUD_ROOT_SELECTOR)).toHaveLength(1);
  });

  it("ships its sheet through the aggregate style entry", () => {
    // Consumers import @celestia-island/hikari/styles exactly once; a
    // root sheet missing from the aggregate would leave the band
    // fallback-only in browsers whose inline-style path was stripped.
    const aggregate = readFileSync(resolve(vueSrc, "styles", "index.scss"), "utf8");
    expect(aggregate).toContain('@use "../overlay/hudRoot.scss";');
  });
});
