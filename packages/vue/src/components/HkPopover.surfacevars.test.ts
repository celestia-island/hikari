/**
 * Source contract: popover glass content reads --hk-popover-bg/--hk-popover-blur
 * so a host surface-finish preference (chest html[data-surface]) can re-skin
 * floating dropdown layers without forking the component.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkPopover.scss"), "utf-8");

describe("HkPopover glass layer surface hooks", () => {
  it("keeps the glass background host-tunable with the historical default", () => {
    const block = src.slice(src.indexOf(".hii-dropdown-content"));
    expect(block).toContain("var(--hk-popover-bg, rgb(var(--color-surface)))");
    expect(block).toContain("var(--hk-popover-blur,");
  });

  // Width must stay position-independent: computePosition places the
  // anchored panel at `left = anchorEnd - panelWidth` (bottom-end), so
  // a shrink-to-fit (position-dependent) width creates a ResizeObserver
  // feedback that ratchets the menu wider every frame with elastically-
  // wide content (demo.dev field report 2026-09-07). The sheet branch
  // must keep spanning via its inline left/right (width: auto).
  it("pins the anchored panel width to max-content and resets the sheet", () => {
    const base = src.match(/\.hk-popover-panel\s*{[^}]*}/)![0];
    expect(base).toContain("width: max-content");
    expect(base).toContain("max-width: calc(100vw - 2 * 8px)");
    const sheet = src.match(/\.hk-popover-panel\.hk-is-sheet\s*{[^}]*}/)![0];
    expect(sheet).toContain("width: auto");
  });
});
