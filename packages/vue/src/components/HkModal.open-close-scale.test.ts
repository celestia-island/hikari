/**
 * Source contract for the DESKTOP modal open/close choreography (user
 * direction 2026-11-04): the window grows by scaling the content itself
 * about the frame's center — width pinned at 100% (scaleX 1), height
 * scaling 90% → 100% — replacing the 2026-09-14 clip unveil (and the
 * #508/#512/#524 lineage before it). The old "content rides rigidly,
 * never squashed" invariant was DELIBERATELY dropped: the rigid ride is
 * exactly what made the unveil read as dead weight on ordinary modals.
 *
 * Pinned on the stylesheet SOURCE (computed animation geometry is not
 * observable in happy-dom), mirroring the sheetmorph / tokenHygiene
 * guard pattern.
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

/** The mobile sheet block — sliced the same way, for the parity guard. */
const mobile = src.slice(src.indexOf("@media (max-width: 767px)"));

/** Body of one rule (selector possibly grouped / multi-line). Line
 * comments are stripped so prose in the sheet cannot satisfy or break
 * a structural assertion. */
function bodyOf(selector: string, scope: string = desktop): string {
  const escaped = selector.replace(/\./g, "\\.");
  const match = scope.match(new RegExp(`${escaped}[^{]*\\{([^}]*)\\}`));
  expect(match, `rule ${selector} must exist in scope`).toBeTruthy();
  return match![1]
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ENTER_LEAVE = [
  ".hk-modal-content-enter-active",
  ".hk-modal-content-leave-active",
  ".hk-modal-content-enter-from",
  ".hk-modal-content-enter-to",
  ".hk-modal-content-leave-from",
  ".hk-modal-content-leave-to",
] as const;

/** The centering translate: every transform state keeps it as the
 * leading term, so the frame never re-seats mid-flight (dragged windows
 * keep their shift through the animation). */
const CENTERING =
  /translate\(\s*calc\(-50% \+ var\(--hk-modal-shift-x, 0px\)\),\s*calc\(-50% \+ var\(--hk-modal-shift-y, 0px\)\)\s*\)/;

describe("HkModal desktop content-scale open/close contract (user direction 2026-11-04)", () => {
  it("scales the content from 90% height about the center on enter", () => {
    const from = bodyOf(".hk-modal-content-enter-from");
    expect(from).toMatch(CENTERING);
    expect(from).toMatch(/scale\(1, 0\.9\)/);
    // scaleX stays 1 — the width is pinned at 100% for the whole ride.
    expect(from).not.toMatch(/scale\(0\.9\)/);
    expect(from).toMatch(/opacity:\s*0/);
  });

  it("collapses back to 90% height on leave (the reveal's true reverse)", () => {
    const to = bodyOf(".hk-modal-content-leave-to");
    expect(to).toMatch(CENTERING);
    expect(to).toMatch(/scale\(1, 0\.9\)/);
    expect(to).toMatch(/opacity:\s*0/);
    const from = bodyOf(".hk-modal-content-leave-from");
    expect(from).toMatch(CENTERING);
    expect(from).toMatch(/opacity:\s*1/);
  });

  it("rests at the identity transform (no scale, no offset) at both ends", () => {
    const enterTo = bodyOf(".hk-modal-content-enter-to");
    expect(enterTo).toMatch(CENTERING);
    // The identity state carries NO trailing transform term — the
    // scale-to-1 end of the interpolation is a bare translate, so the
    // transform lists on both ends share one shape and interpolate
    // continuously (the clip-era "pin the identity clip" workaround is
    // structurally unnecessary now).
    expect(enterTo).toMatch(new RegExp(`transform:\\s*${CENTERING.source};`));
    expect(enterTo).not.toMatch(/scale\(|translate[XY]\(/);
  });

  it("anchors the scale at the frame's center for the whole ride", () => {
    for (const active of [
      ".hk-modal-content-enter-active",
      ".hk-modal-content-leave-active",
    ]) {
      expect(bodyOf(active)).toMatch(/transform-origin:\s*50% 50%/);
    }
  });

  it("retires the clip unveil: no clip-path and no Y drift in any open/close rule", () => {
    // History: the 2026-09-14 unveil rode translateY(5%) + inset() clip
    // (with the #508 identity-clip fix). The scale grammar replaces the
    // whole mechanism — any reappearance is a regression to the retired
    // choreography.
    for (const rule of ENTER_LEAVE) {
      const body = bodyOf(rule);
      expect(body, `${rule} must not clip`).not.toMatch(/clip-path/);
      expect(body, `${rule} must not drift`).not.toMatch(/translateY\(/);
    }
  });

  it("keeps the mobile sheet's translateY choreography untouched", () => {
    const from = bodyOf(".hk-modal-content-enter-from", mobile);
    expect(from).toMatch(/translateY\(100%\)/);
  });
});
