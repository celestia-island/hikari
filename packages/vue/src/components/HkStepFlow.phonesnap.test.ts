/**
 * Source contract for the phone step-swap snap (2026-09-21 chest field
 * report, AddProviderWizard Prev/Next "content blinks once").
 *
 * On ≤767px the step body's slide+fade must be inert: inside the mobile
 * bottom sheet the frame's own size morph already carries the spatial
 * feedback, and the slide's transient layer promotion/demotion costs a
 * one-frame raster gap at both ends on phone GPUs. Desktop keeps the
 * directional slide; reduced motion already snaps globally.
 *
 * Pinned here so a refactor cannot silently restore the phone slide —
 * the class names are the same, so only the media-scoped rule proves it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkStepFlow.scss"), "utf-8");

/** Brace-aware `@media <query>` block extractor: a naive slice at the
 *  first `}` would cut at the first nested rule's closing brace. */
function mediaBlocks(source: string, query: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const at = source.indexOf(`@media ${query}`, from);
    if (at < 0) break;
    const open = source.indexOf("{", at);
    let depth = 0;
    let i = open;
    for (; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push(source.slice(at, i + 1));
    from = i + 1;
  }
  return blocks;
}

const PHONE_QUERY = "(max-width: 767px)";
/** The four transition-class selectors Vue's <Transition> toggles. */
const ACTIVE_SELECTORS = [
  ".hk-stepflow-fwd-enter-active",
  ".hk-stepflow-back-enter-active",
  ".hk-stepflow-fwd-leave-active",
  ".hk-stepflow-back-leave-active",
];

/** The single ≤767px block, asserted present IN the test that needs it
 *  (a beforeAll assertion would downgrade a missing block to "skipped"
 *  instead of a hard failure). */
function phoneBlock(): string {
  const blocks = mediaBlocks(src, PHONE_QUERY);
  expect(blocks.length).toBe(1);
  return blocks[0]!;
}

describe("HkStepFlow phone snap contract", () => {
  it("disables the slide/fade transition on ≤767px", () => {
    const block = phoneBlock();
    for (const selector of ACTIVE_SELECTORS) {
      expect(block).toContain(selector);
    }
    // transition:none on every active class — the whole point: no
    // property animates, so no promotion window exists to blink.
    expect(block).toMatch(/transition:\s*none\s*;/);
    // …and it must be the ONLY transition declaration in the block
    // (a stray `transition: opacity …` would re-open the blink).
    const declarations = block.match(/transition:\s*[^;]+;/g) ?? [];
    expect(declarations).toHaveLength(1);
  });

  it("keeps the desktop slide outside the phone block", () => {
    // Mutation guard: the phone rule must be ADDITIVE. The base
    // (desktop) enter/leave rules still carry the opacity+transform
    // transition, so deleting them fails here instead of passing
    // vacuously.
    const baseEnter = src.match(
      /\.hk-stepflow-fwd-enter-active\s*,\s*\n\.hk-stepflow-back-enter-active\s*\{[^}]*\}/,
    );
    expect(baseEnter).not.toBeNull();
    expect(baseEnter![0]).toContain("transition:");
    expect(baseEnter![0]).toContain("opacity");
    expect(baseEnter![0]).toContain("transform");

    const baseLeave = src.match(
      /\.hk-stepflow-fwd-leave-active\s*,\s*\n\.hk-stepflow-back-leave-active\s*\{[^}]*\}/,
    );
    expect(baseLeave).not.toBeNull();
    expect(baseLeave![0]).toContain("opacity");
    expect(baseLeave![0]).toContain("transform");
  });

  it("keeps the reduce-motion snap block (house pattern) intact", () => {
    const blocks = mediaBlocks(src, "(prefers-reduced-motion: reduce)");
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toMatch(/transition:\s*none\s*;/);
  });
});
