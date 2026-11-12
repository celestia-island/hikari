/**
 * Contract for the surface live-blur ESCAPE HATCH (2026-11-12 chest field
 * report: "some dynamic UI content disappears and is clipped in place",
 * chronic in an Android System WebView shell, occasional on desktop at the
 * moment a screen capture forces a full-surface re-raster).
 *
 * Mechanism CLASS the hatch targets: `.hk-card` and `.hk-btn-secondary` each
 * carry a `backdrop-filter`, so each one needs its own background render
 * surface. That is pure cost with no visual gain whenever the layer beneath
 * is already an opaque surface (the card fill is 70%-alpha surface over the
 * sheet; the secondary button fill is the opaque surface token itself). The
 * reported artifact is an element's box surviving while its painted contents
 * go missing, which is what a starved surface budget looks like from the DOM
 * — so the hatch lets a HOST drop this pass on the engines where that class
 * shows up.
 *
 * Two invariants are pinned here, both load-bearing:
 *
 *   1. every such surface consumes `--hk-<surface>-blur` with the previous
 *      literal as its fallback, so no host loses the current look by
 *      upgrading hikari and a host can stand the pass down per ENGINE;
 *   2. the knob is DELIBERATELY NOT hangable off a width axis. The modal
 *      family's `-mobile` knobs default to none ≤767px; copying that shape
 *      here would re-key the stand-down to the viewport. The artifact follows
 *      the compositor: a phone WebView in "request desktop site" mode reports
 *      a ~980px layout viewport, a tablet reports a wide one, a desktop
 *      WebView2 host reports a desktop one — all three still run the starved
 *      engine, so a width gate would leave exactly those hosts exposed.
 *
 * Assertions run on the COMPILED sheet, never on source text: a stand-down
 * can be written as `@include backdrop-filter(none)`, as a literal
 * declaration, or through a variable, and only the compiled output sees all
 * three. The structural checks walk the compiled CSS with a token-aware
 * scanner (comments stripped, string literals skipped, brace depth tracked,
 * at-rule wrapper stack carried per rule), so a `}` inside `content: "}"`, a
 * `//` comment, an `@MEDIA` casing, a `@supports` wrapper, a selector list or
 * a `(width <= 767px)` range query all behave the way a browser would treat
 * them. Every guard carries a control that proves it can fail.
 */
import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "sass";

const here = dirname(fileURLToPath(import.meta.url));
const loadPaths = [here, join(here, "..", "styles")];

function compiledSheet(sheet: string): string {
  return compile(join(here, sheet), { loadPaths, style: "expanded" }).css;
}

/**
 * Strip `/* *\/` and `//` comments in ONE string-aware pass. A regex pass
 * cannot do this: `content: "//"` would be read as a line comment and then a
 * later `content: "/*"` as a block comment, silently swallowing the rest of
 * the sheet (a witnessed false-green).
 */
