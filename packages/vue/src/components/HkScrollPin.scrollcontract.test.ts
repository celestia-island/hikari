/**
 * Source contract: THE SCROLL-PIN WHITESPACE CONTRACT (2026-09-14 user
 * report — the wizard's step header pinned flush against the modal
 * header because the body padding lives on .hk-modal-body-inner, a
 * wrapper child of the scroller; CSS sticky resolves its offsets against
 * the scrollport and never sees wrapper padding, so the pinned header
 * lost its whitespace the moment it engaged).
 *
 * The contract has two halves that must stay in sync:
 *  1. HOSTS declare `--hk-scroll-pad-*` on the scrolling viewport (class
 *     .hk-scroll-pin-host) and, when they paint their gutters themselves,
 *     carry `data-pad-cover` — pins then stop at the gutter line.
 *  2. PINS (HkScrollPin / .hk-scroll-pin) absorb or respect the declared
 *     padding per strategy; the bleed strategy's negative margin + padding
 *     pair is the load-bearing geometry and must never lose a side.
 *
 * Verified live in headless Chromium before pinning here: padding on the
 * scroller itself pins sticky children BELOW the padding (probe 2);
 * padding on a wrapper does not (probe 1) — hence the declared-vars
 * contract instead of "just move the padding".
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), "utf-8");

const pinScss = read("HkScrollPin.scss");
const modalScss = read("HkModal.scss");
const modalTsx = read("HkModal.tsx");
const stepflowScss = read("HkStepFlow.scss");
const stepflowTsx = read("HkStepFlow.tsx");
const fileBrowserScss = read("HkFileBrowserDialog.scss");
const fileBrowserTsx = read("HkFileBrowserDialog.tsx");
const scrollContainerTsx = read("HkScrollContainer.tsx");

/** Extract ONE balanced `{...}` declaration block following the given
 *  selector — a naive `[^}]*` would stop at the first nested `}` and let
 *  properties appended after a future nested block evade the pin. */
