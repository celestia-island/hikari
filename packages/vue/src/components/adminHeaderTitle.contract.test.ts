import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Contract pins for the admin header's page-title width rules in
 * `styles/admin-tokens.scss` (hikari#1531 item 3):
 *
 * - the base rule caps the title at 8rem — the account-menu-nickname
 *   sizing, fine on its own face;
 * - a `@media (width <= 480px)` block drops the cap to 5rem, which lowers
 *   the START wing's `min-content` floor far enough that the END wing fits
 *   whole at 320px (the two wings' floors plus the grid gaps used to exceed
 *   the viewport and the END wing's `overflow: hidden` clipped the theme
 *   button — the cheap side to pay is the title ellipsing a word earlier).
 *
 * Source-scanned with a direct regex (not a generic rule parser) — it does not catch nested media queries, which is acceptable here: the
 * sheet carries long block comments whose text defeats a naive
 * selector-slicer, and the two pins are simple enough for exact patterns.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "styles", "admin-tokens.scss"), "utf8");

describe("admin header title width contract (hikari#1531 item 3)", () => {
  it("caps the title at 8rem in the base rule", () => {
    const m = src.match(/\.s-admin-header-title\s*\{[^}]*\}/);
    expect(m, "the base title rule exists").toBeTruthy();
    expect(m![0]).toContain("max-width: 8rem");
    expect(m![0]).toContain("text-overflow: ellipsis");
  });

  it("drops the cap to 5rem inside the ≤480px media block", () => {
    const m = src.match(
      /@media \(width <= 480px\)\s*\{[^@]*?\.s-admin-header-title\s*\{[^}]*max-width:\s*5rem[^}]*\}/,
    );
    expect(m, "the ≤480px override exists with the 5rem cap").toBeTruthy();
  });
});
