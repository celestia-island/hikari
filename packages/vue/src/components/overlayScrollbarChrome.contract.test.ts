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

  it("widens the track into the ruler and keeps the click rules straight", () => {
    // The marks live INSIDE the track, which widens only when it carries
    // them (`.has-markers`) — VS Code's overview ruler is the scrollbar's
    // own strip widened, not a second strip. Three facts must survive any
    // future restyle:
    //
    //  1. The widened ground is FAINT and theme-adaptive (a translucent
    //     mid-grey: grey over a light page, slightly lighter over a dark
    //     one), with the 2px rounding the band promised;
    //  2. it stays pointer-transparent AT REST — the widened band spans
    //     the whole host, docks included, and a live hot zone there would
    //     eat presses meant for right-aligned dock controls;
    //  3. the MARKS are the hit area and hug the band's edges: removed
    //     content at the start, added at the end (VS Code's two lanes),
    //     so one vertical position can carry both.
    expect(chrome, "no second strip — the separate rail is gone").not.toContain(".hk-scrollbar-markers");

    const widened = /&\.has-markers:not\(\[data-axis="horizontal"\]\)\s*\{[^}]*\}/.exec(chrome)?.[0] ?? "";
    expect(widened, "positive control: the widened-band rule was found").not.toBe("");
    expect(widened, "the ground is faint (translucent grey)").toMatch(
      /color-mix\(in srgb,\s*var\(--hi-color-muted,\s*rgb\(118 122 128\)\)\s*\d+%,\s*transparent\)/,
    );
    expect(widened, "the band keeps its 2px rounding").toMatch(/border-radius:\s*2px/);
    expect(widened, "and a parameterised width the engine overrides").toMatch(/width:\s*\d+px/);
    // The base track's own pointer contract (pinned above) is untouched;
    // the widened rule must not sneak a `pointer-events: auto` in.
    expect(widened).not.toMatch(/pointer-events:\s*auto/);

    // The mark's whole rule (it is the file's last block, and its nested
    // lanes/hover/kind blocks make a single-block regex fragile).
    const markerBlock = chrome.slice(chrome.indexOf(".hk-scrollbar-marker {"));
    expect(markerBlock, "positive control: the mark rule was found").not.toBe("");
    expect(markerBlock, "the marks are the hit area").toMatch(/pointer-events:\s*auto/);
    expect(markerBlock, "the band's 2px rounding reaches the marks").toMatch(/border-radius:\s*2px/);
    // The two lanes, at the band's edges (the rules nest inside the mark
    // selector, so they are written `&[data-side=…]`).
    expect(markerBlock).toMatch(/&\[data-side="start"\]\s*\{[^}]*left:\s*0/);
    expect(markerBlock).toMatch(/&\[data-side="end"\]\s*\{[^}]*right:\s*0/);
    // …and their WIDTH: a restyle that silently stretched a lane across
    // the whole band would collapse the two-lane reading into one strip
    // (caught only by the vendored-sync byte comparison before this pin).
    expect(markerBlock, "the start lane hugs a third of the band").toMatch(
      /&\[data-side="start"\]\s*\{[^}]*width:\s*34%/,
    );
    expect(markerBlock, "and the end lane the other third").toMatch(
      /&\[data-side="end"\]\s*\{[^}]*width:\s*34%/,
    );
    // The hover ring must be drawn INSIDE the mark: the track clips its
    // children, and a plain outline loses both side strokes to that clip,
    // leaving a two-line "ring" that reads as a stray rule rather than a
    // hover cue. Nothing else would notice that regression.
    expect(markerBlock, "the hover ring is drawn inside the mark").toMatch(
      /outline-offset:\s*-1px/,
    );
  });
});
