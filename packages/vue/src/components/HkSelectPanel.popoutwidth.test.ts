/**
 * Source contract for the select popout host's position-independent width
 * (2026-09-14 user report: the "jump to date" tooltip on a screen-edge
 * FAB collapsed to a one-glyph column — the same shrink-to-fit class the
 * popover fixed in #421. HkSelectPanel's desktop popout was the last
 * anchored surface still sizing against `viewport - left`; an anchor
 * near the right edge squeezed the panel down to the leftover space).
 *
 * The host must keep:
 *   - `width: max-content` — size to the rows wherever the anchor sits;
 *   - the viewport cap on `--viewport-gutter` (16px desktop / 8px
 *     mobile) — the panel can never exceed the space between the
 *     gutters, matching .hk-popover-panel;
 *   - the `min-width: 180px` floor — which must stay BEATABLE by the
 *     inline matchAnchorWidth style (stylesheet loses to inline on the
 *     same element; declaration ORDER inside this block is irrelevant,
 *     so it is deliberately not pinned here).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkSelect.scss"), "utf-8");

describe("HkSelectPanel popout viewport width contract", () => {
  const block = scss.match(/\.hk-select-popout-host\s*{[\s\S]*?^\}/m)?.[0] ?? "";

  it("declares the host block", () => {
    expect(block).not.toBe("");
  });

  it("sizes the popout to its content (width: max-content)", () => {
    expect(block).toContain("width: max-content;");
  });

  it("caps the popout at the viewport gutter on both edges", () => {
    expect(block).toContain(
      "max-width: calc(100vw - 2 * var(--viewport-gutter, 16px));",
    );
  });

  it("keeps the 180px floor on the host (narrow anchors never collapse the panel)", () => {
    expect(block).toContain("min-width: 180px;");
  });
});
