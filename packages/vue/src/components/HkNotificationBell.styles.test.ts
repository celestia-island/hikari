import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Text pins for the bell's sheet layout and the dismiss-glyph ink
 * (round-3 review, PR #1333): both fixes lived in scss no test read,
 * so a revert stayed green. Comments are stripped before matching.
 */
const scss = readFileSync(join(__dirname, "HkNotificationBell.scss"), "utf-8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");

describe("HkNotificationBell scss contract", () => {
  it("the tally's sr-only twin really hides (the a11y recipe is pinned here)", () => {
    // The badge's accessible name is real text in a visually-hidden span;
    // happy-dom applies no stylesheets, so the CONTRACT lives here — every
    // arm of the sr-only recipe must survive a revert that would make the
    // twin visible (or, worse, leave it in flow and break the row).
    const block = scss.match(/\.hk-notification-row__sr-only \{([^}]*)\}/);
    expect(block, "the sr-only rule exists").toBeTruthy();
    for (const arm of [
      "position: absolute",
      "width: 1px",
      "height: 1px",
      "overflow: hidden",
      "clip-path: inset(50%)",
      "white-space: nowrap",
    ]) {
      expect(block![1], `sr-only carries ${arm}`).toContain(arm);
    }
  });

  it("each load-bearing rule is declared ONCE (a duplicate top-level rule could override it unseen)", () => {
    // The row helpers extract the FIRST matching rule, so an appended
    // duplicate with the same selector wins the cascade while the pinned
    // body stays present (final-residual class). Counting the selector at
    // file scope closes it for the rules these pins defend.
    for (const selector of [
      ".hk-notification-center__list {",
      ".hk-notification-row {",
      ".hk-notification-row__icon-count {",
      ".hk-notification-center__foot {",
    ]) {
      const hits = scss.split(selector).length - 1;
      expect(hits, `${selector} declared exactly once`).toBe(1);
    }
  });

  it("the panel body is a definite 22rem inside the max-content popover", () => {
    expect(scss).toContain("width: 22rem;");
    // The old `min(22rem, 100%)` clamp is the dead-band root cause.
    expect(scss).not.toMatch(/width:\s*min\(/);
  });

  it("the sheet branch follows the viewport AND resets the desktop max-width", () => {
    expect(scss).toMatch(
      /\.hk-is-sheet &\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/,
    );
  });

  it("the clear-all foot carries bottom padding (the glass edge gap)", () => {
    // User direction 2026-11-19: the popover panel's own 4px pad glued
    // the clear-all button to the panel's bottom edge — the foot owns
    // the extra bottom inset. The VALUE is pinned (round-3 review,
    // mutant M4): a presence-only match let `padding-bottom: 0` — a
    // no-op revert — stay green.
    const footBlock = scss.match(/^\.hk-notification-center__foot \{([^}]*)\}/m);
    expect(footBlock).toBeTruthy();
    expect(footBlock![1]).toContain("padding-bottom: var(--space-8, 0.5rem)");
  });

  it("the row centers its columns against the ROW height (one-line rows included)", () => {
    // Default stretch stretched a one-line body to the 24px dismiss
    // button and hugged the title to the body's top — visibly off the
    // shared center line exactly when the row has a single line
    // (user report 2026-11-17).
    expect(scss).toMatch(/^\.hk-notification-row \{[^}]*align-items:\s*center;/m);
  });

  it("the tone glyph carries no stretch-era first-line padding hack", () => {
    // `padding-top: 2px` was an optical nudge for the first line under
    // stretch; under row centering it parks the glyph below the shared
    // center line, so the icon rule must not carry any padding-top.
    const iconBlock = scss.match(/^\.hk-notification-row__icon \{([^}]*)\}/m);
    expect(iconBlock).toBeTruthy();
    expect(iconBlock![1]).not.toContain("padding-top");
  });

  it("the dismiss glyph ink rides --hi-icon-button-icon-color (ancestor color is inert)", () => {
    // Rest ink on the button, plus the row-hover/focus-within brighten —
    // both through the var channel the ghost button itself consumes.
    // The rest rule is anchored at line start so the joint block's
    // :focus-within selector line cannot satisfy it for the 40% value
    // (round-6 review: deleting just the rest arm kept the file green).
    expect(scss).toMatch(
      /^\.hk-notification-row__actions \.hk-icon-button \{[^}]*--hi-icon-button-icon-color:\s*rgb\(var\(--color-text\) \/ 40%\)/m,
    );
    // The joint rule block: BOTH pseudo-classes must key the var, each
    // in its own selector arm (a mutant that keeps only :focus-within
    // and downgrades :hover to inert ancestor color fails here).
    expect(scss).toMatch(
      /\.hk-notification-row:hover \.hk-notification-row__actions \.hk-icon-button,\s*\n\.hk-notification-row:focus-within \.hk-notification-row__actions \.hk-icon-button\s*\{[^}]*--hi-icon-button-icon-color:\s*rgb\(var\(--color-text\) \/ 85%\)/,
    );
    // Exactly ONE declaration per ink value: the old third arm asserted
    // only the property NAME on the focus-within selector, which the joint
    // block above already covers (redundant) while an appended second
    // declaration could override it unseen (final-residual fix).
    expect(
      scss.match(/--hi-icon-button-icon-color:\s*rgb\(var\(--color-text\) \/ 40%\)/g) ?? [],
    ).toHaveLength(1);
    expect(
      scss.match(/--hi-icon-button-icon-color:\s*rgb\(var\(--color-text\) \/ 85%\)/g) ?? [],
    ).toHaveLength(1);
  });

  it("the list is its own containing block for the leaving ghosts", () => {
    // HkListTransition lifts a leaving row to `position: absolute` and pins
    // it to its pre-patch box. If the nearest positioned ancestor is the
    // WRAP (outside the scroller), the ghost escapes the list's clip and is
    // pinned in LAYOUT coordinates while the viewport is scrolled — real
    // Chrome measurement (2026-11-20): a row dismissed from a scrolled list
    // painted 629px away from where the user saw it, i.e. no visible fade.
    // `position: relative` makes the ghost live inside the scroller, where
    // it is clipped and moves with the content.
    const listBlock = scss.match(/^\.hk-notification-center__list \{([^}]*)\}/m);
    expect(listBlock, "the list rule exists").toBeTruthy();
    expect(listBlock![1]).toContain("position: relative");
    expect(listBlock![1], "and it stays the scroll container").toContain("overflow-y: auto");
  });
});
