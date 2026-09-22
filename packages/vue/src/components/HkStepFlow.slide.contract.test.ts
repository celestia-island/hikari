/**
 * Source contract for the stepflow two-phase swap (2026-09-22 user
 * directive, round 10: the old and the new body must NEVER be on screen
 * together — the simultaneous cross-slide read as a doubled ghost of
 * overlapping text — so the swap runs an exit phase (old body alone,
 * sliding out) and then an enter phase (new body alone, fading in
 * place), each half of the family duration; the sheet's height morph is
 * scheduled onto one of those phases depending on the direction of the
 * size change).
 *
 * The stylesheet owns ALL motion: direction, travel and easings are
 * attribute/class driven, so a refactor cannot silently reintroduce
 * inline-style choreography, a vertical ride, the simultaneous staged
 * grammar, or the retired out-in classes. The component side is pinned to
 * the animation-context bookkeeping (reportTransition, no bare rAF, every
 * phase timer carrying the shared grace) and to deterministic settling
 * where no transition runs (reduced motion / stylesheet-less runtimes).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkStepFlow.scss"), "utf-8");
const tsx = readFileSync(join(here, "HkStepFlow.tsx"), "utf-8");
const modal = readFileSync(join(here, "HkModal.tsx"), "utf-8");
const modalScss = readFileSync(join(here, "HkModal.scss"), "utf-8");

/** Top-level stylesheet rules as (selector-list, body) pairs. Nested
 *  blocks (e.g. the reduced-motion media query) come out as one rule
 *  whose body carries the inner braces — the direction rules this
 *  contract binds are all top-level. */
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

/** The declaration body of the ONE rule whose selector list carries the
 *  exact selector — zero hits means the selector vanished, two means the
 *  contract's premise broke; both are red. */
function blockFor(selector: string): string {
  const hits = scssRules.filter((r) =>
    r.selector.split(",").map((s) => s.trim()).includes(selector),
  );
  expect(hits, `exactly one rule carries ${selector}`).toHaveLength(1);
  return hits[0]!.body;
}

const PHASE = "calc(var(--hk-stepflow-duration, 0.3s) / 2)";
const TRAVEL_POSITIVE = "translateX(var(--hk-stepflow-travel, 24px))";
const TRAVEL_NEGATIVE = "translateX(calc(-1 * var(--hk-stepflow-travel, 24px))";

