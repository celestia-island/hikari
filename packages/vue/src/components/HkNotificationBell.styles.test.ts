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

  it("the row centers its columns against the ROW height (one-line rows included)", () => {
    // Default stretch stretched a one-line body to the 24px dismiss
    // button and hugged the title to the body's top — visibly off the
    // shared center line exactly when the row has a single line
    // (user report 2026-11-17).
    expect(scss).toMatch(/^\.hk-notification-row \{[^}]*align-items:\s*center;/m);
  });

  it("the text block carries the measured optical lift against the row center", () => {
    // The line box centers geometrically, but the CJK stack's
    // ascent/descent asymmetry parks the ink ~1px low (user report
    // 2026-11-17). The body must keep the measured -1px lift, or the
    // title/desc/actions lose their shared center line again.
    const bodyBlock = scss.match(/^\.hk-notification-row__body \{([^}]*)\}/m);
    expect(bodyBlock).toBeTruthy();
    expect(bodyBlock![1]).toMatch(/position:\s*relative;/);
    expect(bodyBlock![1]).toMatch(/top:\s*-1px;/);
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
    expect(scss).toMatch(
      /\.hk-notification-row:focus-within \.hk-notification-row__actions \.hk-icon-button\s*\{\s*--hi-icon-button-icon-color:/,
    );
  });
});