function cssBlock(src: string, selector: string): string {
  const at = src.indexOf(selector);
  expect(at, `${selector} block exists`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return "";
}

describe("scroll-pin whitespace contract", () => {
  it("the pin base is sticky with a floating-chrome surface", () => {
    const base = cssBlock(pinScss, ".hk-scroll-pin {");
    expect(base).toMatch(/position: sticky/);
    expect(base).toMatch(/z-index: var\(--hk-scroll-pin-z/);
    expect(base).toMatch(/background: var\(\s*--hk-scroll-pin-bg/);
  });

  it("every side x strategy pairing exists (12 total)", () => {
    for (const strategy of ["offset", "bleed", "none"]) {
      for (const side of ["top", "bottom", "left", "right"]) {
        const selector = `.hk-scroll-pin[data-strategy="${strategy}"][data-side="${side}"]`;
        expect(pinScss, selector).toContain(selector);
      }
    }
  });

  it("the bleed strategy pairs padding with the negative margin per side", () => {
    // The load-bearing geometry: absorb the host's declared padding so the
    // whitespace travels with the pin. Losing any half of a pair would
    // shift the pin's content at rest (padding without margin) or overlap
    // siblings (margin without padding).
    for (const side of ["top", "bottom", "left", "right"]) {
      const block = cssBlock(
        pinScss,
        `.hk-scroll-pin[data-strategy="bleed"][data-side="${side}"]`,
      );
      expect(block, `bleed ${side} padding`).toMatch(
        new RegExp(`padding-${side}: var\\(--hk-scroll-pad-${side}`),
      );
      expect(block, `bleed ${side} negative margin`).toMatch(
        new RegExp(
          `margin-${side}: calc\\(-1 \\* var\\(--hk-scroll-pad-${side}`,
        ),
      );
    }
  });

  it("the offset strategy stops at the declared gutter line per side", () => {
    for (const side of ["top", "bottom", "left", "right"]) {
      const block = cssBlock(
        pinScss,
        `.hk-scroll-pin[data-strategy="offset"][data-side="${side}"]`,
      );
      expect(block).toMatch(new RegExp(`${side}: var\\(--hk-scroll-pad-${side}`));
    }
  });

  it("HkModal declares the four pad vars on .hk-modal-body (host contract)", () => {
    // Declared on the BODY — the covers are the body's own pseudo rules
    // and custom properties inherit downward only, so the scroller (a
    // child) could never feed them. The FULL literal is pinned (var name
    // AND the 1.5rem fallback): a silently changed default would desync
    // the covers from the padding while every selector still matches.
    const body = cssBlock(modalScss, ".hk-modal-body {");
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(body, `--hk-scroll-pad-${side}`).toContain(
        `--hk-scroll-pad-${side}: var(--hk-modal-padding-body, 1.5rem);`,
      );
    }
  });

  it("HkModal's body-inner consumes the same vars (one source of truth)", () => {
    const inner = cssBlock(modalScss, ".hk-modal-body-inner {");
    expect(inner).toMatch(/padding: var\(--hk-scroll-pad-top/);
    expect(inner).toMatch(/var\(--hk-scroll-pad-left/);
    // The old direct fallback must be gone — a stale `1.5rem` literal in
    // the shorthand would desync the gutter covers from the padding.
    expect(inner).not.toMatch(/padding: 1\.5rem/);
    expect(inner).not.toMatch(/padding: var\(--hk-modal-padding-body/);
  });

  it("HkModal paints gutter covers from the same vars", () => {
    expect(modalScss).toMatch(/&::before,\s*\n\s*&::after/);
    // Anchor on the standalone pseudo blocks INSIDE .hk-modal-body — the
    // combined selector ("&::before,\n &::after {") contains "&::after {"
    // as a literal, so a bare indexOf would match the shared rule instead.
    const bodyBlock = cssBlock(modalScss, ".hk-modal-body {");
    expect(bodyBlock).toMatch(
      /&::before \{\s*top: 0;\s*height: var\(--hk-scroll-pad-top/,
    );
    expect(bodyBlock).toMatch(
      /&::after \{\s*bottom: 0;\s*height: var\(--hk-scroll-pad-bottom/,
    );
  });

  it("the mobile sheet retunes the vars instead of the inner padding", () => {
    // Grab the media-query block's body override.
    const at = modalScss.indexOf(".hk-modal-body {", modalScss.indexOf("@media (max-width: 767px)"));
    expect(at).toBeGreaterThan(-1);
    const block = cssBlock(modalScss.slice(at), ".hk-modal-body {");
    expect(block).toMatch(/--hk-scroll-pad-top: 1rem;/);
    expect(block).toMatch(/--hk-scroll-pad-left: 1rem;/);
  });

  it("HkModal marks the scroller as a cover host in the tsx", () => {
    expect(modalTsx).toMatch(/class="hk-modal-body-scroll hk-scroll-pin-host"/);
    expect(modalTsx).toMatch(/data-scroll-axis="vertical"/);
    expect(modalTsx).toMatch(/data-pad-cover=""/);
  });

  it("HkImageLightbox zeroes the contract for its un-padded body", () => {
    const lightbox = readFileSync(join(here, "HkImageLightbox.scss"), "utf-8");
    expect(lightbox).toMatch(/--hk-scroll-pad-top: 0px;/);
    expect(lightbox).toMatch(/--hk-scroll-pad-bottom: 0px;/);
  });

  it("HkStepFlow delegates sticky positioning to the pin class", () => {
    const sticky = cssBlock(
      stepflowScss,
      ".hk-step-flow[data-sticky-header] > .hk-timeline.hk-scroll-pin {",
    );
    expect(sticky).toBeTruthy();
    // The delegation: no own position/sticky — that lives on .hk-scroll-pin.
    expect(sticky).not.toMatch(/position:\s*sticky/);
    expect(sticky).not.toMatch(/backdrop-filter/);
    // The step-flow specifics stay: the folded body gap + legacy knobs.
    expect(sticky).toMatch(/padding-bottom: var\(--hk-stepflow-header-gap/);
    expect(sticky).toMatch(/--hk-scroll-pin-z: var\(--hk-stepflow-sticky-z/);
    expect(sticky).toMatch(/--hk-scroll-pin-bg: var\(\s*--hk-stepflow-sticky-bg/);
    // And the raw selector is gone (it would double-apply without the pin).
    expect(stepflowScss).not.toMatch(/\.hk-step-flow\[data-sticky-header\] > \.hk-timeline \{/);
  });

  it("HkStepFlow stamps the pin class and side on the timeline root", () => {
    expect(stepflowTsx).toMatch(/class=\{props\.stickyHeader \? "hk-scroll-pin" : undefined\}/);
    expect(stepflowTsx).toMatch(/data-side=\{props\.stickyHeader \? "top" : undefined\}/);
    // Strategy resolves on mount (cover host → "offset", else "bleed").
    expect(stepflowTsx).toMatch(/data-strategy=\{props\.stickyHeader \? pinStrategy\.value : undefined\}/);
    expect(stepflowTsx).toMatch(/pinStrategy\.value = "offset"/);
    expect(stepflowTsx).toMatch(/hasAttribute\("data-pad-cover"\)/);
    expect(stepflowTsx).toMatch(/import "\.\/HkScrollPin\.scss";/);
  });

  it("the file-browser list head is a pin and owns no sticky of its own", () => {
    const head = cssBlock(fileBrowserScss, ".hk-file-browser-list-head.hk-scroll-pin {");
    expect(head).toBeTruthy();
    expect(head).not.toMatch(/position:\s*sticky/);
    expect(head).not.toMatch(/top:\s*0/);
    expect(head).toMatch(/background: rgb\(var\(--color-surface\)\)/);
    expect(fileBrowserTsx).toMatch(/data-strategy="offset"/);
  });

  it("HkScrollContainer marks its viewport as a pin host", () => {
    expect(scrollContainerTsx).toMatch(/SCROLL_HOST_CLASS/);
    expect(scrollContainerTsx).toMatch(/data-scroll-axis=\{props\.axis\}/);
  });
});