describe("HkStepFlow two-phase swap contract", () => {
  it("pins the shared duration and travel tokens", () => {
    const root = src.match(/\.hk-step-flow\s*\{[^}]*\}/)![0]!;
    expect(root).toContain("--hk-stepflow-duration: 0.3s;");
    expect(root).toContain("--hk-stepflow-travel: 24px;");
  });

  it("declares the in-place enter grammar on the base body rule", () => {
    // The new body FADES IN PLACE for the second phase: opacity only, one
    // phase long, expressive ease-out — and explicitly no travel.
    const rule = src.match(/\.hk-stepflow-body\s*\{[^}]*\}/)![0]!;
    const transitions = rule.match(/transition:\s*[^;}]+/g) ?? [];
    expect(transitions).toHaveLength(1);
    const decl = transitions[0]!;
    expect(decl).toContain("opacity");
    expect(decl).toContain(PHASE);
    expect(decl).toContain("cubic-bezier(0.16, 1, 0.3, 1)");
    expect(decl, "the enter phase never travels").not.toContain("transform");
  });

  it("keeps the leaving body out of the flow with the leave grammar", () => {
    const rule = src.match(/\.hk-stepflow-body\.leaving\s*\{[^}]*\}/)![0]!;
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("pointer-events: none");
    // Default anchor is the TOP: an in-flow stage keeps its top line and
    // grows downward, so that is where the old body holds its position
    // (chest's LoginView renders this flow in a grid-stack crossfade).
    expect(rule).toContain("top: 0");
    expect(rule, "the default anchor is not the bottom").not.toContain("bottom: 0");
    // The classic sharp ease-in on leave, for BOTH opacity and travel.
    expect(rule).toContain("cubic-bezier(0.5, 0, 0.75, 0)");
    expect(rule).toContain(PHASE);
    const transitions = rule.match(/transition:\s*[^;}]+/g) ?? [];
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toContain("opacity");
    expect(transitions[0]).toContain("transform");
  });

  it("scopes the bottom anchor and the parking to bottom-docked sheet hosts", () => {
    // A bottom-docked sheet is the ONE host whose bottom line is fixed
    // while it grows, so it — and only it — overrides the anchor and gets
    // the tail parking. The flag is the host contract useSizeMorph already
    // reads (`--hk-sheet-morph: clip`, set by the modal's phone block).
    const override = blockFor(
      '.hk-stepflow-bodies[data-anchor="bottom"] .hk-stepflow-body.leaving',
    );
    expect(override).toContain("bottom: 0");
    expect(override).toContain("top: auto");
    // …and the tail rule rides the same host flag.
    expect(
      blockFor(
        '.hk-stepflow-bodies[data-anchor="bottom"] .hk-stepflow-body.hk-stepflow-enter-tail',
      ),
    ).toContain("bottom: 0");
    expect(tsx).toContain("sheetClipHost");
    expect(tsx).toContain('closest<HTMLElement>(".hk-modal-content")');
    expect(tsx).toContain("--hk-sheet-morph");
    expect(tsx).toContain('"clip"');
    expect(tsx).toMatch(/data-anchor=\{anchorMode\.value\s*\?\s*"bottom"/);
  });

  it("parks a shrink's new body in the bottom band the fold lands on", () => {
    // Clause 5: the new content must already sit at its final geometry
    // while the sheet's clip edge folds down, so the atomic re-pin lands
    // (nearly) nothing. The band is the stage's bottom — the line the fold
    // descends to — declared as its own rule and bound to a shrink's enter
    // phase on such a host only.
    const rule = blockFor(".hk-stepflow-body.hk-stepflow-enter-tail");
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("bottom: 0");
    expect(rule, "the parked body must not travel").not.toContain("transform");
    expect(tsx).toContain("hk-stepflow-enter-tail");
    expect(tsx).toMatch(/tailPhase\.value\s*=\s*true/);
    // The parking is gated on the anchored host, and the order matters:
    // measure (pin off) → announce → re-pin the old height + park, all
    // before the browser can paint.
    expect(tsx).toMatch(
      /if \(anchorMode\.value\) \{[\s\S]{0,300}?pinOldHeight\(handle\.oldH\);[\s\S]{0,120}?tailPhase\.value = true;/,
    );
    expect(tsx).toMatch(
      /handle\.delta\s*<\s*0\s*\)\s*\{[\s\S]{0,1400}?clearPin\(\);[\s\S]{0,200}?announce\(handle\);/,
    );
  });

  it("stages the new body laid out but invisible so the bodies cannot overlap", () => {
    // The round-10 ghost fix: the entering body exists from frame one (so
    // the flow owns the new height immediately) but is unpaintable for the
    // whole exit phase.
    const rule = blockFor(".hk-stepflow-body.hk-stepflow-enter-pending");
    expect(rule).toContain("visibility: hidden");
    expect(rule).toContain("opacity: 0");
    expect(rule, "the staged body never travels").not.toContain("transform");
    // …and the component binds it to the EXIT phase only: the class lifts
    // at the phase-2 edge, which is what starts the fade in place.
    expect(tsx).toContain("hk-stepflow-enter-pending");
    expect(tsx).toContain('swapPhase.value === "exit"');
    // The component must announce the enter edge as a distinct phase.
    expect(tsx).toMatch(/phase\s*=\s*"enter"/);
    expect(tsx).toMatch(/swapPhase\.value\s*=\s*"enter"/);
  });

  it("binds each direction's travel sign to its exact selector", () => {
    // Only the LEAVING body travels (the entering one appears in place), so
    // the direction grammar binds exactly four selectors, sign-bound: a
    // sign inversion must go red. forward exits LEFT (−travel), back exits
    // RIGHT (+travel); RTL mirrors the mapping.
    const body = ".hk-stepflow-body";
    const stage = ".hk-stepflow-bodies";
    const ltr: Array<[string, string]> = [
      [`${stage}[data-direction="forward"] ${body}.hk-stepflow-leave-to`, TRAVEL_NEGATIVE],
      [`${stage}[data-direction="back"] ${body}.hk-stepflow-leave-to`, TRAVEL_POSITIVE],
    ];
    const rtl: Array<[string, string]> = [
      [`[dir="rtl"] ${stage}[data-direction="forward"] ${body}.hk-stepflow-leave-to`, TRAVEL_POSITIVE],
      [`[dir="rtl"] ${stage}[data-direction="back"] ${body}.hk-stepflow-leave-to`, TRAVEL_NEGATIVE],
    ];
    for (const [selector, sign] of ltr) {
      const block = blockFor(selector);
      expect(block, `${selector} must carry ${sign}`).toContain(sign);
      const other = sign === TRAVEL_POSITIVE ? TRAVEL_NEGATIVE : TRAVEL_POSITIVE;
      expect(block, `${selector} must not carry ${other}`).not.toContain(other);
      expect(block).toContain("opacity: 0");
    }
    // RTL blocks are transform-only overrides over the LTR grammar.
    for (const [selector, sign] of rtl) {
      const block = blockFor(selector);
      expect(block, `${selector} must carry ${sign}`).toContain(sign);
      const other = sign === TRAVEL_POSITIVE ? TRAVEL_NEGATIVE : TRAVEL_POSITIVE;
      expect(block, `${selector} must not carry ${other}`).not.toContain(other);
    }
    // No direction rule may hang off the staged or entering class — the
    // new body never travels, in any direction (checked per RULE: the
    // class name also appears in comments, so a raw regex over the file
    // would false-positive across rule boundaries).
    const pendingRules = scssRules.filter((r) =>
      r.selector.includes("hk-stepflow-enter-pending"),
    );
    expect(pendingRules.length).toBeGreaterThan(0);
    for (const r of pendingRules) {
      expect(r.body, r.selector).not.toContain("transform");
      expect(r.selector).not.toContain("data-direction");
    }
    // The stage keeps its relative positioning for the overlay grammar.
    expect(src).toMatch(/\.hk-stepflow-bodies\s*\{[^}]*position:\s*relative/);
    // The component renders the direction attribute the CSS keys off.
    expect(tsx).toContain("data-direction={dir}");
  });

  it("keeps all motion in the stylesheet — the only inline write is the height pin", () => {
    // The 2026-09-22 directive: CSS is the base. The component toggles
    // classes and (for a shrink's exit phase) pins the flow's old height;
    // it must never write motion styles.
    expect(tsx).not.toContain("style.transition");
    expect(tsx).not.toContain("style.transform");
    expect(tsx).not.toContain("style.opacity");
    expect(tsx).not.toContain("translateY");
    // The one permitted inline write, and it is geometry staging only.
    expect(tsx).toContain("style.minHeight");
  });

  it("books every phase window on the animation context, never a bare rAF", () => {
    expect(tsx).toContain('from "../runtime/animationBus"');
    expect(tsx).toContain("reportTransition(");
    expect(tsx).not.toContain("requestAnimationFrame(");
    // No frame-loop state control survives: the exit class flips in the
    // swap patch itself and the staged state is long-lived, so the old
    // staging frame is gone. Every phase timer must still carry the shared
    // grace so a lost transitionend cannot strand a phase.
    expect(tsx).toMatch(
      /setTimeout\([^,]+,\s*handle\.phaseMs\s*\+\s*SWAP_WATCHDOG_GRACE_MS\)/,
    );
  });

  it("settles deterministically where no transition runs", () => {
    // The duration probe: zero (reduced motion / stylesheet-less runtime)
    // selects the atomic instant-settle path — the debt pin for chest's
    // transitionend-less wizard tests.
    expect(tsx).toContain("bodyTransitionMs");
    expect(tsx).toContain("transitionDuration");
    // The motion path keeps a watchdog so a lost transitionend cannot
    // freeze a phase (same grammar as the sheet morph).
    expect(tsx).toContain("SWAP_WATCHDOG_GRACE_MS");
    expect(tsx).toContain('addEventListener("transitionend"');
    // transitionend bubbles — only the acting body's own transitions may
    // advance a phase (R3 spot mutation: removing this guard survived the
    // suite, so it is pinned here).
    expect(tsx).toContain("event.target === el");
  });

  it("schedules the sheet morph onto the phase that owns the height change", () => {
    // Grow: the flow owns the new height from frame one → announced at the
    // EXIT edge. Shrink: the flow holds its old height → announced at the
    // ENTER edge (the pin lifts in the same step).
    expect(tsx).toMatch(/delta\s*>=\s*0/);
    expect(tsx).toContain("pinOldHeight(");
    expect(tsx).toMatch(/handle\.delta\s*<\s*0\s*\)\s*\{[\s\S]{0,1400}?clearPin\(\)[\s\S]{0,200}?announce\(handle\)/);
    // The event carries the phase length so the sheet can match it.
    expect(tsx).toContain("durationMs: handle.phaseMs");
  });

  it("dispatches the swap passthrough so the host sheet morphs in lockstep", () => {
    expect(tsx).toContain("STEPFLOW_SWAP_EVENT");
    expect(tsx).toMatch(/new CustomEvent\(STEPFLOW_SWAP_EVENT/);
    expect(modal).toContain('addEventListener(STEPFLOW_SWAP_EVENT');
    expect(modal).toMatch(/removeEventListener\(STEPFLOW_SWAP_EVENT/);
    // The modal side consumes the phase length and overrides the phone
    // clip's duration token for that one morph — the stylesheet default
    // (0.3s) stays the family standard for every other morph.
    expect(modal).toContain("durationMs");
    expect(modal).toContain("--hk-modal-morph-duration");
    expect(modal).toMatch(/style\.setProperty\("--hk-modal-morph-duration"/);
    expect(modal).toMatch(/style\.removeProperty\("--hk-modal-morph-duration"\)/);
    expect(modalScss).toMatch(
      /clip-path var\(--hk-modal-morph-duration, 0\.3s\)/,
    );
  });

  it("retires the crossfade ride, the simultaneous staged class and out-in", () => {
    // Neither the round-7 vertical ride, the round-9 simultaneous staged
    // class, nor the pre-0.55.38 Vue transition class grammar may sneak
    // back in, and no media block may fork step-body behaviour per
    // viewport.
    expect(tsx).not.toContain("hk-stepflow-fwd");
    expect(tsx).not.toContain("hk-stepflow-back");
    expect(tsx).not.toContain("hk-stepflow-enter-from");
    expect(src).not.toContain("hk-stepflow-fwd");
    expect(src).not.toContain("hk-stepflow-back");
    expect(src).not.toContain("hk-stepflow-enter-from");
    expect(src).not.toMatch(/@media[^{]*max-width/);
  });

  it("zeroes the transition under reduced motion so the probe settles", () => {
    expect(src).toMatch(
      /prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]{0,160}?\.hk-stepflow-body\s*\{\s*transition:\s*none/,
    );
  });
});
