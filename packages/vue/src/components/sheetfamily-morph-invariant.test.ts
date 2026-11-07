/**
 * Source contract tying the sheet family's morph flag to its transition
 * grammar (2026-11-07 residue sweep, the mechanical context the flag never
 * had): `--hk-sheet-morph: clip` is read by useSizeMorph through
 * getComputedStyle, while the transition LIST that actually animates the
 * sweep is owned by these stylesheets — no other mechanism ties the two
 * together, which is how dead legs survived five choreography generations.
 * Pinned here:
 *   - a rule that sets the flag MUST carry a clip-path transition leg
 *     (otherwise the sweep composites unanimated / watchdog-landed);
 *   - a clip-mode rule must NOT carry height/max-height legs (in clip
 *     mode the morph pins instantly and folds transition-off, so those
 *     legs are dead — and a live max-height leg on a dvh-capped sheet is
 *     the IME cap-chase the modal block fixed on 2026-09-21);
 *   - the flagged-rule set is pinned exactly, so a new flagged surface
 *     opts in here consciously and inherits the grammar.
 * Provenance: HkModal's base list trimmed in #1158; HkSelect's panel
 * aligned in the same wave (inference-level evidence for the IME fix —
 * same engine class as the modal's 2026-09-21 Xiaomi reports, no field
 * report yet).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string): string => readFileSync(join(here, name), "utf-8");

const FAMILY_SHEETS = ["HkModal.scss", "HkSelect.scss"] as const;

/** The exact set of rules allowed to flag clip mode: selector text as it
 *  appears in the sheet, keyed per file. A new flagged surface must add
 *  itself here (and inherit the clip-only grammar consciously). */
const EXPECTED_FLAGGED_RULES: Record<string, readonly string[]> = {
  "HkModal.scss": [".hk-modal-content"],
  "HkSelect.scss": [".hk-select-sheet-panel"],
};

/** Walk the source and return every rule block that sets
 *  `--hk-sheet-morph: clip`, as {selector, body} — brace-matched so the
 *  modal's media-nested block extracts whole. */
function flaggedRules(source: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const flag = /--hk-sheet-morph:[ \t]*clip[ \t]*;/g;
  for (const match of source.matchAll(flag)) {
    const open = source.lastIndexOf("{", match.index);
    if (open < 0) continue;
    // Selector text: everything after the previous structural close
    // (}; or }) up to the opening brace.
    const prevClose = Math.max(
      source.lastIndexOf("}", open),
      source.lastIndexOf(";", open),
    );
    const selector = source
      .slice(prevClose + 1, open)
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Forward-match braces to the block's own close.
    let depth = 0;
    let end = -1;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    expect(end, `unbalanced braces after flag at offset ${match.index}`).toBeGreaterThan(0);
    out.push({ selector, body: source.slice(open + 1, end) });
  }
  return out;
}

/** The block's own transition declaration (multi-line shorthands joined). */
function transitionOf(block: string): string {
  const match = block.match(/transition:[^;]+;/);
  return match?.[0]?.replace(/\s+/g, " ").trim() ?? "";
}

describe("sheet family morph-flag ↔ transition-grammar contract", () => {
  it("flags exactly the expected rules across the family", () => {
    for (const sheet of FAMILY_SHEETS) {
      const found = flaggedRules(read(sheet)).map((r) => r.selector).sort();
      const expected = [...EXPECTED_FLAGGED_RULES[sheet]].sort();
      expect(found, `${sheet} flagged rules`).toEqual(expected);
    }
  });

  it("every flagged rule carries a clip-path leg and no dead height/max-height legs", () => {
    for (const sheet of FAMILY_SHEETS) {
      for (const rule of flaggedRules(read(sheet))) {
        const tr = transitionOf(rule.body);
        expect(tr, `${sheet} ${rule.selector} has a transition`).toContain("clip-path");
        expect(tr, `${sheet} ${rule.selector} height leg is dead in clip mode`).not.toMatch(
          /\bheight\b/,
        );
        expect(
          tr,
          `${sheet} ${rule.selector} max-height leg is dead in clip mode (IME cap-chase)`,
        ).not.toMatch(/\bmax-height\b/);
      }
    }
  });

  it("no un-flagged family rule animates a clip-path sweep", () => {
    // The dead-leg shape this sweep retired: a clip-path transition leg on
    // a surface the flag never arms. Scoped to the family sheets; other
    // components may animate clip-path for their own reasons.
    for (const sheet of FAMILY_SHEETS) {
      const source = read(sheet);
      const flagged = flaggedRules(source);
      for (const match of source.matchAll(/transition:[^;]*\bclip-path\b[^;]*;/g)) {
        const open = source.lastIndexOf("{", match.index);
        const prevClose = Math.max(
          source.lastIndexOf("}", open),
          source.lastIndexOf(";", open),
        );
        const selector = source
          .slice(prevClose + 1, open)
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const isFlaggedRule = flagged.some((r) => r.selector === selector);
        expect(
          isFlaggedRule,
          `${sheet} ${selector} animates clip-path without --hk-sheet-morph: clip`,
        ).toBe(true);
      }
    }
  });
});
