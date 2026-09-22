/**
 * Source contract for the stepflow direction-aware slide (2026-09-22 user
 * directive: back to the classic slide scheme, re-based on pure CSS with
 * the shared animation context driving state, zero black flashes).
 *
 * A swap renders BOTH bodies for the whole duration — the entering one in
 * the flow, the leaving one absolutely positioned — and the stylesheet
 * owns ALL motion: direction, travel and easings are attribute/class
 * driven, so a refactor cannot silently reintroduce inline-style
 * choreography, a vertical ride, or the retired out-in grammar. The
 * component side is pinned to the animation bus (scheduleFrame /
 * reportTransition, no bare rAF) and to deterministic settling where no
 * transition runs (reduced motion / stylesheet-less runtimes).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkStepFlow.scss"), "utf-8");
const tsx = readFileSync(join(here, "HkStepFlow.tsx"), "utf-8");

describe("HkStepFlow slide contract", () => {
  it("pins the shared duration and travel tokens", () => {
    const root = src.match(/\.hk-step-flow\s*\{[^}]*\}/)![0]!;
    expect(root).toContain("--hk-stepflow-duration: 0.3s;");
    expect(root).toContain("--hk-stepflow-travel: 24px;");
  });

  it("declares the enter grammar on the base body rule", () => {
    const rule = src.match(/\.hk-stepflow-body\s*\{[^}]*\}/)![0]!;
    const transitions = rule.match(/transition:\s*[^;}]+/g) ?? [];
    expect(transitions).toHaveLength(1);
    const decl = transitions[0]!;
    expect(decl).toContain("opacity");
    expect(decl).toContain("transform");
    expect(decl).toContain("var(--hk-stepflow-duration, 0.3s)");
    // The classic expressive ease-out on enter.
    expect(decl).toContain("cubic-bezier(0.16, 1, 0.3, 1)");
  });

  it("keeps the leaving body out of the flow with the leave grammar", () => {
    const rule = src.match(/\.hk-stepflow-body\.leaving\s*\{[^}]*\}/)![0]!;
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("pointer-events: none");
    // The classic sharp ease-in on leave.
    expect(rule).toContain("cubic-bezier(0.5, 0, 0.75, 0)");
    expect(rule).toContain("var(--hk-stepflow-duration, 0.3s)");
  });

  it("drives the travel direction purely from data-direction attributes", () => {
    // Forward advances exit left / enter from the right; back mirrors.
    expect(src).toContain(
      '.hk-stepflow-bodies[data-direction="forward"] .hk-stepflow-body.hk-stepflow-enter-from',
    );
    expect(src).toContain(
      '.hk-stepflow-bodies[data-direction="forward"] .hk-stepflow-body.hk-stepflow-leave-to',
    );
    expect(src).toContain(
      '.hk-stepflow-bodies[data-direction="back"] .hk-stepflow-body.hk-stepflow-enter-from',
    );
    expect(src).toContain(
      '.hk-stepflow-bodies[data-direction="back"] .hk-stepflow-body.hk-stepflow-leave-to',
    );
    expect(src).toContain("translateX(var(--hk-stepflow-travel, 24px))");
    expect(src).toContain("translateX(calc(-1 * var(--hk-stepflow-travel, 24px))");
    // The stage keeps its relative positioning for the overlay grammar.
    expect(src).toMatch(/\.hk-stepflow-bodies\s*\{[^}]*position:\s*relative/);
    // RTL mirrors the slide (house pattern).
    expect(src).toContain('[dir="rtl"] .hk-stepflow-bodies[data-direction="forward"]');
    expect(src).toContain('[dir="rtl"] .hk-stepflow-bodies[data-direction="back"]');
    // The component renders the direction attribute the CSS keys off.
    expect(tsx).toContain("data-direction={dir}");
  });

  it("keeps all motion in the stylesheet — no inline style choreography", () => {
    // The 2026-09-22 directive: CSS is the base. The component toggles
    // classes only; it must never write motion styles or compute rides.
    expect(tsx).not.toContain("style.transition");
    expect(tsx).not.toContain("style.transform");
    expect(tsx).not.toContain("style.opacity");
    expect(tsx).not.toContain("translateY");
  });

  it("schedules state on the shared animation bus, never on bare rAF", () => {
    expect(tsx).toContain('from "../runtime/animationBus"');
    expect(tsx).toContain("scheduleFrame(");
    expect(tsx).toContain("reportTransition(");
    expect(tsx).not.toContain("requestAnimationFrame(");
  });

  it("settles deterministically where no transition runs", () => {
    // The duration probe: zero (reduced motion / stylesheet-less runtime)
    // selects the atomic instant-settle path — the debt pin for chest's
    // transitionend-less wizard tests.
    expect(tsx).toContain("bodyTransitionMs");
    expect(tsx).toContain("transitionDuration");
    // The motion path keeps a watchdog so a lost transitionend cannot
    // freeze the swap (same grammar as the sheet morph).
    expect(tsx).toContain("SWAP_WATCHDOG_GRACE_MS");
    expect(tsx).toContain("addEventListener(\"transitionend\"");
  });

  it("dispatches the swap passthrough so the host sheet morphs in lockstep", () => {
    // The component side of the lockstep contract: the swap dispatches
    // the bubbling event the moment the entering body owns the flow
    // height, and the modal side short-circuits its settle debounce.
    expect(tsx).toContain("STEPFLOW_SWAP_EVENT");
    expect(tsx).toMatch(/new CustomEvent\(STEPFLOW_SWAP_EVENT/);
    const modal = readFileSync(join(here, "HkModal.tsx"), "utf-8");
    expect(modal).toContain('addEventListener(STEPFLOW_SWAP_EVENT');
    expect(modal).toMatch(/removeEventListener\(STEPFLOW_SWAP_EVENT/);
  });

  it("retires the crossfade ride and the retired out-in classes", () => {
    // Neither the round-7 vertical ride nor the pre-0.55.38 Vue
    // transition class grammar may sneak back in, and no media block may
    // fork step-body behaviour per viewport.
    expect(tsx).not.toContain("hk-stepflow-fwd");
    expect(tsx).not.toContain("hk-stepflow-back");
    expect(src).not.toContain("hk-stepflow-fwd");
    expect(src).not.toContain("hk-stepflow-back");
    expect(src).not.toMatch(/@media[^{]*max-width/);
  });

  it("zeroes the transition under reduced motion so the probe settles", () => {
    expect(src).toMatch(
      /prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]{0,160}?\.hk-stepflow-body\s*\{\s*transition:\s*none/,
    );
  });
});
