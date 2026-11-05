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
import { readFileSync, readdirSync } from "node:fs";
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

/** Every stylesheet under packages/vue/src: any sheet may assign the pin
 *  knob, so the IACVT guard must see the whole source tree, not one
 *  component and not the package's non-source siblings. */
function sheetsUnder(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sheetsUnder(path, acc);
    else if (entry.name.endsWith(".scss")) acc.push(path);
  }
  return acc;
}

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

/** The BASE `.hk-modal-body` rule — a TOP-LEVEL selector (column 0).
 *  A bare `indexOf(".hk-modal-body {")` also matches the TAIL of the
 *  desktop open/close choreography's descendant selectors, and
 *  `.hk-modal-content-enter-active .hk-modal-body {` sits earlier in the
 *  sheet — so the naive read hands back that transition block instead of
 *  the base rule. Anchor on a line start. */
const TOP_LEVEL_BODY = "\n.hk-modal-body {";

function baseBodyBlock(): string {
  const at = modalScss.indexOf(TOP_LEVEL_BODY);
  expect(at, "top-level .hk-modal-body rule exists").toBeGreaterThanOrEqual(0);
  return cssBlock(modalScss.slice(at), ".hk-modal-body {");
}

describe("scroll-pin whitespace contract", () => {
  it("the pin base is sticky with a floating-chrome surface", () => {
    const base = cssBlock(pinScss, ".hk-scroll-pin {");
    expect(base).toMatch(/position: sticky/);
    expect(base).toMatch(/z-index: var\(--hk-scroll-pin-z, var\(--hk-z-scrollbar/);
    expect(base).toMatch(/background: var\(\s*--hk-scroll-pin-bg/);
  });

  it("keeps the plain background unconditional and the color-mix tint behind @supports", () => {
    // IACVT (the R3 finding): color-mix() nested in a var() fallback is VALID
    // at parse time, so an engine without color-mix keeps the declaration and
    // only fails at COMPUTED-VALUE time — the property becomes unset
    // (transparent) and the earlier declaration does NOT win. Cascade order
    // is therefore not enough; the tint must live inside a feature query
    // while the plain fallback stays unconditional.
    const base = cssBlock(pinScss, ".hk-scroll-pin {");
    // The prose above explains IACVT and names color-mix; only DECLARATIONS
    // matter here, so line comments are stripped before the check.
    const baseRules = base.replace(/^\s*\/\/.*$/gm, "");
    expect(baseRules, "the opaque surface is unconditional").toMatch(
      /background:\s*var\(\s*--hk-scroll-pin-bg,\s*var\(\s*--hi-color-surface,\s*#ffffff\s*\)\s*\)/,
    );
    expect(baseRules, "the tint must not sit in the unconditional block").not.toContain("color-mix");

    const gateStart = pinScss.indexOf("@supports");
    expect(gateStart, "a feature query gates the tint").toBeGreaterThanOrEqual(0);
    const prelude = pinScss
      .slice(gateStart, pinScss.indexOf("{", gateStart))
      .replace(/\s+/g, " ");
    expect(prelude, "the gate tests color-mix() support").toContain(
      "background: color-mix(in srgb, white 95%, transparent)",
    );
    const gate = cssBlock(pinScss, "@supports");
    expect(gate, "the tint rides the @supports block").toContain(".hk-scroll-pin");
    expect(gate).toMatch(/background:\s*var\(\s*--hk-scroll-pin-bg,\s*color-mix/);
  });

  it("never puts color-mix() inside a --hk-scroll-pin-bg knob fallback", () => {
    // Same IACVT class as the pin base: a custom property holding a
    // color-mix() token stream is VALID at parse time, so on WebKit <=16.1 /
    // Edge WebView2 <111 the pin's `var(--hk-scroll-pin-bg, opaque)` is
    // poisoned at computed-value time and the surface paints transparent.
    // The step-flow sticky header was the second in-repo instance. Every
    // assignment of the knob must be a plain var() with NO fallback (or a
    // plain colour), never a var() whose fallback holds color-mix().
    const srcDir = join(here, "..");
    const offenders: string[] = [];
    let assignments = 0;
    for (const sheet of sheetsUnder(srcDir)) {
      const source = readFileSync(sheet, "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      // Tolerate a last declaration that has no trailing semicolon (a block
      // can end right after the value).
      for (const match of source.matchAll(/--hk-scroll-pin-bg\s*:([^;}]*)/g)) {
        assignments += 1;
        const value = match[1]!.replace(/\s+/g, " ").trim();
        if (value.includes("color-mix")) {
          offenders.push(`${sheet.slice(srcDir.length + 1)} -> ${value}`);
        }
      }
    }
    expect(assignments, "the knob is assigned somewhere (step-flow)").toBeGreaterThan(0);
    expect(offenders, "pin-knob assignments must not hold color-mix()").toEqual([]);
    // Positive control: the scan must still SEE the step-flow assignment it
    // guards, and that one is the literal plain-var form.
    const stepflow = readFileSync(join(here, "HkStepFlow.scss"), "utf-8");
    expect(stepflow).toMatch(
      /--hk-scroll-pin-bg:\s*var\(\s*--hk-stepflow-sticky-bg\s*\)\s*;/,
    );
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
    // AND the fallback chain): a silently changed default would desync
    // the covers from the padding while every selector still matches.
    // The chain reads the shared container-pad token (--hk-pad, the
    // modal root's `padding` prop) over the per-component theme token
    // over the historical 1.5rem.
    const body = baseBodyBlock();
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(body, `--hk-scroll-pad-${side}`).toContain(
        `--hk-scroll-pad-${side}: var(--hk-pad, var(--hk-modal-padding-body, 1.5rem));`,
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
    const bodyBlock = baseBodyBlock();
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
