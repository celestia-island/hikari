/**
 * Source contract for the immersive lightbox layout (2026-09-11 field
 * report wave). Pinned as scss-text assertions because the failure class
 * is invisible to DOM tests: happy-dom has no layout engine, so a
 * collapsed flex chain (the "white lightbox" — viewer 0px tall inside a
 * full-size modal frame) and a cascade-losing hover state (the floating
 * close button melting into the page) both pass every render test.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(here, f), "utf-8");

describe("HkImageLightbox layout contract", () => {
  it("makes the modal scroll region a flex container so the body chain can fill the frame", () => {
    const css = read("HkImageLightbox.scss");
    // The lightbox override block must carry the display itself: the inner
    // only carries flex: 1, which is inert inside a block parent — without
    // this the stage collapses to its padding and the viewer renders 0px
    // tall (white canvas, dead gestures).
    const block = css.slice(
      css.indexOf(".hk-modal-content.hk-image-lightbox"),
      css.indexOf(".hk-image-lightbox-stage"),
    );
    expect(block).toContain(".hk-modal-body-scroll");
    expect(block).toMatch(/\.hk-modal-body-scroll\s*\{[^}]*display:\s*flex/);
  });

  it("re-asserts the dark chip on hover/focus above the window-close cascade", () => {
    const css = read("HkImageLightbox.scss");
    // window-close.scss's :hover paints the light theme tint and loses to
    // nothing here — the lightbox hover must re-assert the real background
    // (not just the custom properties) at higher specificity, and push the
    // color into the glyph span (which keeps its own white declaration).
    expect(css).toContain("&.hk-window-close:hover");
    expect(css).toContain("&.hk-window-close:focus-visible");
    const hoverBlock = css.slice(css.indexOf("&.hk-window-close:hover"));
    expect(hoverBlock.indexOf("background:")).toBeGreaterThan(-1);
    expect(hoverBlock).toContain(".hk-icon-button-icon");
  });
});
