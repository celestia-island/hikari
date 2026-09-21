/**
 * Source contract for the stepflow crossfade (2026-09-21 user spec,
 * round 7): a swap renders BOTH bodies for the whole duration — the
 * entering one in the flow, the leaving one absolutely positioned — and
 * the ride + fade share one duration/ease pair (0.3s family default) so
 * the sheet's clip sweep, the ride and the crossfade land together.
 *
 * Pinned here so a refactor cannot silently regress to the retired
 * out-in slide (hk-stepflow-fwd/back classes) or strand a phone-only
 * stand-down: the crossfade is the ONE grammar, on every viewport.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkStepFlow.scss"), "utf-8");

describe("HkStepFlow crossfade contract", () => {
  it("rides and fades on one shared duration/ease pair", () => {
    const rule = src.match(/\.hk-stepflow-body\s*\{[^}]*\}/)![0]!;
    const transitions = rule.match(/transition:\s*[^;}]+/g) ?? [];
    expect(transitions).toHaveLength(1);
    const decl = transitions[0]!;
    expect(decl).toContain("opacity");
    expect(decl).toContain("transform");
    expect(decl).toContain("var(--hk-stepflow-duration, 0.3s)");
  });

  it("defaults the family duration to 0.3s", () => {
    const root = src.match(/\.hk-step-flow\s*\{[^}]*\}/)![0]!;
    expect(root).toContain("--hk-stepflow-duration: 0.3s;");
  });

  it("keeps the leaving body out of the flow and pointer-transparent", () => {
    const rule = src.match(/\.hk-stepflow-body\.leaving\s*\{[^}]*\}/)![0]!;
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("pointer-events: none");
  });

  it("dispatches the swap passthrough so the host sheet morphs in lockstep", () => {
    // The component side of the lockstep contract: the swap dispatches
    // the bubbling event the moment the entering body owns the flow
    // height, and the modal side short-circuits its settle debounce.
    const tsx = readFileSync(join(here, "HkStepFlow.tsx"), "utf-8");
    expect(tsx).toContain("STEPFLOW_SWAP_EVENT");
    expect(tsx).toMatch(/new CustomEvent\(STEPFLOW_SWAP_EVENT/);
    const modal = readFileSync(join(here, "HkModal.tsx"), "utf-8");
    expect(modal).toContain('addEventListener(STEPFLOW_SWAP_EVENT');
    expect(modal).toMatch(/removeEventListener\(STEPFLOW_SWAP_EVENT/);
  });

  it("retires the out-in slide classes and every viewport stand-down", () => {
    // The retired grammar must not sneak back in, and the crossfade is
    // unconditional — no media block may fork step-body behaviour.
    expect(src).not.toContain("hk-stepflow-fwd");
    expect(src).not.toContain("hk-stepflow-back");
    expect(src).not.toMatch(/@media[^{]*max-width/);
  });
});
