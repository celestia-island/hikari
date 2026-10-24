import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = here;

/**
 * Pane-swap contract — the enforcement half of the family's transition
 * primitives (user audit 2026-10-23).
 *
 * THE DECISION TABLE (which surface for which class of slot):
 *
 *   ┌──────────────────────────────┬───────────────────────────────┐
 *   │ the content can UNMOUNT      │ HkTransitionContainer (frame │
 *   │ when it leaves the stage     │ must morph) / HkCrossfade    │
 *   │                              │ (same-box dissolve)          │
 *   ├──────────────────────────────┼───────────────────────────────┤
 *   │ the instance must SURVIVE    │ HkPaneHolder (draft stores,  │
 *   │ (draft store, canvas, sock)  │ canvases, sockets)           │
 *   ├──────────────────────────────┼───────────────────────────────┤
 *   │ a WIZARD STEPPER inside a    │ HkStepFlow — see its exception│
 *   │ modal sheet                  │ below; it is a sibling with a │
 *   │                              │ different contract, not a    │
 *   │                              │ rogue pane slot              │
 *   └──────────────────────────────┴───────────────────────────────┘
 *
 * THE RULE. A "pane slot" is a container whose visible content is selected
 * by a state key while the container stays put: tabs, settings sections,
 * step bodies, view areas. Every such slot must swap through the standard
 * mechanism — `HkTransitionContainer` (frame morph + dissolve) or
 * `HkCrossfade` (same-box dissolve) — or a component that composes them
 * (`HkTabs` panels). The library shipped both primitives and then used
 * them in exactly ONE place, so the rule was advisory: each surface
 * re-decided, and two page-scale slots hard-cut while a third
 * re-implemented the primitives by hand.
 *
 * HOW IT IS ENFORCED. Two source scans, because the violation is only
 * visible in source (the primitives are leaf components; the call site
 * cannot tell you a div is a page slot):
 *
 *  1. every `slots[<state>]?.()` pane render must be either routed through
 *     HkTransitionContainer/HkCrossfade, or listed below with a reason —
 *     an explicit-exception list, not a ban;
 *  2. every pane-vocabulary `@keyframes` (names carrying pane/swap/
 *     crossfade/morph/sheet vocabulary) must be allow-listed with a
 *     reason, so new bespoke swap animations cannot slip in.
 *
 * ALLOW-LIST DISCIPLINE. Each entry states WHY the standard cannot carry
 * it. Nothing is grandfathered silently; a new entry needs a reason that
 * would survive review.
 */

/** Components whose slot render is a pane swap and MUST stay on the
 *  standard mechanism — pinned positively so a refactor cannot quietly
 *  drop back to a hard cut. */
const STANDARD_PANE_HOSTS: Array<{ file: string; marker: string; why: string }> = [
  {
    file: "HkTabs.tsx",
    marker: "<HkTransitionContainer",
    why: "tab panels are the canonical pane slot",
  },
  {
    file: "HkSettingsDialog.tsx",
    marker: "<HkTransitionContainer",
    why: "settings sections are a page-scale pane slot (migrated 2026-10-23)",
  },
  {
    file: "HkAdminTablePage.tsx",
    marker: "<HkCrossfade",
    why: "the error/placeholder/content body is a page slot every admin table page inherits (2026-10-24)",
  },
];

/** Justified bespoke mechanisms: "<scss file>: <animation identifier>" → reason. */
const SANCTIONED_SWAP_KEYFRAMES: Record<string, string> = {
  "HkPickerPane.scss: hk-picker-pane-fwd-in": "fixed-stage picker with a direction axis; the stage size is known, so the measured morph container does not apply",
  "HkPickerPane.scss: hk-picker-pane-fwd-out": "fixed-stage picker with a direction axis (see above)",
  "HkPickerPane.scss: hk-picker-pane-back-in": "fixed-stage picker with a direction axis (see above)",
  "HkPickerPane.scss: hk-picker-pane-back-out": "fixed-stage picker with a direction axis (see above)",
  "HkModalBreadcrumb.scss: hk-modal-breadcrumb-in": "breadcrumb level change — a text strip, not a pane",
};

/** Swap-vocabulary keyframe names: anything that reads as a pane-swap
 *  animation must be argued, decorative pulses and spinners do not. */
const SWAP_VOCABULARY = /(pane|swap|crossfade|morph|sheet)/;

/** The primitives' own stylesheets ARE the sanctioned mechanism — their
 *  keyframes are the family language itself, not bespoke swaps. */
const PRIMITIVE_SHEETS = new Set([
  "HkCrossfade.scss",
  "HkTransitionContainer.scss",
  "HkPaneHolder.scss",
]);

function readComponent(file: string): string {
  return readFileSync(join(componentsDir, file), "utf-8");
}

function scssFiles(): string[] {
  return readdirSync(componentsDir).filter((f) => f.endsWith(".scss"));
}