function stripComments(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const ch = css[i]!;
    if (ch === '"' || ch === "'") {
      const end = skipString(css, i);
      out += css.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end < 0 ? css.length : end + 2;
      continue;
    }
    if (ch === "/" && css[i + 1] === "/") {
      const end = css.indexOf("\n", i + 2);
      i = end < 0 ? css.length : end;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function skipString(src: string, at: number): number {
  const quote = src[at];
  for (let i = at + 1; i < src.length; i++) {
    if (src[i] === "\\") {
      i += 1;
      continue;
    }
    if (src[i] === quote) return i;
  }
  return src.length - 1;
}

interface CssRule {
  selector: string;
  declarations: string;
  /** At-rule preludes wrapping this rule, outermost first. */
  wrappers: string[];
  /** Index of the rule's selector in the scanned source. */
  start: number;
}

/** Walk a flat or nested stylesheet, tracking at-rule wrappers and strings. */
function scanRules(rawSrc: string): CssRule[] {
  const src = stripComments(rawSrc);
  const out: CssRule[] = [];

  const blockEnd = (open: number): number => {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      const ch = src[i]!;
      if (ch === '"' || ch === "'") {
        i = skipString(src, i);
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return src.length - 1;
  };

  const walk = (from: number, to: number, wrappers: string[]): void => {
    let i = from;
    let head = "";
    let headStart = from;
    while (i < to) {
      const ch = src[i]!;
      if (ch === '"' || ch === "'") {
        const end = skipString(src, i);
        head += src.slice(i, end + 1);
        i = end + 1;
        continue;
      }
      if (ch === "{") {
        const prelude = head.trim();
        const end = blockEnd(i);
        if (prelude.startsWith("@")) {
          walk(i + 1, end, [...wrappers, prelude]);
        } else {
          out.push({
            selector: prelude,
            declarations: src.slice(i + 1, end),
            wrappers,
            start: headStart,
          });
        }
        head = "";
        i = end + 1;
        headStart = i;
        continue;
      }
      if (ch === ";") {
        head = "";
        i += 1;
        headStart = i;
        continue;
      }
      if (head === "") headStart = i;
      head += ch;
      i += 1;
    }
  };

  walk(0, src.length, []);
  return out;
}

const TARGETS = [".hk-card", ".hk-btn-secondary"];
const KNOBS = ["--hk-card-blur", "--hk-btn-secondary-blur"];

/** Selector mentions a target as a whole token (list members included). */
function mentionsTarget(selector: string): string | null {
  for (const selectorPart of selector.split(",")) {
    const trimmed = selectorPart.trim();
    for (const target of TARGETS) {
      const re = new RegExp(`(^|[\\s>+~(])${target.replace(".", "\\.")}(?![\\w-])`);
      if (re.test(trimmed)) return target;
    }
  }
  return null;
}

/** Members of a (possibly multi-line, comma-separated) selector list. */
function selectorMembers(selector: string): string[] {
  return selector.split(",").map((part) => part.trim());
}

/**
 * Declaration map of the LAST unwrapped rule listing `selector` verbatim — the
 * one the cascade actually applies. Taking the first match would let a
 * duplicate base block below it decide the computed value while this file
 * inspects the harmless one.
 */
function baseDeclarations(css: string, selector: string): Map<string, string> {
  const rule = scanRules(css)
    .filter((r) => r.wrappers.length === 0 && selectorMembers(r.selector).includes(selector))
    .pop();
  expect(rule, `${selector} missing from the compiled sheet`).toBeDefined();
  const map = new Map<string, string>();
  for (const decl of rule!.declarations.split(";")) {
    const at = decl.indexOf(":");
    if (at < 0) continue;
    map.set(decl.slice(0, at).trim(), decl.slice(at + 1).trim());
  }
  return map;
}

/** A wrapper that re-keys the stand-down to anything other than the ENGINE.
 *  Structure, not substrings: a prelude is allowed only when EVERY comma-
 *  separated query is (a) a bare `print` / `speech` media type (optionally
 *  `only`-prefixed) or (b) a parenthesized list whose every feature is
 *  `prefers-*` joined by `and`. Everything else — media types like `screen`
 *  (de-facto unconditional), `not print`, a size/ratio/hover feature, a size
 *  feature ANDed with `prefers-*`, any @container prelude (container queries
 *  have no a11y features) — matches hosts by environment instead of by
 *  engine. Each of those shapes was a witnessed substring-whitelist bypass
 *  (`print, screen` / `not print` / `(max-width) and (prefers-*)` /
 *  `@container print (min-width)`).*/
function isConditionalWrapper(prelude: string): boolean {
  if (!/^@(media|container)\b/i.test(prelude)) return false;
  if (/^@container\b/i.test(prelude)) return true;
  for (const query of prelude.replace(/^@media\b/i, "").split(",")) {
    const q = query.trim();
    if (!q) continue;
    const features = q.match(/\([^)]*\)/g) ?? [];
    const residue = q.replace(/\([^)]*\)/g, "").trim();
    const bareType = features.length === 0 && /^(only\s+)?(print|speech)\b/i.test(q);
    const purePrefers =
      features.length > 0 &&
      features.every((f) => /prefers-/i.test(f)) &&
      (/^(and\s*)+$/i.test(residue) || residue === "");
    if (bareType || purePrefers) continue;
    return true;
  }
  return false;
}

const KNOB_RE = new RegExp(`(^|[\\s:;(])(${KNOBS.join("|")})\\s*:`, "m");

/** Every rule (anywhere, any wrapper) that declares one of the knobs. */
function knobPins(css: string): string[] {
  const hits: string[] = [];
  for (const rule of scanRules(css)) {
    for (const knob of KNOBS) {
      if (new RegExp(`(^|[\\s;])${knob}\\s*:`).test(rule.declarations)) {
        hits.push(`${rule.selector} pins ${knob}`);
      }
    }
  }
  return hits;
}

/**
 * Size-conditional stand-downs. A wrapped rule is a violation if it is inside
 * a SIZE wrapper and either names a target selector or sets a blur knob.
 * The second arm matters: the knob inherits, so
 * `@media (max-width: 767px) { :root { --hk-card-blur: none } }` re-keys the
 * stand-down for every card just as effectively as targeting one — and it is
 * the idiom the shipped consumer uses (`html[data-render] { --hk-card-blur }`).
 */
function conditionalStandDowns(css: string): string[] {
  const hits: string[] = [];
  for (const rule of scanRules(css)) {
    const condWrappers = rule.wrappers.filter(isConditionalWrapper);
    if (condWrappers.length === 0) continue;
    const target = mentionsTarget(rule.selector);
    const touchesFilter = /backdrop-filter/i.test(rule.declarations);
    const touchesKnob = KNOB_RE.test(rule.declarations);
    if (!target && !touchesKnob) continue;
    if (!touchesFilter && !touchesKnob) continue;
    hits.push(`${target ?? "knob"} inside ${condWrappers[condWrappers.length - 1]}`);
  }
  return hits;
}

describe("surface live-blur escape hatch", () => {
  it("leaves the knobs unpinned everywhere (upgrading hikari changes nothing)", () => {
    // Not just the base rule: an unconditional `:root { --hk-card-blur: none }`
    // would change every host on upgrade just as silently, so no rule in
    // either sheet may declare these tokens.
    for (const sheet of ["HkCard.scss", "HkButton.scss"]) {
      expect(knobPins(compiledSheet(sheet)), sheet).toEqual([]);
    }
  });

  it("knob-pin detector: control proving it can fail (any spelling, any scope)", () => {
    for (const shape of [
      ":root { --hk-card-blur: none; }", // unconditional ancestor pin
      ".hk-card { --hk-card-blur: none; }", // base-rule pin
      "@media (max-width: 767px) { :root { --hk-card-blur: none; } }", // scoped ancestor pin
    ]) {
      expect(knobPins(shape), shape).toHaveLength(1);
    }
  });

  it("reads the LAST matching base rule, so a duplicate cannot hide", () => {
    const css = [
      ".hk-card { backdrop-filter: var(--hk-card-blur, blur(var(--blur-md))); }",
      ".hk-card { backdrop-filter: blur(4px); }",
    ].join("\n");
    expect(baseDeclarations(css, ".hk-card").get("backdrop-filter")).toBe("blur(4px)");
  });

  it("routes the card blur through --hk-card-blur, keeping the old literal as the fallback", () => {
    const decls = baseDeclarations(compiledSheet("HkCard.scss"), ".hk-card");
    expect(decls.get("backdrop-filter")).toBe(
      "var(--hk-card-blur, blur(var(--blur-md)))",
    );
    // Separate property, so the assertion cannot be satisfied by the
    // prefixed twin alone (dropping the unprefixed line must stay red).
    expect(decls.get("-webkit-backdrop-filter")).toBe(
      "var(--hk-card-blur, blur(var(--blur-md)))",
    );
  });

  it("routes the secondary button blur through --hk-btn-secondary-blur", () => {
    const decls = baseDeclarations(compiledSheet("HkButton.scss"), ".hk-btn-secondary");
    expect(decls.get("backdrop-filter")).toBe(
      "var(--hk-btn-secondary-blur, blur(var(--blur-sm)))",
    );
    expect(decls.get("-webkit-backdrop-filter")).toBe(
      "var(--hk-btn-secondary-blur, blur(var(--blur-sm)))",
    );
  });

  it("flags every shape of conditional stand-down (positive controls)", () => {
    const shapes = [
      // declaration form, plain max-width
      "@media (max-width: 767px) { .hk-card { backdrop-filter: none; } }",
      // knob form (the shipped knob, re-keyed to the viewport)
      "@media (max-width: 767px) { .hk-card { --hk-card-blur: none; } }",
      // the same knob on an ANCESTOR — it inherits into every target
      "@media (max-width: 767px) { :root { --hk-card-blur: none; } }",
      // logical-size container axis and the WebKit resolution alias
      "@container (min-inline-size: 40em) { .hk-card { backdrop-filter: none; } }",
      "@media (-webkit-max-device-pixel-ratio: 2) { .hk-card { backdrop-filter: none; } }",
      // media TYPE / hover / monochrome re-key by environment, not engine
      "@media screen { .hk-card { backdrop-filter: none; } }",
      "@media (hover: none) { .hk-card { backdrop-filter: none; } }",
      "@media (min-monochrome: 0) { .hk-card { backdrop-filter: none; } }",
      // substring-whitelist bypasses: comma-OR, negation, size-AND-prefers,
      // a container NAME that happens to read like a media type
      "@media print, screen { .hk-card { backdrop-filter: none; } }",
      "@media not print { .hk-card { backdrop-filter: none; } }",
      "@media (max-width: 767px) and (prefers-reduced-transparency: no-preference) { .hk-card { backdrop-filter: none; } }",
      "@container print (min-width: 400px) { .hk-card { backdrop-filter: none; } }",
      // a `//` bait ahead of the gate must not white-wash it either
      '.x::after { content: "//"; } @media (max-width: 767px) { .hk-card { backdrop-filter: none; } }',
      // selector list
      "@media (max-width: 767px) { .hk-card, .x { backdrop-filter: none; } }",
      // range syntax
      "@media (width <= 767px) { .hk-card { backdrop-filter: none; } }",
      // min-width is just as wrong
      "@media (min-width: 768px) { .hk-btn-secondary { backdrop-filter: none; } }",
      // a container query re-keys by size just like a viewport query
      "@container (max-width: 767px) { .hk-card { backdrop-filter: none; } }",
      // aspect-ratio / resolution gates are viewport axes too
      "@media (max-aspect-ratio: 1/1) { .hk-card { backdrop-filter: none; } }",
      "@media (min-resolution: 2dppx) { .hk-card { backdrop-filter: none; } }",
      // at-rule casing is not significant in CSS
      "@MEDIA (max-width: 767px) { .hk-card { backdrop-filter: none; } }",
      // a brace inside a string literal must not end the block early
      '@media (max-width: 767px) { .x::after { content: "}"; } .hk-card { backdrop-filter: none; } }',
    ];
    for (const shape of shapes) {
      expect(conditionalStandDowns(shape), shape).toHaveLength(1);
    }
  });

  it("does not treat capability or accessibility gates as a width axis", () => {
    // `@supports`, `@layer`, `@media print` and `prefers-*` gates are not size
    // axes; a stand-down there is a deliberate capability decision, not the
    // viewport re-keying this guard forbids.
    for (const shape of [
      "@supports (backdrop-filter: blur(1px)) { .hk-card { backdrop-filter: none; } }",
      "@layer hk { .hk-card { backdrop-filter: none; } }",
      "@media print { .hk-card { backdrop-filter: none; } }",
      "@media speech { .hk-card { backdrop-filter: none; } }",
      "@media (prefers-reduced-transparency: reduce) { .hk-card { backdrop-filter: none; } }",
      "@media (prefers-reduced-contrast: more) and (prefers-reduced-transparency: reduce) { .hk-card { backdrop-filter: none; } }",
    ]) {
      expect(conditionalStandDowns(shape), shape).toEqual([]);
    }
  });

  it("keeps both surfaces engine-gated: no conditional stand-down exists today", () => {
    for (const sheet of ["HkCard.scss", "HkButton.scss"]) {
      expect(conditionalStandDowns(compiledSheet(sheet)), `${sheet}`).toEqual([]);
    }
  });

  it("scans real content: both base rules exist and the button sheet has wrappers", () => {
    // Non-vacuity for the guard above: the card sheet has no at-rules at all,
    // so prove the scanner reads a sheet that DOES have them, and prove the
    // base rules it looks for are really there.
    const cardCss = compiledSheet("HkCard.scss");
    const buttonCss = compiledSheet("HkButton.scss");
    const members = (css: string, sel: string) =>
      scanRules(css).filter((r) => selectorMembers(r.selector).includes(sel));
    expect(members(cardCss, ".hk-card").length).toBeGreaterThanOrEqual(1);
    expect(members(buttonCss, ".hk-btn-secondary").length).toBeGreaterThanOrEqual(1);
    expect(
      scanRules(buttonCss).filter((r) => r.wrappers.length > 0).length,
    ).toBeGreaterThan(0);
  });
});
