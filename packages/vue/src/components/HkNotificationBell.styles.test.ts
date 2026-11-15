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

  it("the dismiss glyph ink rides --hi-icon-button-icon-color (ancestor color is inert)", () => {
    // Rest ink on the button, plus the row-hover/focus-within brighten —
    // both through the var channel the ghost button itself consumes.
    expect(scss).toMatch(
      /\.hk-notification-row__actions \.hk-icon-button\s*\{\s*--hi-icon-button-icon-color:/,
    );
    expect(scss).toMatch(
      /\.hk-notification-row:(?:hover|focus-within) \.hk-notification-row__actions \.hk-icon-button[\s\S]*?--hi-icon-button-icon-color:/,
    );
    expect(scss).toMatch(
      /\.hk-notification-row:focus-within \.hk-notification-row__actions \.hk-icon-button\s*\{\s*--hi-icon-button-icon-color:/,
    );
  });
});