describe("pane-swap contract", () => {
  it("keeps the known pane slots on the standard mechanism", () => {
    for (const host of STANDARD_PANE_HOSTS) {
      const src = readComponent(host.file);
      expect(
        src,
        `${host.file} must swap through the standard pane mechanism (${host.why})`,
      ).toContain(host.marker);
    }
  });

  it("every keyed slot render is either standard or explicitly excepted", () => {
    // `slots[active()]?.()`-style renders: the pattern a pane slot uses.
    const slotRenders: Array<{ file: string; line: string }> = [];
    for (const file of readdirSync(componentsDir).filter((f) => f.endsWith(".tsx"))) {
      const text = readComponent(file);
      for (const line of text.split("\n")) {
        if (/slots\[[^\]]+\]\?\.\(\)/.test(line)) slotRenders.push({ file, line: line.trim() });
      }
    }
    const EXCEPTIONS = new Set([
      // These are hosts that MUST render their slot keyed by state — they
      // are exactly the pane slots the rule is about, and each is either
      // wrapped by the standard above or justified here.
      "HkTabs.tsx", // wrapped by HkTransitionContainer (pinned above)
      "HkSettingsDialog.tsx", // wrapped by HkTransitionContainer (pinned above)
      // HkStepFlow is NOT a rogue pane slot — it is a sibling mechanism
      // with a contract the generic primitives deliberately do not
      // offer (2026-10-24 deep-dive ruling; do not re-litigate without
      // reading this):
      //  1. SEQUENTIAL two-window choreography (slide with the hosting
      //     sheet's height FROZEN, then the morph plays ALONE) — the
      //     inversion of HkTransitionContainer's concurrent morph, born
      //     from the 2026-09-23 round-16 user directive after the
      //     concurrent form overloaded phone GPU raster threads
      //     (whole-region black flashes no layering fix absorbed).
      //  2. A direction axis (translateX travel + RTL mirroring) that
      //     HkCrossfade's contract forbids — its tests pin
      //     opacity-only, no transform, ever.
      //  3. The hk-stepflow-swap sheet protocol: HkModal freezes its
      //     height pin on "swap", safety-unfreezes (ms+650), and
      //     height-morphs alone on "morph".
      //  4. Six round-numbered field incidents live in its logic:
      //     r16 align-self:start (grid stretch zeroed every shrink's
      //     delta), r17 near-instant clip sweep (moving clip edges
      //     re-raster per frame), r18 announce-AFTER-patch (a shrink
      //     read the leaving body's geometry and no-opped), r22
      //     Android-autofill strobe (dropFlowFocus before the swap),
      //     r24 sticky-pin vs modal gutter-cover layering, and
      //     preemptSwap keeping whichever body is actually visible
      //     (opacity > 0.05) when interrupted mid-slide.
      // Merging any of this into the generic container would change its
      // semantics for every existing call site. Permanent exception.
      "HkStepFlow.tsx",
      "HkAdminShell.tsx", // content slot is host-owned; hosts key it (chest wraps HkCrossfade)
      "HkThemePanelContent.tsx", // forwards to HTabs (HkTabs), inherits the mechanism
      "HkMenuPanel.tsx", // menu items, not a pane swap
      // Named slots that are not pane swaps at all: a header action strip
      // (always-on actions, not a keyed slot) and a table page's modal /
      // empty-action hooks (modals own their own enter/leave motion).
      "HkAdminHeader.tsx",
      "HkAdminTablePage.tsx",
    ]);
    const unexplained = slotRenders.filter((r) => !EXCEPTIONS.has(r.file));
    expect(
      unexplained.map((r) => `${r.file}: ${r.line}`),
      "A keyed slot render appeared outside the standard mechanism. Route it through HkTransitionContainer/HkCrossfade, or add a reasoned exception.",
    ).toEqual([]);
  });

  it("has no unsanctioned swap-vocabulary keyframes", () => {
    const offenders: string[] = [];
    for (const file of scssFiles()) {
      const text = readFileSync(join(componentsDir, file), "utf-8");
      for (const match of text.matchAll(/@keyframes\s+([\w-]+)/g)) {
        const name = match[1];
        if (!SWAP_VOCABULARY.test(name)) continue;
        if (PRIMITIVE_SHEETS.has(file)) continue;
        const key = `${file}: ${name}`;
        if (!SANCTIONED_SWAP_KEYFRAMES[key]) offenders.push(`@keyframes ${key}`);
      }
    }
    expect(
      offenders,
      "A bespoke pane-swap animation appeared. Use the standard primitives, or add a reasoned allow-list entry.",
    ).toEqual([]);
  });

  it("allow-list entries reference real keyframes (no stale exceptions)", () => {
    const present = new Set<string>();
    for (const file of scssFiles()) {
      const text = readFileSync(join(componentsDir, file), "utf-8");
      for (const match of text.matchAll(/@keyframes\s+([\w-]+)/g)) {
        present.add(`${file}: ${match[1]}`);
      }
    }
    const stale = Object.keys(SANCTIONED_SWAP_KEYFRAMES).filter((k) => !present.has(k));
    expect(stale, "Remove allow-list entries whose keyframe is gone.").toEqual([]);
  });
});
