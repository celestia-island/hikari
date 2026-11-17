import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

import { TOP_ROOT_DOCUMENT_Z, TOP_ROOT_SELECTOR, ensureTopRoot } from "./topRoot";

/**
 * Contract for the above-titlebar root (2026-11-17 user direction): the
 * window titlebar stays the topmost layer of the PAGE (modal veils keep
 * yielding to it — the chrome-band contract), but the caption band's OWN
 * attachments — the notification center, the top-bar menus, and the
 * tooltips explicitly allowed to pin over the strip — must paint above
 * it. The three agreeing places (scale.scss band, compiled sheet, inline
 * self-sufficient cssText) are pinned here, mirroring
 * hudRoot.styles.test.ts.
 */
const overlayDir = resolve(dirname(fileURLToPath(import.meta.url)));
const vueSrc = resolve(overlayDir, "..");

describe("above-titlebar root elevation contract", () => {
  const css = compile(resolve(overlayDir, "topRoot.scss"), {
    style: "expanded",
  }).css;
  const scale = readFileSync(resolve(vueSrc, "scale.scss"), "utf8");
  const source = readFileSync(resolve(overlayDir, "topRoot.ts"), "utf8");

  it("declares the elevation in the sheet, with the fence kept", () => {
    expect(css).toContain("z-index: var(--hk-z-top-layer, 100002);");
    expect(css).toContain("isolation: isolate;");
    expect(css).toContain("position: relative;");
    // The root itself is a ghost: only the layers inside it may take
    // pointer input.
    expect(css).toContain("pointer-events: none;");
  });

  it("keeps scale.scss, the sheet fallback and the TS fallback on one value", () => {
    const band = scale.match(/--hk-z-top-layer:\s*(\d+)/);
    expect(band, "--hk-z-top-layer must be defined in scale.scss").not.toBeNull();
    expect(Number(band![1])).toBe(TOP_ROOT_DOCUMENT_Z);
    // The inline cssText interpolates the same constant.
    expect(source).toContain(
      "z-index:var(--hk-z-top-layer,${TOP_ROOT_DOCUMENT_Z})",
    );
  });

  it("parks the top root ABOVE the window titlebar, the page's top owner", () => {
    const value = (name: string) => {
      const m = scale.match(new RegExp(`--hk-z-${name}:\\s*(\\d+)`));
      expect(m, `--hk-z-${name} must stay defined in scale.scss`).not.toBeNull();
      return Number(m![1]);
    };
    // Above the titlebar layer — the whole reason the root exists…
    expect(value("top-layer")).toBeGreaterThan(value("titlebar"));
    // …and above every other floating band, so a caption attachment is
    // never buried by an overlay that still sits under the band.
    expect(value("top-layer")).toBeGreaterThan(value("emergency"));
    expect(value("top-layer")).toBeGreaterThan(value("hud"));
    expect(value("top-layer")).toBeGreaterThan(value("overlay-root"));
  });

  it("creates a pointer-transparent, non-aria-hidden root", () => {
    const root = ensureTopRoot();
    if (!root) throw new Error("top root was not created");
    expect(root.id).toBe("hk-top-root");
    expect(document.querySelector(TOP_ROOT_SELECTOR)).toBe(root);
    expect(root.style.getPropertyValue("z-index")).toContain("var(--hk-z-top-layer");
    expect(root.style.getPropertyValue("position")).toBe("relative");
    expect(root.style.getPropertyValue("isolation")).toBe("isolate");
    expect(root.style.getPropertyValue("pointer-events")).toBe("none");
    // The root hosts interactive surfaces (menu/popover dialog roles);
    // hiding it from the accessibility tree would hide them too.
    expect(root.hasAttribute("aria-hidden")).toBe(false);
  });

  it("idempotently reuses the existing root", () => {
    const first = ensureTopRoot();
    const second = ensureTopRoot();
    expect(second).toBe(first);
    expect(document.querySelectorAll(TOP_ROOT_SELECTOR)).toHaveLength(1);
  });
});
