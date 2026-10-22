import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Descender-clipping contract for every hikari stylesheet.
 *
 * `text-overflow: ellipsis` is not a vertical safeguard: the same
 * `overflow: hidden` that truncates the line horizontally clips glyph ink to
 * the padding box, and that box is the LINE BOX. When the line box is shorter
 * than the font's ink box the bottom of every g/j/p/q/y is cut off flat —
 * reported twice by users (the chest header workspace pill, and the 'g' tail
 * of an admin-header nickname). `line-height: 1` is the classic way to build
 * that trap, because it is reached for as a centring fix inside a fixed-height
 * chip.
 *
 * The floor below is `line-height / font-size`. Descender depth is ~0.21em and
 * the tallest ink (accents, Han) needs another ~1.0-1.1em, so Latin stacks need
 * >= 1.10-1.15; the ceiling is set by the CJK fallbacks hikari supports
 * (`theme/fontContext` lets a host swap --font-sans, and YaHei / Noto Sans CJK
 * carry ascent+descent of 1.34-1.45em). 1.30 is the value that keeps a host
 * font swap from turning a clip box into a paper cut, and it still leaves room
 * for the deliberately tight designs (`--hk-menu-item-lh: 1.3`).
 *
 * A rule is only flagged when the clip and the too-small line box sit in the
 * SAME declaration block: that is the combination that actually cuts ink. An
 * inherited line-height from an ancestor is invisible here, which is why the
 * fix for a flagged rule is to declare a safe ratio on the clipping rule
 * itself rather than somewhere up the tree.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));
const stylesDir = resolve(componentDir, "../styles");

/** line-height / font-size below this clips descenders on some supported font. */
const SAFE_LINE_HEIGHT_RATIO = 1.3;

/**
 * Reviewed exemptions. Every entry must say why the ink cannot be text or why
 * the clip is intended — an unexplained entry is a bug, not a pass.
 */
const ALLOWED: ReadonlyArray<{ file: string; selector: string; why: string }> = [];

type Block = { file: string; selector: string; body: string; order: number };

/** Walk a compiled stylesheet, flattening at-rules into their inner blocks. */
function* blocksOf(css: string, file: string, prefix = "", order = { value: 0 }): Generator<Block> {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) return;
    const prelude = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (prelude.startsWith("@")) {
      yield* blocksOf(body, file, prefix, order);
    } else {
      yield { file, selector: prefix ? `${prefix} ${prelude}` : prelude, body, order: order.value++ };
    }
    i = j;
  }
}

function declaration(body: string, property: string): string | null {
  const match = body.match(new RegExp(`(?:^|;)\\s*${property}\\s*:([^;]+)`, "i"));
  return match ? match[1]!.trim() : null;
}

function clipsOverflow(body: string): boolean {
  return ["overflow", "overflow-x", "overflow-y"].some((property) => {
    const value = declaration(body, property);
    return value !== null && /\b(hidden|clip)\b/.test(value);
  });
}

function px(value: string | null): number | null {
  if (value === null) return null;
  const match = value.match(/^([\d.]+)px$/);
  return match ? Number(match[1]) : null;
}

function ratioOf(body: string): number | null {
  const lineHeight = declaration(body, "line-height");
  if (lineHeight === null) return null;
  const unitless = lineHeight.match(/^[\d.]+$/);
  if (unitless) return Number(lineHeight);
  const lineHeightPx = px(lineHeight);
  const fontSizePx = px(declaration(body, "font-size"));
  if (lineHeightPx !== null && fontSizePx !== null && fontSizePx > 0) {
    return lineHeightPx / fontSizePx;
  }
  return null;
}

function sheets(): string[] {
  const components = readdirSync(componentDir)
    .filter((name) => name.endsWith(".scss"))
    .map((name) => resolve(componentDir, name));
  const styles = readdirSync(stylesDir)
    .filter((name) => name.endsWith(".scss"))
    .map((name) => resolve(stylesDir, name));
  return [...components, ...styles];
}

