/**
 * Source contract: the emergency takeover is a document-space top
 * owner with TWO legs (the same contract HkModal rides, pinned by
 * chromeBand.contract tests on the chest side):
 *
 *  1. z leg — `var(--hk-z-emergency, 96000)` sits above the error
 *     landing (95000) and strictly below the window titlebar
 *     (100001): the band demands attention but must NEVER cover the
 *     titlebar (user direction 2026-11-13).
 *  2. geometry leg — the layer insets below the host chrome band via
 *     `var(--hk-chrome-band-inset, 0px)` so a native shell's titlebar
 *     strip stays visible, draggable and clickable.
 *
 * Plus the width and blocking doctrines: the band spans edge to edge
 * (no viewport gutter — user direction 2026-11-13) and the layer
 * itself is pointer-transparent (only the band intercepts), so the
 * emergency never blocks work happening underneath.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function sheet(): string {
  const raw = readFileSync(join(here, "HkEmergencyAlert.scss"), "utf-8");
  // Comments are stripped before ANY assertion (the registerAnimations
  // parity convention): a commented-out declaration is not a
  // declaration. Block comments first (a leftover `/* scrim */` fed
  // the dark-ink pin — R4), then // comments ANYWHERE on a line —
  // trailing `position: relative; // --hk-emergency-scrim: …` fed the
  // pins with the real declaration gone (R7). The whitespace anchor
  // keeps `https://` inside a value alive.
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

/** EVERY `.hk-emergency { … }` root rule, brace-balanced (each may
 *  nest the webkit scrollbar rule). Assertions about the LAYER must
 *  bind to these blocks — the band's pseudo-elements carry their own
 *  `pointer-events: none` lines (R3 M6), and a SECOND root block later
 *  in the sheet silently overrides the first (R7's white-scrim append),
 *  so the tests below also require the collection to hold exactly one.
 *  Comment-blindness is handled upstream in sheet(); braces inside
 *  comments are gone before the walk runs. */
function rootBlocks(css: string): string[] {
  const marker = ".hk-emergency {";
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(marker, from);
    if (start < 0) break;
    let depth = 0;
    let end = -1;
    for (let i = start; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end < 0) throw new Error("unbalanced braces in a .hk-emergency root rule");
    blocks.push(css.slice(start, end));
    from = end;
  }
  return blocks;
}

/** The single root rule, or a thrown failure naming the drift. */
function rootBlock(css: string): string {
  const blocks = rootBlocks(css);
  if (blocks.length !== 1) {
    throw new Error(`expected exactly one .hk-emergency root rule, found ${blocks.length}`);
  }
  return blocks[0];
}

