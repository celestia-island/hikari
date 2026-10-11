import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Source contract for the shared overlay-scrollbar chrome.
 *
 * The `.hk-scrollbar-track` / `.hk-scrollbar-thumb` DOM is created
 * imperatively by useOverlayScrollbar; its styling lives in the theme
 * partial `packages/theme/styles/_scrollbar.scss`, vendored byte-exact
 * into `src/styles/theme/scrollbar.scss` (see vendoredSync.test.ts for
 * the drift guard). This contract reads the SHIPPED vendored copy — the
 * one npm consumers resolve through the `./styles/*` export — and pins
 * the two properties the error landing's themeless contract depends on:
 *
 * 1. Thumb color must survive a missing `--hi-color-muted`: HkErrorLanding
 *    is designed to render standalone (server error page without hikari
 *    theme init; its SCSS carries `--hel-*` fallbacks for exactly that
 *    case). An unfallback'd `var(--hi-color-muted)` inside `color-mix()`
 *    computes the whole color to invalid-at-computed-value-time — the
 *    thumb renders invisible on BOTH axes while the pane's CSS hides the
 *    native bar, i.e. no scrollbar at all. (2026-10-01: found while
 *    giving the error details pane its horizontal overlay track.)
 * 2. Both axis rails exist with their axis-keyed selectors — the engine
 *    mounts a `data-axis="horizontal"` track and an attribute-less
 *    vertical track; the chrome must style both.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../styles");
const chrome = readFileSync(resolve(stylesDir, "theme", "scrollbar.scss"), "utf8");

describe("overlay scrollbar chrome contract", () => {
  it("ships real chrome (positive control for the reads below)", () => {
    // Zero-yield guard: these extractions must prove they saw the file.
    expect(chrome).toContain(".hk-scrollbar-track");
    expect(chrome).toContain(".hk-scrollbar-thumb");
    expect(chrome.length).toBeGreaterThan(200);
  });

  it("styles both axis rails with their axis-keyed selectors", () => {
    expect(chrome).toMatch(/\.hk-scrollbar-track\[data-axis="horizontal"\]/);
    expect(chrome).toMatch(/\.hk-scrollbar-track:not\(\[data-axis="horizontal"\]\)/);
  });

  it("keeps the thumb visible without --hi-color-muted (themeless render)", () => {
    // Every color-mix() over the muted channel must carry a fallback.
    // (Match to the declaration's semicolon: the fallback's own `)` would
    // truncate a paren-counting match.)
    const mixes = chrome.match(/color-mix\([^;]+/g) ?? [];
    // Positive control: the file is known to mix the muted channel at the
    // resting and hovered/dragged opacities — a rename would 0-match and
    // make this check vacuously green, so pin the count too.
    expect(mixes.length).toBeGreaterThanOrEqual(2);
    const muted = mixes.filter((m) => m.includes("--hi-color-muted"));
    expect(muted.length).toBeGreaterThanOrEqual(2);
    for (const mix of muted) {
      expect(
        mix,
        "color-mix over --hi-color-muted must declare a fallback color",
      ).toMatch(/var\(--hi-color-muted,\s*rgb\(118 122 128\)\)/);
    }
  });

  it("keeps the rails pointer-transparent until they flash in", () => {
    // An invisible rail must never steal clicks from the content hugging
    // the region's edge (end-of-line links) — pointer-events: none at
    // rest, auto only while visible.
    expect(chrome).toMatch(/\.hk-scrollbar-track\s*\{[^}]*pointer-events:\s*none/);
    expect(chrome).toMatch(/&?\.is-scrolling,\s*&?\.is-hovering\s*\{[^}]*pointer-events:\s*auto/);
  });

  it("keeps the change-mark rail clear of the track and out of the click path", () => {
    // The rail is a SECOND overlay in the same corner. Two facts have to
    // survive any future restyle:
    //
    //  1. It must not overlap the track (right 2px + width 6px), or marks
    //     would draw across the thumb;
    //  2. it must not take pointer input — it spans the WHOLE host, docks
    //     included, so a live hot zone there eats presses meant for
    //     right-aligned dock controls. Only the marks accept input, and
    //     that exemption is exactly why the rail itself must stay `none`.
    // The vertical geometry lives in the track's own nested
    // `&:not([data-axis="horizontal"])` block, not a top-level selector.
    const track = /&:not\(\[data-axis="horizontal"\]\)\s*\{[^}]*\}/.exec(chrome)?.[0] ?? "";
    expect(track, "positive control: the vertical track rule was found").not.toBe("");
    const trackRight = Number(/right:\s*(\d+)px/.exec(track)?.[1]);
    const trackWidth = Number(/width:\s*(\d+)px/.exec(track)?.[1]);

    const rail = /\.hk-scrollbar-markers\s*\{[^}]*\}/.exec(chrome)?.[0] ?? "";
    expect(rail, "positive control: the rail rule was found").not.toBe("");
    const railRight = Number(/right:\s*(\d+)px/.exec(rail)?.[1]);
    const railWidth = Number(/width:\s*(\d+)px/.exec(rail)?.[1]);

    expect(
      railRight,
      "the rail starts outboard of the track's inner edge",
    ).toBeGreaterThanOrEqual(trackRight + trackWidth);
    expect(railRight + railWidth, "and stays inside the host").toBeLessThanOrEqual(24);

    expect(rail, "the rail itself takes no pointer input").toMatch(/pointer-events:\s*none/);
    const marker = /\.hk-scrollbar-marker\s*\{[^}]*\}/.exec(chrome)?.[0] ?? "";
    expect(marker, "positive control: the mark rule was found").not.toBe("");
    expect(marker, "the marks are the hit area").toMatch(/pointer-events:\s*auto/);
  });
});
