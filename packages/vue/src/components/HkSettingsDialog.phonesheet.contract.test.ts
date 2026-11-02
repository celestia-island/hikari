/**
 * Source contract for the phone settings sheet (2026-11-02): the docked
 * sheet's settings shell must FILL the modal body instead of keeping the
 * desktop band, and the mobile body gutter must clear the gesture-nav
 * safe area.
 *
 * The regression this pins (wowsp phone report 2026-11-02, screenshots of
 * the attributions section): the host rule kept `.hk-settings` at
 * height: var(--hk-settings-height, calc(70vh - 6.5rem)) on phones too,
 * so on a sheet tall enough to dwarf that band the shell ended
 * mid-screen — the pane's viewport sliced the last card mid-row and
 * everything below it was unreachable dead sheet background. And a
 * footer-less sheet body docked flush on the bottom edge put its last
 * row inside the Android gesture-nav band, which only the mobile FOOTER
 * padding handled before.
 *
 * The reads normalize CRLF first: sibling source contracts match
 * raw bytes and choke on autocrlf checkouts (they fail identically on
 * pristine master there, and pass in CI's LF checkout) — this file must
 * stay green on BOTH.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, p), "utf-8").replace(/\r\n/g, "\n");

describe("phone settings sheet contract", () => {
  it("fills the shell with the modal body under the family breakpoint", () => {
    const sheet = read("HkSettingsDialog.scss");
    // The desktop band stays as the var-driven base…
    expect(sheet).toContain(
      ".hk-settings-host .hk-settings {",
    );
    expect(sheet).toContain("height: var(--hk-settings-height, calc(70vh - 6.5rem));");
    // …and the phone branch overrides it to a full fill. The override must
    // live INSIDE the host rule's media query — a later standalone rule
    // would also work, but the nested form keeps the band and the fill on
    // one cascade line (the same-specificity later-block win).
    expect(sheet).toMatch(
      /\.hk-settings-host \.hk-settings \{[\s\S]*?@media \(max-width: 767px\) \{\s*height: 100%;\s*\}/,
    );
  });

  it("adds the gesture-nav safe area to the mobile body bottom gutter", () => {
    const sheet = read("HkModal.scss");
    // The mobile block retunes the four gutter vars; only the bottom one
    // spends the safe area (the sheet docks flush on that edge).
    expect(sheet).toContain("--hk-scroll-pad-top: 1rem;");
    expect(sheet).toContain("--hk-scroll-pad-right: 1rem;");
    expect(sheet).toContain("--hk-scroll-pad-left: 1rem;");
    expect(sheet).toContain(
      "--hk-scroll-pad-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));",
    );
    // The desktop gutter defaults stay untouched.
    expect(sheet).toContain(
      "--hk-scroll-pad-bottom: var(--hk-pad, var(--hk-modal-padding-body, 1.5rem));",
    );
  });
});
