/**
 * Source contract: the emergency takeover is a document-space top
 * owner with TWO legs (the same contract HkModal rides, pinned by
 * chromeBand.contract tests on the chest side):
 *
 *  1. z leg — `var(--hk-z-emergency, 96000)` sits above the error
 *     landing (95000) and strictly below the window titlebar
 *     (100001): the band demands attention but must NEVER cover the
 *     titlebar (user direction 2026-11-13).
 *  2. geometry leg — the layer insets below the host chrome band via
 *     `var(--hk-chrome-band-inset, 0px)` so a native shell's titlebar
 *     strip stays visible, draggable and clickable.
 *
 * Plus the width and blocking doctrines: the band spans edge to edge
 * (no viewport gutter — user direction 2026-11-13) and the layer
 * itself is pointer-transparent (only the band intercepts), so the
 * emergency never blocks work happening underneath.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function sheet(): string {
  return readFileSync(join(here, "HkEmergencyAlert.scss"), "utf-8");
}

describe("emergency alert layering contract", () => {
  it("pins the document-space z band between error landing and titlebar", () => {
    const css = sheet();
    expect(css).toContain("z-index: var(--hk-z-emergency, 96000);");
  });

  it("pins the chrome-band geometry leg on the top edge", () => {
    const css = sheet();
    expect(css).toContain("inset: var(--hk-chrome-band-inset, 0px) 0 0 0;");
  });

  it("the band spans the full width — no viewport gutter on it", () => {
    const css = sheet();
    // The band (not the reading column) is width:100%…
    expect(css).toContain("width: 100%;");
    // …and the sheet never insets the band from the screen edges.
    expect(css).not.toMatch(/inset-inline-(start|end):\s*var\(--viewport-gutter/);
  });

  it("the layer is pointer-transparent; only the band is interactive", () => {
    const css = sheet();
    // Root layer: transparent (the scrim never blocks work)…
    expect(css).toContain("pointer-events: none;");
    // …and exactly ONE element opts back in — the band.
    expect(css.match(/pointer-events:\s*auto;/g)?.length).toBe(1);
  });
});