describe("emergency alert layering contract", () => {
  it("pins the document-space z band between error landing and titlebar", () => {
    const css = sheet();
    expect(css).toContain("z-index: var(--hk-z-emergency, 96000);");
  });

  it("pins the chrome-band geometry leg on the top edge", () => {
    const css = sheet();
    expect(css).toContain("inset: var(--hk-chrome-band-inset, 0px) 0 0 0;");
  });

  it("the band spans the full width — no viewport gutter on it", () => {
    const css = sheet();
    // The band (not the reading column) is width:100%…
    expect(css).toContain("width: 100%;");
    // …and the sheet never insets the band from the screen edges.
    expect(css).not.toMatch(/inset-inline-(start|end):\s*var\(--viewport-gutter/);
  });

  it("the layer is pointer-transparent; only the band is interactive", () => {
    const css = sheet();
    // Root rule: transparent (the scrim never blocks work) — bound to
    // the ROOT block because the band pseudo-elements also carry
    // pointer-events:none lines that would mask its deletion (M6).
    expect(rootBlock(css)).toContain("pointer-events: none;");
    expect(rootBlock(css)).not.toContain("pointer-events: auto;");
    // …and exactly ONE rule in the whole sheet opts back in — the band.
    expect(css.match(/pointer-events:\s*auto;/g)?.length).toBe(1);
  });

  it("the scrim stays dark ink — never a mode-inverting background token", () => {
    // 0.55.370 pointed the scrim at --color-background: a WHITE veil in
    // light themes, so the page never darkened and the takeover read
    // as a pastel banner (2026-11-14 field report). Darkening is what
    // a scrim does, in every mode — pin the ink and ban the inversion
    // vector outright (R3 M1 replayed the bug with every test green).
    const css = sheet();
    // A second root block would silently override the first (R7).
    expect(rootBlocks(css)).toHaveLength(1);
    const root = rootBlock(css);
    expect(root).not.toContain("var(--color-background");
    // Dark-ink DIRECTION, not a literal: every RGB channel must be
    // dark (<60) and the veil substantial (alpha >= 40%). A future
    // retune (55%→52%, 12 14 20 etc.) passes; a light recolor
    // (200 210 220) fails on semantics, not on mismatched text.
    // EXACTLY ONE declaration per property, counted by NAME in any
    // value form: a later duplicate wins the cascade silently, so a
    // first-match-is-dark pin let `white` / var() forms slip past
    // (R5's rgb probe; R6's white/var probes). Counting the name also
    // guards the wash the same way (R6: an old tone-form wash could be
    // appended under a correct color-mix line).
    expect(root.match(/--hk-emergency-scrim\s*:/g)?.length, "exactly one --hk-emergency-scrim declaration").toBe(1);
    // The one declaration must be a LITERAL dark rgb ink (darkening is
    // mode-independent; symbolic or token forms may invert in light
    // themes — the 0.55.370 bug).
    const scrim = root.match(/--hk-emergency-scrim:\s*rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*(\d+)%\s*\);/);
    expect(scrim, "the scrim must be a literal rgb(…) dark ink").not.toBeNull();
    const [, r, g, b, a] = scrim!.map(Number) as unknown as number[];
    expect(Math.max(r, g, b)).toBeLessThan(60);
    expect(a).toBeGreaterThanOrEqual(40);
    // Wash: exactly one, and it derives from the LINE (the theme's
    // authoritative signal color) — R2's derivation-mismatch finding.
    expect(root.match(/--hk-emergency-wash\s*:/g)?.length, "exactly one --hk-emergency-wash declaration").toBe(1);
    expect(root).toMatch(/--hk-emergency-wash:\s*color-mix\(in srgb, var\(--hk-emergency-line\)/);
  });

  it("the warning action is a caution chip in the band's own ink", () => {
    // The chip replaces the brand-primary blue: tone wash fill, tone
    // border — and the TEXT follows the theme text ink (NOT
    // --color-on-warning, whose dark ink only works on a solid tone
    // surface; the chip sits on the theme band in both modes). The
    // doctrine chain (line/wash, never solid fill) is what R2's
    // rejected fill form got wrong.
    const css = sheet();
    rootBlock(css);
    // EXACTLY ONE chip rule, counted by name in any value form — a
    // later duplicate would win the cascade silently (the R7
    // multi-root vector, at chip granularity).
    expect(css.match(/\.is-warning \.hk-emergency-actions \.hk-btn-primary\s*{/g)?.length).toBe(1);
    const chip = css.match(
      /\.is-warning \.hk-emergency-actions \.hk-btn-primary\s*{([^}]*)}/,
    );
    expect(chip, "the warning chip rule must exist").not.toBeNull();
    expect(chip![1]).toContain("background: var(--hk-emergency-wash);");
    expect(chip![1]).toContain("border-color: var(--hk-emergency-line);");
    expect(chip![1]).toContain("color: rgb(var(--color-text");
    expect(chip![1]).not.toContain("--color-on-warning");
  });

  it("long content stays reachable: the layer scrolls and the band safe-centers", () => {
    // A fixed full-height layer never grows the document, so clipped
    // content would strand the actions forever (R2 finding 5). The
    // layer must scroll, and the band must center via margin-block
    // (align-items:center on the LAYER clips both ends with no way
    // back; the icon/actions rows may still center their own content).
    const css = sheet();
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("margin-block: auto;");
    expect(css).not.toMatch(/\.hk-emergency\s*\{[^}]*align-items\s*:/s);
  });
});
