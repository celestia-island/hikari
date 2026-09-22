/**
 * Source contract for the simplified stepflow swap (2026-09-22 user
 * directive, round 12: "reduce the property count — only opacity, and
 * recycle the old element at the right time"). The stage is a grid, the
 * motion is opacity-only (plus the leaving body's direction slide), and
 * the old DOM node is recycled at the phase boundary. No visibility
 * flips, no absolute positioning, no height pins, no measured offsets,
 * no park mechanism.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkStepFlow.scss"), "utf-8");
const tsx = readFileSync(join(here, "HkStepFlow.tsx"), "utf-8");

function extractRules(source: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = [];
  let i = 0;
  while (i < source.length) {
    const open = source.indexOf("{", i);
    if (open === -1) break;
    const selector = source
      .slice(i, open)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
      .trim();
    let depth = 1;
    let j = open + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === "{") depth += 1;
      else if (source[j] === "}") depth -= 1;
      j += 1;
    }
    rules.push({ selector, body: source.slice(open + 1, j - 1) });
    i = j;
  }
  return rules;
}

const scssRules = extractRules(src);

function blockFor(selector: string): string {
  const hits = scssRules.filter((r) =>
    r.selector.split(",").map((s) => s.trim()).includes(selector),
  );
  expect(hits, `exactly one rule carries ${selector}`).toHaveLength(1);
  return hits[0]!.body;
}

const PHASE = "calc(var(--hk-stepflow-duration, 0.3s) / 2)";

describe("HkStepFlow simplified swap contract", () => {
  it("pins the shared duration and travel tokens", () => {
    const root = src.match(/\.hk-step-flow\s*\{[^}]*\}/)![0]!;
    expect(root).toContain("--hk-stepflow-duration: 0.3s;");
    expect(root).toContain("--hk-stepflow-travel: 24px;");
  });

  it("uses a single grid cell for every body — no absolute positioning", () => {
    const stage = blockFor(".hk-stepflow-bodies");
    expect(stage).toContain("display: grid");
    const body = src.match(/\.hk-stepflow-body\s*\{[^}]*\}/)![0]!;
    expect(body).toContain("grid-area: 1 / 1");
    expect(src).not.toContain("position: absolute");
    expect(src).not.toContain("position:relative");
  });

  it("declares the in-place enter grammar on the base body rule", () => {
    const rule = src.match(/\.hk-stepflow-body\s*\{[^}]*\}/)![0]!;
    const transitions = rule.match(/transition:\s*[^;}]+/g) ?? [];
    expect(transitions).toHaveLength(1);
    const decl = transitions[0]!;
    expect(decl).toContain("opacity");
    expect(decl).toContain(PHASE);
    expect(decl).toContain("cubic-bezier(0.4, 0, 0.2, 1)");
    // The negative delay starts the fade already partway up its curve,
    // closing the blank-body window between the two phases.
    expect(decl).toContain("-40ms");
    expect(decl, "the enter phase never travels").not.toContain("transform");
  });

  it("stages the new body with opacity only — NO visibility flip", () => {
    const rule = blockFor(".hk-stepflow-body.hk-stepflow-enter-pending");
    expect(rule).toContain("opacity: 0");
    expect(rule).toContain("pointer-events: none");
    expect(rule).toContain("align-self: end");
    expect(rule, "visibility re-rasters the layer — the flash source").not.toContain("visibility");
  });

  it("keeps the leaving body's fade gentle while the slide accelerates", () => {
    const rule = src.match(/\.hk-stepflow-body\.leaving\s*\{[^}]*\}/)![0]!;
    expect(rule).toContain("pointer-events: none");
    expect(rule).toContain("cubic-bezier(0.4, 0, 0.6, 1)");
    expect(rule).toContain("cubic-bezier(0.5, 0, 0.75, 0)");
    expect(rule).toContain(PHASE);
  });

  it("binds each direction's travel sign to its exact selector", () => {
    const body = ".hk-stepflow-body";
    const stage = ".hk-stepflow-bodies";
    const ltr: Array<[string, string]> = [
      [`${stage}[data-direction="forward"] ${body}.hk-stepflow-leave-to`, "translateX(calc(-1 * var(--hk-stepflow-travel, 24px))"],
      [`${stage}[data-direction="back"] ${body}.hk-stepflow-leave-to`, "translateX(var(--hk-stepflow-travel, 24px))"],
    ];
    const rtl: Array<[string, string]> = [
      [`[dir="rtl"] ${stage}[data-direction="forward"] ${body}.hk-stepflow-leave-to`, "translateX(var(--hk-stepflow-travel, 24px))"],
      [`[dir="rtl"] ${stage}[data-direction="back"] ${body}.hk-stepflow-leave-to`, "translateX(calc(-1 * var(--hk-stepflow-travel, 24px))"],
    ];
    for (const [selector, sign] of [...ltr, ...rtl]) {
      const block = blockFor(selector);
      expect(block, `${selector} must carry ${sign}`).toContain(sign);
    }
    expect(tsx).toContain("data-direction={dir}");
  });

  it("keeps all motion in the stylesheet — the component writes no styles", () => {
    expect(tsx).not.toContain("style.transition");
    expect(tsx).not.toContain("style.transform");
    expect(tsx).not.toContain("style.opacity");
    expect(tsx).not.toContain("style.top");
    expect(tsx).not.toContain("style.minHeight");
    expect(tsx).not.toContain("translateY");
  });

  it("has no leftover park/pin/sweep-consumer machinery", () => {
    expect(tsx).not.toContain("pinOldHeight");
    expect(tsx).not.toContain("clearPin");
    expect(tsx).not.toContain("holdLine");
    expect(tsx).not.toContain("parkTail");
    expect(tsx).not.toContain("stageShrinkFold");
    expect(tsx).not.toContain("hk-stepflow-enter-tail");
    expect(tsx).not.toContain("SHEET_SWEEP_STAGE_EVENT");
    expect(tsx).not.toContain("SHEET_SWEEP_SETTLE_EVENT");
    expect(src).not.toContain("hk-stepflow-enter-tail");
    expect(src).not.toContain("min-height");
  });

  it("books every phase window on the animation context", () => {
    expect(tsx).toContain('from "../runtime/animationBus"');
    expect(tsx).toContain("reportTransition(");
    expect(tsx).not.toContain("requestAnimationFrame(");
    expect(tsx).not.toContain("scheduleFrame(");
  });

  it("settles deterministically where no transition runs", () => {
    expect(tsx).toContain("bodyTransitionMs");
    expect(tsx).toContain("transitionDuration");
    expect(tsx).toContain("SWAP_WATCHDOG_GRACE_MS");
    expect(tsx).toContain('addEventListener("transitionend"');
    expect(tsx).toContain("event.target === el");
  });

  it("recycles the old DOM node at the phase boundary", () => {
    expect(tsx).toMatch(/bodies\.value = bodies\.value\.filter\(\(b\) => b\.id !== handle\.leavingId\)/);
  });

  it("retires the old vocabulary and media forks", () => {
    expect(tsx).not.toContain("hk-stepflow-fwd");
    expect(tsx).not.toContain("hk-stepflow-back");
    expect(tsx).not.toContain("hk-stepflow-enter-from");
    expect(src).not.toContain("hk-stepflow-fwd");
    expect(src).not.toContain("hk-stepflow-back");
    expect(src).not.toContain("hk-stepflow-enter-from");
    expect(src).not.toMatch(/@media[^{]*max-width/);
  });

  it("zeroes the transition under reduced motion", () => {
    expect(src).toMatch(
      /prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]{0,160}?\.hk-stepflow-body\s*\{\s*transition:\s*none/,
    );
  });
});
