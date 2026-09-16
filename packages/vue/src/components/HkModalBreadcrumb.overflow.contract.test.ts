/**
 * Source contract for the strip's overflow fence.
 *
 * The behavioural suite runs in happy-dom, which has no layout engine —
 * every rect is 0×0 and every computed length is empty — so the numbers
 * that actually keep the strip inside the viewport are invisible to it.
 * They live here instead, next to the reason each one exists (2026-09-16
 * user report: a long modal title clipped the centred strip at BOTH screen
 * edges, leaving a bar with no beginning and no end).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { POPUP_Z_BANDS } from "../runtime/usePopupManager";

const here = dirname(fileURLToPath(import.meta.url));
const tsx = readFileSync(join(here, "HkModalBreadcrumb.tsx"), "utf-8");
const scss = readFileSync(join(here, "HkModalBreadcrumb.scss"), "utf-8");

function rule(selector: string): string {
  return scss.match(new RegExp(`\\${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("HkModalBreadcrumb overflow fence", () => {
  it("fences the strip against the viewport, not against its content", () => {
    const block = rule(".hk-modal-breadcrumb");
    // The strip is centred with translate(-50%) and lives outside the page
    // flow: without a viewport-derived cap its width IS its content width.
    expect(block).toContain("max-width: calc(100vw - 2 * var(--viewport-gutter");
    expect(block).toContain("box-sizing: border-box");
    // Last-resort clip: the script folds the leading layers, this keeps a
    // frame that outgrows the last measurement from spilling anyway.
    expect(block).toContain("overflow: hidden");
  });

  it("measures the clone at its natural width, out of flow", () => {
    const block = rule(".hk-modal-breadcrumb-measure");
    expect(block).toContain("position: absolute");
    expect(block).toContain("visibility: hidden");
    expect(block).toContain("pointer-events: none");
    // A shrink-to-fit (or flexed) clone host would compress its crumbs and
    // every measurement would come back short — the fold would then keep
    // layers that do not fit.
    expect(block).toContain("width: max-content");
  });

  it("clamps the label itself as the second line of defence", () => {
    const block = rule(".hk-modal-breadcrumb-item");
    expect(block).toContain("overflow: hidden");
    expect(block).toContain("text-overflow: ellipsis");
    expect(block).toContain("white-space: nowrap");
    // A flex item's automatic minimum size is its own text width.
    expect(block).toContain("min-width: 0");
    expect(block).toContain("--hk-breadcrumb-item-max");
  });

  it("keeps the trigger clickable through the pointer-transparent strip", () => {
    const strip = rule(".hk-modal-breadcrumb");
    expect(strip).toContain("pointer-events: none");
    const trigger = rule(".hk-modal-breadcrumb-more");
    expect(trigger).toContain("pointer-events: auto");
    expect(trigger).toContain("flex: none");
    expect(trigger).toMatch(/min-width: var\(--hk-breadcrumb-more-size/);
    // 24px of chrome is under half a fingertip: the hit area is grown by a
    // pseudo-element instead of inflating the drawn control.
    const hitArea = scss.match(/\.hk-modal-breadcrumb-more::after\s*{[^}]*}/)?.[0] ?? "";
    expect(hitArea).toContain("position: absolute");
    expect(hitArea).toContain("inset: calc(-1 * var(--space-8");
  });

  it("z-bands the strip above the anchored surfaces it floats over", () => {
    // The strip reaches over an anchored dropdown's panel on purpose (it
    // must stay readable over the window it annotates); dropping it into
    // the window band would bury it under every open sheet instead.
    const z = Number(scss.match(/z-index:\s*var\(--hk-breadcrumb-z,\s*(\d+)\)/)?.[1]);
    expect(Number.isFinite(z), "the strip declares a z fallback").toBe(true);
    expect(z).toBeGreaterThan(POPUP_Z_BANDS.dropdown);
    expect(z).toBeLessThan(POPUP_Z_BANDS.tooltip);
  });

  it("opens the menu clear of the strip's own bar", () => {
    // The trigger sits INSIDE the strip's padding box, so a small offset
    // tucks the panel's first pixels under the strip's opaque bar. The
    // offset must clear the bottom padding plus the border.
    const offset = Number(tsx.match(/offset=\{(\d+)\}/)?.[1]);
    expect(Number.isFinite(offset), "the popover offset is a literal").toBe(true);
    const block = rule(".hk-modal-breadcrumb");
    const padding = block.match(/padding:\s*var\(--space-\d+,\s*([\d.]+)rem\)/)?.[1];
    const border = block.match(/border:\s*([\d.]+)px/)?.[1];
    expect(padding, "the strip declares its vertical padding").toBeTruthy();
    expect(border, "the strip declares its border").toBeTruthy();
    const clearance = Number(padding) * 16 + Number(border);
    expect(offset).toBeGreaterThan(clearance);
  });

  it("routes the hidden-layers menu through the shared form-factor rule", () => {
    // HkPopover owns "anchored under the trigger on desktop, bottom-up
    // sheet on mobile" and registers the surface with the popup manager;
    // a bespoke panel here would fork that behaviour.
    expect(tsx).toContain("<HkPopover");
    expect(tsx).toMatch(/sheetOnMobile\b/);
    expect(tsx).toMatch(/anchorRef=\{moreRef\.value\}/);
    expect(tsx).toContain('aria-haspopup="dialog"');
  });

  it("keeps the fold off the accessibility tree and the names on it", () => {
    // The clone duplicates every label — it must stay invisible to AT.
    expect(tsx).toMatch(/hk-modal-breadcrumb-measure"[^>]*aria-hidden="true"/);
    // A cut label IS a button, and a cut string is not a name: the whole
    // layer name travels as its accessible name.
    expect(tsx).toMatch(/aria-label=\{crumb\.label\}/);
    // The tappable label must reach through the pointer-transparent strip.
    expect(rule(".hk-modal-breadcrumb-item-reveal")).toContain("pointer-events: auto");
  });

  it("keeps the tappable label the same box the ruler measures", () => {
    // The clone renders a plain span per label, so padding on the button
    // would make the fold under-count its own crumb; the ~17px text line is
    // also under half a fingertip, and this is the phone-primary
    // affordance. Grow the hit area, not the chrome.
    const block = rule(".hk-modal-breadcrumb-item-reveal");
    expect(block).toContain("padding: 0");
    expect(block).toContain("pointer-events: auto");
    expect(block).toContain("text-align: start");
    const hitArea = scss.match(/\.hk-modal-breadcrumb-item-reveal::after\s*{[^}]*}/)?.[0] ?? "";
    expect(hitArea).toContain("position: absolute");
    expect(hitArea).toContain("inset: calc(-1 * var(--space-8");
  });

  it("opens the revealed name in the same popover family as the menu", () => {
    // Two surfaces, one form-factor rule: both are HkPopovers that dock as
    // a sheet on mobile, anchored to the crumb they belong to.
    expect(tsx.match(/<HkPopover/g)).toHaveLength(2);
    expect(tsx.match(/sheetOnMobile/g)).toHaveLength(2);
    // A revealed name wraps instead of cutting.
    const block = rule(".hk-modal-breadcrumb-reveal");
    expect(block).toContain("overflow-wrap: anywhere");
    expect(block).not.toContain("text-overflow: ellipsis");
  });
});
