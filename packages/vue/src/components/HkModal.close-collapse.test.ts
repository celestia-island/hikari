/**
 * Source contract for the DESKTOP modal close choreography (user report
 * 2026-09-15): the unveil expands the visible box outward from the
 * center (bottom-10% clip + +5% offset at t=0, full box at t=1), but the
 * close had degenerated into a fade + downward drift — the box read as
 * shrinking straight down instead of folding back into its center.
 *
 * The close now runs the unveil's TRUE reverse, which is only safe
 * because the leave pins an identity clip: interpolating
 * `none → inset()` is DISCRETE (the #508 regression — the footer band
 * vanished at the first frame), while identical `inset → inset` shape
 * functions interpolate continuously.
 *
 * Pinned on the stylesheet SOURCE (computed animation geometry is not
 * observable in happy-dom), mirroring the themeToggleChrome /
 * tokenHygiene guard pattern.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkModal.scss"), "utf-8");

/** The desktop choreography block — the mobile sheet block (≤767px)
 *  carries its own enter/leave classes and must not leak in. */
const desktop = src.slice(
  src.indexOf("@media (min-width: 768px)"),
  src.indexOf("@media (max-width: 767px)"),
);

/** Body of one flat rule (no nested braces in this block). */
function bodyOf(selector: string): string {
  const escaped = selector.replace(/\./g, "\\.");
  const match = desktop.match(new RegExp(`${escaped}\\s*{([^}]*)}`));
  expect(match, `rule ${selector} must exist in the desktop block`).toBeTruthy();
  return match![1].replace(/\s+/g, " ").trim();
}

function clipOf(selector: string): string {
  const body = bodyOf(selector);
  const match = body.match(/clip-path:\s*([^;]+);?/);
  expect(match, `${selector} must declare a clip-path`).toBeTruthy();
  return match![1].replace(/\s+/g, " ").trim();
}

describe("HkModal desktop close-collapse contract (user report 2026-09-15)", () => {
  it("pins the identity clip in leave-from, identical to enter-to (no discrete clip jump)", () => {
    // The #508 regression guard: leave-from WITHOUT a clip makes
    // none → inset() interpolate discretely and the footer band vanish
    // at the first frame of the close.
    expect(clipOf(".hk-modal-content-leave-from")).toBe(
      clipOf(".hk-modal-content-enter-to"),
    );
  });

  it("mirrors the unveil geometry: leave-to clips like enter-from", () => {
    // Bottom-10% clip + same rounding on both ends of the mirror — the
    // visible box collapses symmetrically back to 90% centered.
    expect(clipOf(".hk-modal-content-leave-to")).toBe(
      clipOf(".hk-modal-content-enter-from"),
    );
  });

  it("transitions clip-path on leave (the collapse animates, not snaps)", () => {
    const body = bodyOf(".hk-modal-content-leave-active");
    expect(body).toMatch(/clip-path\s+var\(--hk-modal-duration/);
    expect(body).toMatch(/will-change:\s*[^;]*clip-path/);
  });

  it("keeps the close a rigid ride: no scaleY squash anywhere in the desktop block", () => {
    // History: #512 collapsed via scaleY (content squashed), #524
    // reverted to a bare drift. The clip choreography moves whole
    // pixels of the visible window — the frame itself never distorts.
    expect(desktop).not.toContain("scaleY");
    expect(desktop).not.toContain("transform-origin");
  });
});