/** The element a rule actually styles: the last compound of its selector. */
function subject(selector: string): string {
  const parts = selector.split(/\s+|>/).filter(Boolean);
  return parts[parts.length - 1] ?? selector;
}

/** Rough CSS specificity, enough to pick the rule that wins inside one sheet. */
function specificity(selector: string): number {
  return (selector.match(/[.#[\]]/g)?.length ?? 0) * 10 + (selector.match(/[a-z]+[a-z0-9-]*/gi)?.length ?? 0);
}

/**
 * Effective `line-height / font-size` for a clipping rule, resolving the
 * cascade *within the sheet*: the clip and the line box very often live in two
 * different blocks for the same element (the row-layout override adds
 * `overflow: hidden`, the base rule declares `line-height: 1`), which is why a
 * per-block scan sees nothing. Rules that declare no line-height are skipped —
 * the inherited value is `normal`, which cannot clip.
 */
function effectiveRatio(clip: Block, blocks: Block[]): number | null {
  const element = subject(clip.selector);
  const candidates = blocks
    .filter((block) => block.selector === clip.selector || subject(block.selector) === element)
    .map((block) => ({ block, ratio: ratioOf(block.body) }))
    .filter((entry): entry is { block: Block; ratio: number } => entry.ratio !== null);
  if (!candidates.length) return null;
  candidates.sort(
    (a, b) => specificity(b.block.selector) - specificity(a.block.selector) || b.block.order - a.block.order,
  );
  return candidates[0]!.ratio;
}

describe("stylesheet descender-clipping contract", () => {
  // Compiling ~130 stylesheets takes ~1s on a warm cache and several seconds on
  // a cold one; the default 5s budget turns a slow machine into a red suite.
  it("never pairs a clip box with a line box shorter than the ink box", { timeout: 60_000 }, () => {
    const findings: string[] = [];
    const allowed = new Set(ALLOWED.map((entry) => `${entry.file}|${entry.selector}`));
    const files = sheets();
    // The scan above only fails when it actually sees sheets; a moved/renamed
    // styles directory would otherwise make it pass over an empty input set.
    expect(files.length, "stylesheets discovered for the scan").toBeGreaterThan(100);
    let clipRulesSeen = 0;

    for (const file of files) {
      const name = file.slice(file.indexOf("/src/") + 1);
      // sass keeps `/* … */` comments in expanded output, and a comment that
      // *talks* about `overflow: hidden` or `line-height: 1` would otherwise be
      // parsed as a declaration (that bug made this guard pass while the very
      // clip it was written for was live).
      const css = compile(file, { style: "expanded", loadPaths: [componentDir, stylesDir] }).css.replace(
        /\/\*[\s\S]*?\*\//g,
        "",
      );
      const blocks = [...blocksOf(css, name)];
      for (const block of blocks) {
        if (!clipsOverflow(block.body)) continue;
        clipRulesSeen++;
        const ratio = effectiveRatio(block, blocks);
        if (ratio === null || ratio >= SAFE_LINE_HEIGHT_RATIO) continue;
        if (allowed.has(`${block.file}|${block.selector}`)) continue;
        findings.push(
          `${block.file} — ${block.selector} — clips overflow with an effective line-height ratio of ${ratio.toFixed(2)} (< ${SAFE_LINE_HEIGHT_RATIO}): the ink box of g/j/p/q/y is cut`,
        );
      }
    }

    expect(clipRulesSeen, "clip boxes discovered across the sheets").toBeGreaterThan(20);
    expect(findings.sort(), "clip boxes whose line box is too short for the font's ink").toEqual([]);
  });

  it("keeps the reviewed rules descender-safe", { timeout: 60_000 }, () => {
    // The generic scan above only inspects rules that declare `overflow`
    // themselves. These rules were fixed for the same class but carry no clip
    // in-tree — `.hk-gauge-ring-value` is centred inside the ring and gets its
    // clip from whatever host wrapper truncates — so a refactor that quietly
    // drops their ratio would pass the scan. Pin them by selector.
    const pinned: ReadonlyArray<{ file: string; selector: string; minRatio: number }> = [
      { file: "HkColorPicker.scss", selector: ".hk-color-picker-label", minRatio: 1.4 },
      { file: "HkStatCard.scss", selector: ".hk-stat-card-value", minRatio: 1.3 },
      { file: "HkGaugeRing.scss", selector: ".hk-gauge-ring-value", minRatio: 1.4 },
    ];

    const compiled = new Map<string, ReturnType<typeof compile>["css"]>();
    const found: string[] = [];
    for (const pin of pinned) {
      const file = resolve(componentDir, pin.file);
      if (!compiled.has(file)) {
        compiled.set(
          file,
          compile(file, { style: "expanded", loadPaths: [componentDir, stylesDir] }).css.replace(
            /\/\*[\s\S]*?\*\//g,
            "",
          ),
        );
      }
      const css = compiled.get(file)!;
      const block = [...blocksOf(css, pin.file)].find((entry) => entry.selector === pin.selector);
      if (!block) {
        found.push(`${pin.file} — ${pin.selector} — the pinned rule no longer exists`);
        continue;
      }
      const ratio = ratioOf(block.body);
      if (ratio === null) {
        found.push(`${pin.file} — ${pin.selector} — declares no line-height of its own any more`);
      } else if (ratio < pin.minRatio) {
        found.push(
          `${pin.file} — ${pin.selector} — line-height ratio ${ratio.toFixed(2)} fell below the reviewed floor ${pin.minRatio}`,
        );
      }
    }

    expect(found.sort(), "pinned descender-safe rules regressed").toEqual([]);
  });

  it("keeps the review list honest", () => {
    const unmatched = ALLOWED.filter((entry) => {
      const file = resolve(componentDir, "..", entry.file.replace(/^src\//, ""));
      return !readFileSync(file, "utf8").includes(entry.selector.split(" ").pop()!);
    }).map((entry) => `${entry.file} — ${entry.selector} (${entry.why})`);
    // A stale exemption hides a future regression: it must be deleted.
    expect(unmatched).toEqual([]);
  });
});

/**
 * Horizontal twin: the italic-overhang contract.
 *
 * The same `overflow: hidden` that clips descenders vertically also clips
 * ITALIC ink horizontally: synthetic-oblique strokes lean past the last
 * glyph's advance, the truncation box ends at the padding edge, and the
 * trailing stroke is shaved flat (reported from the field: wowsp's italic
 * all-clients sentinel row lost the right edge of its last glyph). The fix
 * is an inline-end cushion — clipping room INSIDE the padding box, which
 * never triggers the ellipsis for fitting text (HkAffixPicker's
 * `data-unset` rule is the in-tree precedent).
 *
 * The scan flags a truncation box (`overflow` clip + `text-overflow:
 * ellipsis` + `white-space: nowrap`, all three in one block) whose element
 * resolves to `font-style: italic` somewhere in the same sheet, unless an
 * inline-end cushion of >= 0.2em also resolves for it. The pinned list
 * below covers the boxes NO in-tree rule italicizes but hosts do — their
 * cushion must be unconditional, because host CSS is invisible here.
 */

/** Italic overhang floor: HkAffixPicker's shipped cushion, in em. */
const SAFE_ITALIC_CUSHION_EM = 0.2;

function truncates(body: string): boolean {
  return (
    clipsOverflow(body) &&
    declaration(body, "text-overflow") !== null &&
    /nowrap/i.test(declaration(body, "white-space") ?? "")
  );
}

/** The em figure inside a padding value, var() fallback included. */
function emCushion(value: string | null): number | null {
  if (value === null) return null;
  // The grammar label's compiled shape is a bare var() with no literal em
  // — its 0.2em value is pinned at the source level by
  // _menu-item.contract.test.ts, so the token counts as the floor it
  // contracts to.
  if (/--hk-menu-item-label-cushion/i.test(value)) return SAFE_ITALIC_CUSHION_EM;
  const match = value.match(/([\d.]+)em/i);
  return match ? Number(match[1]) : null;
}

/**
 * Winning declaration for one element across the sheet, resolving the
 * cascade exactly like `effectiveRatio` does (same-subject blocks, highest
 * specificity then latest order).
 */
function effectiveDecl(clip: Block, blocks: Block[], property: string): string | null {
  const element = subject(clip.selector);
  const candidates = blocks
    .filter((block) => block.selector === clip.selector || subject(block.selector) === element)
    .map((block) => ({ block, value: declaration(block.body, property) }))
    .filter((entry): entry is { block: Block; value: string } => entry.value !== null);
  if (!candidates.length) return null;
  candidates.sort(
    (a, b) => specificity(b.block.selector) - specificity(a.block.selector) || b.block.order - a.block.order,
  );
  return candidates[0]!.value;
}

describe("stylesheet italic-overhang contract", () => {
  it("never truncates an italic line without the overhang cushion", { timeout: 60_000 }, () => {
    const findings: string[] = [];
    for (const file of sheets()) {
      const name = file.slice(file.indexOf("/src/") + 1);
      const css = compile(file, { style: "expanded", loadPaths: [componentDir, stylesDir] }).css.replace(
        /\/\*[\s\S]*?\*\//g,
        "",
      );
      const blocks = [...blocksOf(css, name)];
      for (const block of blocks) {
        if (!truncates(block.body)) continue;
        if (!/^italic$/i.test(effectiveDecl(block, blocks, "font-style") ?? "")) continue;
        // Either longhand satisfies the contract — centered boxes ship the
        // symmetric `padding-inline` shorthand instead.
        const cushion =
          emCushion(effectiveDecl(block, blocks, "padding-inline-end")) ??
          emCushion(effectiveDecl(block, blocks, "padding-inline"));
        if (cushion !== null && cushion >= SAFE_ITALIC_CUSHION_EM) continue;
        findings.push(
          `${block.file} — ${block.selector} — truncates a line that resolves to italic without a >= ${SAFE_ITALIC_CUSHION_EM}em inline-end cushion: the trailing stroke is shaved`,
        );
      }
    }
    expect(findings.sort(), "italic truncation boxes missing the overhang cushion").toEqual([]);
  });

  it("keeps the host-italic-exposed truncation boxes cushioned", { timeout: 60_000 }, () => {
    // Host CSS italicizes trigger values from OUTSIDE any hikari block,
    // so no in-tree italic backs these — the scan above cannot see the
    // risk and the cushion must be pinned unconditionally instead.
    const pinned: ReadonlyArray<{ file: string; selector: string; property: string }> = [
      { file: "HkSelect.scss", selector: ".hk-select-value", property: "padding-inline" },
      { file: "HkPopupSelect.scss", selector: ".hk-popup-select-value", property: "padding-inline" },
      // The original precedent this contract generalizes: its italic lives
      // on the [data-unset] subject while the truncation trio sits on the
      // base rule — a shape the scan's subject pairing cannot see, so the
      // shipped cushion is pinned instead.
      { file: "HkAffixPicker.scss", selector: ".hk-affix-tag-text[data-unset]", property: "padding-inline-end" },
    ];
    const compiled = new Map<string, ReturnType<typeof compile>["css"]>();
    const found: string[] = [];
    for (const pin of pinned) {
      const file = resolve(componentDir, pin.file);
      if (!compiled.has(file)) {
        compiled.set(
          file,
          compile(file, { style: "expanded", loadPaths: [componentDir, stylesDir] }).css.replace(
            /\/\*[\s\S]*?\*\//g,
            "",
          ),
        );
      }
      const block = [...blocksOf(compiled.get(file)!, pin.file)].find(
        (entry) => entry.selector === pin.selector,
      );
      if (!block) {
        found.push(`${pin.file} — ${pin.selector} — the pinned rule no longer exists`);
        continue;
      }
      const cushion = emCushion(declaration(block.body, pin.property));
      if (cushion === null || cushion < SAFE_ITALIC_CUSHION_EM) {
        found.push(
          `${pin.file} — ${pin.selector} — lost its ${SAFE_ITALIC_CUSHION_EM}em italic overhang cushion`,
        );
      }
    }
    expect(found.sort(), "pinned italic-cushioned truncation boxes regressed").toEqual([]);
  });
});
