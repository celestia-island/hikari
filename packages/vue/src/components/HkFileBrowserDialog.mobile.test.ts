/**
 * Source contract for HkFileBrowserDialog's ≤767px relaxation block
 * (2026-09-08 scan wave 2 finding F5 — LOW but user-facing: chest's
 * workspace file-browser flow opens this dialog on phones; fixed in the
 * 2026-09-08 mobile sheet wave, the same family grammar as HkModal's
 * docked-sheet block).
 *
 * The desktop frame is a 56rem modal; on a ~412px phone sheet HkModal
 * docks full-bleed and the dialog's OWN internals were the squeeze
 * (everything fit only thanks to ellipsis/overflow):
 *   .hk-file-browser-filter        width 9rem + min-width 9rem fixed box
 *   .hk-file-browser-rename-input  8rem min-width floor
 *   list head/row grid             fixed 6rem + 10rem tracks (256px)
 *
 * The mobile block must neutralize each of these INSIDE the media query
 * while the desktop rules stay untouched outside it — pinned so a refactor
 * cannot silently reintroduce desktop-only widths (the scan's "sidebar"
 * label drifted; these three are the real fixed-width participants).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkFileBrowserDialog.scss"), "utf-8");

const MOBILE_AT = "@media (max-width: 767px)";
const mobileStart = src.indexOf(MOBILE_AT);

describe("HkFileBrowserDialog mobile relaxation contract", () => {
  it("ships a ≤767px block after the desktop rules", () => {
    expect(mobileStart).toBeGreaterThan(-1);
    // The block is appended at the end: every desktop rule precedes it.
    expect(src.indexOf(".hk-file-browser-filter", mobileStart)).toBeGreaterThan(-1);
  });

  it("lets the type filter size to its trigger content instead of a fixed 9rem box", () => {
    const block = src.slice(mobileStart);
    const rule = block.match(/\.hk-file-browser-filter\s*{[^}]*}/)?.[0] ?? "";
    expect(rule).toContain("width: auto");
    expect(rule).toContain("min-width: 0");
  });

  it("drops the rename input's 8rem floor so the wrap row shares its line", () => {
    const block = src.slice(mobileStart);
    const rule = block.match(/\.hk-file-browser-rename-input\s*{[^}]*}/)?.[0] ?? "";
    expect(rule).toContain("min-width: 0");
  });

  it("makes the list grid's fixed 6rem/10rem tracks compressible on phones", () => {
    const block = src.slice(mobileStart);
    const rule =
      block.match(/\.hk-file-browser-list-head,\s*\n\s*\.hk-file-browser-row\s*{[^}]*}/)
        ?.[0] ?? "";
    // Three minmax(0, …) tracks — no bare fixed rem track may remain, and
    // the rows reclaim one spacing step of horizontal padding.
    expect(rule).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, [\d.]+rem\) minmax\(0, [\d.]+rem\)/,
    );
    expect(rule).toContain("padding-inline: var(--space-8)");
  });

  it("keeps every desktop width outside the mobile block (relaxation, not redesign)", () => {
    const desktop = src.slice(0, mobileStart);
    expect(desktop).toContain("width: 9rem");
    expect(desktop).toContain("min-width: 9rem");
    expect(desktop).toContain("min-width: 8rem");
    expect(desktop).toContain("grid-template-columns: minmax(0, 1fr) 6rem 10rem");
  });
});
