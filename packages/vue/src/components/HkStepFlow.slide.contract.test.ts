/**
 * Source contract for the split-window stepflow swap (2026-09-23 user
 * directive, round 16): the content swap and the sheet's height change
 * play as TWO SEQUENTIAL windows. The slide window is the classic
 * direction-aware crossfade over one grid cell with the sheet's height
 * FROZEN; the morph window hands the sheet its new height only after
 * the slide settled. No counter rides, no ride registry, no
 * phase-overlap edges — the concurrent era's machinery is retired.
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

const DURATION = "var(--hk-stepflow-duration, 0.3s)";
const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

describe("HkStepFlow split-window swap contract", () => {
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

  it("declares ONE slide window: opacity and transform share duration and ease", () => {
    const rule = src.match(/\.hk-stepflow-body\s*\{[^}]*\}/)![0]!;
    const transitions = rule.match(/transition:\s*[^;}]+/g) ?? [];
    expect(transitions).toHaveLength(1);
    const decl = transitions[0]!.replace(/\s+/g, " ");
    expect(decl).toContain(`opacity ${DURATION} ${EASE}`);
    expect(decl).toContain(`transform ${DURATION} ${EASE}`);
    // No delay tricks and no per-property duration split — the classic
    // crossfade is one window.
    expect(decl).not.toMatch(/-?\d*\.?\d+m?s\s*$/);
  });

  it("binds each direction's travel sign to its exact selector", () => {
    const body = ".hk-stepflow-body";
    const stage = ".hk-stepflow-bodies";
    const ltr: Array<[string, string]> = [
      [`${stage}[data-direction="forward"] ${body}.hk-stepflow-enter-from`, "translateX(var(--hk-stepflow-travel, 24px))"],
      [`${stage}[data-direction="back"] ${body}.hk-stepflow-enter-from`, "translateX(calc(-1 * var(--hk-stepflow-travel, 24px))"],
      [`${stage}[data-direction="forward"] ${body}.hk-stepflow-leave-to`, "translateX(calc(-1 * var(--hk-stepflow-travel, 24px))"],
      [`${stage}[data-direction="back"] ${body}.hk-stepflow-leave-to`, "translateX(var(--hk-stepflow-travel, 24px))"],
    ];
    const rtl: Array<[string, string]> = [
      [`[dir="rtl"] ${stage}[data-direction="forward"] ${body}.hk-stepflow-enter-from`, "translateX(calc(-1 * var(--hk-stepflow-travel, 24px))"],
      [`[dir="rtl"] ${stage}[data-direction="back"] ${body}.hk-stepflow-enter-from`, "translateX(var(--hk-stepflow-travel, 24px))"],
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

  it("has no leftover concurrent-era machinery", () => {
    // Comments may reference the retired concepts; the CODE may not.
    const bare = tsx
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    for (const gone of [
      "counter",
      "sheetRide",
      "useSheetRide",
      "unregisterRide",
      "ENTER_EDGE_SHARE",
      "RECYCLE_SHARE",
      "swapRecycled",
      "hk-stepflow-enter-hidden",
      "hk-stepflow-enter-pending",
      "align-self",
      "SHEET_SWEEP_STAGE_EVENT",
      "SHEET_SWEEP_SETTLE_EVENT",
    ]) {
      expect(bare, `${gone} must be gone from the component`).not.toContain(gone);
      expect(src, `${gone} must be gone from the stylesheet`).not.toContain(gone);
    }
  });

  it("announces the two-window protocol on the swap event", () => {
    expect(tsx).toContain('phase: "swap"');
    expect(tsx).toContain('phase: "morph"');
    expect(tsx).toContain('phase: "instant"');
    // The slide window freezes the sheet BEFORE the patch that mounts
    // the entering body.
    const swapIdx = tsx.indexOf('phase: "swap"');
    const freezeIdx = tsx.indexOf("bodies.value = [...bodies.value, entering]");
    expect(swapIdx).toBeGreaterThan(-1);
    expect(freezeIdx).toBeGreaterThan(-1);
    expect(swapIdx).toBeLessThan(freezeIdx);
  });

  it("books the slide window on the animation context", () => {
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
    expect(tsx).toContain("event.target === enteringEl");
    expect(tsx).toContain('event.propertyName === "opacity"');
  });

  it("releases the staged offset imperatively in the mount frame's successor", () => {
    expect(tsx).toContain('classList.remove("hk-stepflow-enter-from")');
  });

  it("retires the old vocabulary and media forks", () => {
    expect(tsx).not.toContain("hk-stepflow-fwd");
    expect(tsx).not.toContain("hk-stepflow-back");
    expect(tsx).not.toContain("hk-stepflow-enter-tail");
    expect(src).not.toContain("hk-stepflow-fwd");
    expect(src).not.toContain("hk-stepflow-back");
    expect(src).not.toContain("min-height");
    expect(src).not.toMatch(/@media[^{]*max-width/);
  });

  it("zeroes the transition under reduced motion", () => {
    expect(src).toMatch(
      /prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]{0,160}?\.hk-stepflow-body\s*\{\s*transition:\s*none/,
    );
  });
});
