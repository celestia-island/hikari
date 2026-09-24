/**
 * Source contract for the window-mode bond's visibility.
 *
 * Round-24 chest report: 左中右三段式的步骤左右没有横线 — the provider wizard's
 * step indicator rendered its three cells but neither the completed bond,
 * the pending bond, nor the edge continuations read as lines. Two
 * independent causes, both measured on a real engine, both pinned here:
 *
 *   1. The stuck pin ignored the host's declared gutter. The step-flow's
 *      sticky rule is (0,4,0) and the pin contract's offset rule is
 *      (0,3,0), so a bare `0px` default out-specified the contract and
 *      parked the pin flush against the scrollport edge. The window-mode
 *      bonds sit 11-13px below the pin's top and therefore landed inside
 *      HkModal's own gutter cover (`.hk-modal-body::before`, z-index 3),
 *      which left their visibility resting entirely on the pin's z-index
 *      beating that cover. One promoted wrapper between the scroll host
 *      and the pin collapses it: the bond then measures 0 % under an
 *      opaque cover and exactly 5.0 % under a 95 % one.
 *   2. The pending bond derived its colour from `--hi-color-border`, which
 *      the shipped schemes define WITH alpha (rgb(128 128 128 / 15%)), so
 *      the bond computed to 15 % × 30 % = 4.5 % — and a 2px line at 4.5 %
 *      is not a line.
 *
 * Both are pure stylesheet facts, which is why they are asserted against
 * the source: jsdom runs no cascade, and the failure only shows up as
 * pixels. The geometry half of the same investigation (the containing
 * block is correct — the overlay anchors to the sticky timeline) needs no
 * assertion; it was never wrong.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string): string => readFileSync(join(here, name), "utf-8");

const stepflow = read("HkStepFlow.scss");
const timeline = read("HkTimeline.scss");
const scrollpin = read("HkScrollPin.scss");

/** The declaration block of the first rule whose selector starts at `from`. */
function blockAfter(source: string, from: number): string {
  const end = source.indexOf("}", from);
  return end < 0 ? source.slice(from) : source.slice(from, end);
}

describe("window-mode bond visibility contract", () => {
  it("keeps the pin contract's gutter as the sticky step-flow header's default offset", () => {
    // The pin contract still declares the gutter for an offset top pin...
    expect(scrollpin).toContain("top: var(--hk-scroll-pad-top, 0px)");

    // ...and the step-flow override DEFERS to it instead of replacing it
    // with 0. Losing this is silent: the pin still pins, the cells still
    // render, only the bonds fall under the host's gutter cover.
    const at = stepflow.indexOf(
      ".hk-step-flow[data-sticky-header] > .hk-timeline.hk-scroll-pin",
    );
    expect(at).toBeGreaterThan(-1);
    const block = blockAfter(stepflow, at);
    expect(block).toContain(
      "top: var(--hk-stepflow-sticky-top, var(--hk-scroll-pad-top, 0px));",
    );
    // The old bare default must not come back.
    expect(block).not.toContain("top: var(--hk-stepflow-sticky-top, 0px);");
  });

  it("derives the pending bond from an opaque tone so its alpha is not multiplied", () => {
    const at = timeline.indexOf('&[data-status="pending"]');
    expect(at).toBeGreaterThan(-1);
    const block = blockAfter(timeline, at);
    expect(block).toContain("--_link-color:");
    expect(block).toContain("var(--hi-color-muted");
    // Deriving from the border token multiplied its own alpha.
    expect(block).not.toContain("var(--hi-color-border)");
  });

  it("carries both bonds as real boxes on the shared node geometry", () => {
    // The segments are positioned off the shared tokens, so a bond can only
    // be invisible through colour or occlusion — never through zero size.
    expect(timeline).toContain("--hk-timeline-link-thickness: 2px");
    expect(timeline).toContain("--hk-timeline-link-clearance: 20px");
    expect(timeline).toContain('&[data-segment="before-current"]');
    expect(timeline).toContain('&[data-segment="current-after"]');
  });
});
