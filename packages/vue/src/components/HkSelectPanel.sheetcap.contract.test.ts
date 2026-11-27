/**
 * Source contract for the mobile sheet's height and pinned band
 * (2026-11-27 user report, phone: "the default height is far too low").
 *
 *   - the sheet PANEL carries the family ceiling: content under 80% of the
 *     viewport keeps its natural height, content over it stops at 80% (vh
 *     first, the dvh twin second — HkModal's pairing);
 *   - the LIST band carries no cap of its own: the consumer's popout measure
 *     (`--hk-select-panel-max-height`) used to land here and squashed every
 *     picker sheet to under half the phone;
 *   - the panel stops scroll chaining (`overscroll-behavior: contain`), so a
 *     swipe on the grabber / title / pinned band does not drag the page
 *     behind; MUT:sheet-overscroll-contain
 *   - the pinned band and the popout's closed header-bearing shape exist.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkSelect.scss"), "utf-8");

function block(selector: string): string {
  const at = src.indexOf(`${selector} {`);
  expect(at, `${selector} exists`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open + 1, i);
  }
  return "";
}

describe("HkSelectPanel mobile sheet height contract", () => {
  it("caps the panel at 80% of the viewport (vh, then the dvh twin), inset term kept", () => {
    const panel = block(".hk-select-sheet-panel");
    expect(panel).toContain("max-height: min(\n    80vh,");
    expect(panel).toContain("max-height: min(\n    80dvh,");
    expect(panel).toContain("var(--hk-sheet-top-inset, 4.25rem)");
    expect(panel).not.toContain("72vh");
  });

  it("stops scroll chaining on the panel", () => {
    expect(block(".hk-select-sheet-panel")).toContain("overscroll-behavior: contain");
  });

  it("the list band has no cap of its own", () => {
    const list = block(".hk-select-sheet-list");
    expect(list).not.toMatch(/max-height\s*:/);
    expect(list).toContain("overscroll-behavior: contain");
  });

  it("the pinned band is a non-shrinking sibling with the list's side inset", () => {
    const pinned = block(".hk-select-sheet-pinned");
    expect(pinned).toContain("flex: none");
    expect(pinned).toContain("var(--space-16)");
    // A column flex container, matching the popout band's box model. Kept
    // for consistency across the two bands, not because a block band was
    // shown to collapse: R23 measured a block band identically in real
    // Chromium (see the rule's own comment), so this pin guards the steady
    // state rather than a fixed defect. MUT:sheet-band-box-model
    expect(pinned).toContain("display: flex");
    expect(pinned).toContain("flex-direction: column");
    expect(pinned).not.toMatch(/overflow|flex:\s*1/);
  });
});

describe("HkSelectPanel desktop popout — header-bearing shape", () => {
  it("closes the box and moves the panel inset onto the two bands", () => {
    expect(block("&.is-pinned-header")).toContain("padding: 0");
    expect(block("&.is-pinned-header")).toContain("overflow: hidden");
    expect(block(".hk-select-popout-pinned")).toContain("flex: none");
    // The wrapper must FILL the leftover column (`flex: 1`): without it the
    // wrapper sizes to content, the body's `flex: 1; min-height: 0` does not
    // engage, and a long catalog overflows the capped panel instead of
    // scrolling (2026-11-27 R14 — the deletion survived the whole suite).
    // MUT:body-host-flex-fill
    expect(block(".hk-select-popout-body-host")).toContain("flex: 1");
    expect(block(".hk-select-popout-body-host")).toContain("position: relative");
    const body = block(".hk-select-popout-body");
    expect(body).toContain("overflow-y: auto");
    expect(body).toContain("min-height: 0");
    expect(body).toContain("overscroll-behavior: contain");
  });
});
