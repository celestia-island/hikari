import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

import { compileString } from "sass";
import { describe, expect, it } from "vitest";

import {
  HK_AUTH_CARD_MAX_WIDTH,
  HK_AUTH_CARD_MAX_WIDTH_VAR,
} from "../theme/authCard";

/**
 * Auth card width contract guard — the "why" lives in theme/authCard.ts.
 *
 * The auth sheets resolve ONE custom property whose fallback is the same
 * literal the published constant carries (SCSS cannot read a TS constant, so
 * the two are kept equal by THIS test). That is what makes the width
 * changeable from a single place: a host shell that caps its own layout slot
 * to the card — e.g. shittim-chest's auth crossfade hosts, which mirror the
 * width inline after shittim-chest#891 — can override the property and both
 * sides move together. A literal left behind in an auth block, a second
 * declaration inside a guarded block, or a fallback drifting away from the
 * constant brings back the failure this contract exists to prevent: a slot
 * wider than the card renders a max-width card flush left instead of centred.
 *
 * The assertions run on the COMPILED sheet, not on the source text: sass
 * flattens nesting, so a width declared inside `@media` or under a parent
 * selector becomes a rule of its own and can no longer hide from a
 * source-text scan (an earlier version of this guard walked top-level blocks
 * only and stayed green while a media-query override defeated every host
 * override — verified with a real browser). Comments are stripped from the
 * compiled output so a commented-out declaration cannot fire an assertion.
 *
 * A card rule is recognised by its SUBJECT — the rightmost compound of a
 * selector, the element the declarations land on — carrying the card's own
 * class token (< 0.54.5 matched the whole selector text, so `:is(.s-auth-card)`,
 * `[class~="s-auth-card"]` and `.s-auth-shell .s-auth-card` slipped past with a
 * fixed `inline-size`). Both spellings count, attribute names are case-folded by
 * HTML and an `i` flag folds the value too. Statement at-rules
 * (`@charset "UTF-8";`, `@layer base, components;`) are dropped before parsing:
 * otherwise the leftover text is glued onto the next selector, which hid a rule
 * from the card checks and flagged a correct sheet as an offender.
 *
 * Scope notes (deliberately narrow, fail-closed):
 *  - the scan starts at `index.scss`, the package's style entrypoint, so a cap
 *    added to any partial this entrypoint pulls in is in reach (a sheet that is
 *    never composed in stays out — no other sheet declares `.s-auth-card*`);
 *  - stylesheet-level escapes stay out: `@scope`/positional selectors
 *    (`@scope (.s-auth-card) { :scope { … } }`, `.hk-auth-shell > *`) name their
 *    target without the class, a `!important` SCSS override or `.s-auth-card`
 *    variant declared by a host is beyond a static scan, and jsdom has no
 *    layout engine. A subject that is ONLY a functional pseudo-class is the
 *    same kind of limit: the guard reads the class names its arguments mention,
 *    so `:not(.s-auth-card)`, `:has(.s-auth-card)` and
 *    `:not(.s-auth-card--wide)` count as card-relevant (fail-closed — the first
 *    cannot select the card but does select the measuring wrapper, which costs a
 *    false red, and the last is a true positive because that subject DOES match
 *    the bare card), while a pseudo naming any other class (`:not(.foo)`,
 *    `:has(.foo)`) is not card-relevant and a rule naming no auth class at all
 *    is outside this scan: a bare `:not(.foo) { width: 50% }` in an auth sheet is
 *    therefore NOT caught — that needs a selector engine over the DOM, i.e. a
 *    real-browser check;
 *  - two further fail-closed costs, neither chased here: `!important` on an
 *    otherwise correct declaration is read as part of its value (reported), and
 *    a backslash escape inside a class name is read as the class before it
 *    (`s-auth-card\,x` counts as the card);
 *  - logical block properties (`block-size`, `min-block-size`) and
 *    `aspect-ratio` are left to the layout review;
 *  - the positive controls want each surface capped AND sized once: a second,
 *    identical cap or `width: 100%` is reported rather than tolerated
 *    (fail-closed — harmless today, but it is how a duplicate drifts out of
 *    sync tomorrow);
 *  - the "no other auth rule caps a width" contract is deliberately wider than
 *    the card: it fires on ANY `.s-auth-*` rule carrying a cap, because a third
 *    auth surface declared tomorrow is exactly what it exists to catch;
 *  - Sass indirection is judged by what it COMPILES to: a `@extend`ed
 *    placeholder is fine while it carries the property, and fails once it
 *    compiles back into a literal — which is the behaviour we want, since the
 *    browser only ever sees the compiled sheet.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
/** The sheet ENTRYPOINT: compiling it pulls in every partial the styles ship
 *  (an override living in a later `@use`d sheet is part of the contract too). */
const sheetPath = resolve(stylesDir, "index.scss");
const sheetSource = readFileSync(sheetPath, "utf8");

/** Drop comments and blank the CONTENTS of quoted strings and of `url()`
 *  payloads, in ONE left-to-right pass so none of them can confuse the others:
 *  CSS values really do carry braces (`content: "{"`, a `data:image/svg+xml,…{}`
 *  URI — and an UNQUOTED `url(data:…{})` is equally legal) and a brace inside
 *  one otherwise ended the rule early, hiding the declarations after it (a
 *  `max-width: 40rem` past a `content: "}"` escaped). Conversely an apostrophe
 *  in a comment — "the card's own sizing contract" — used to open a phantom
 *  string that swallowed the next rule whole. Strings stop at a newline, which
 *  CSS forbids inside them, so an unterminated quote cannot run past its own
 *  rule. The unquoted `url()` arm honours backslash escapes, because a `url()`
 *  may legally carry `\)` — stopping at the escaped paren would leave the
 *  braces after it loose in the declaration (a real-parser differential found
 *  exactly that hole). */
function maskStringsAndComments(css: string): string {
  return css.replace(
    /\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|url\(\s*"(?:[^"\\\n]|\\.)*"\s*\)|url\(\s*'(?:[^'\\\n]|\\.)*'\s*\)|url\((?:[^)\\\n]|\\.)*\)/gi,
    (m) => {
      if (m.startsWith("/*")) return "";
      if (/^url\(/i.test(m)) {
        return `url(${"x".repeat(Math.max(0, m.length - 5))})`;
      }
      return m.length < 2
        ? m
        : `${m[0]}${"x".repeat(m.length - 2)}${m[m.length - 1]}`;
    },
  );
}

const compiled = maskStringsAndComments(
  // `url` gives the sheet its own directory as the base for `@use`/`@import`,
  // the same resolution the `sass` CLI applies when given the file path.
  compileString(sheetSource, {
    style: "expanded",
    url: pathToFileURL(sheetPath),
    loadPaths: [stylesDir],
  }).css,
);

const CARD_SELECTORS = [".s-auth-card", ".s-auth-card-height"];
/** A card SURFACE's own class token: the block, the measuring wrapper, or a
 *  `--modifier` of either. `__element` children (`.s-auth-card-field-icon`) sit
 *  inside the card rather than on it, so they stay outside the contract. */
const CARD_SURFACE_CLASS = /^s-auth-card(?:-height)?(?:--[\w-]+)?$/;
const EXPECTED_MAX_WIDTH = `var(${HK_AUTH_CARD_MAX_WIDTH_VAR}, ${HK_AUTH_CARD_MAX_WIDTH})`;
const CAP_PROPERTIES = /(?:^|[\s;])(max-width|max-inline-size)\s*:\s*([^;]+);?/gi;
/** `width` and its logical twin: either one sets the card's box width. */
const WIDTH_PROPERTY = /(?:^|[\s;])(?:width|inline-size)\s*:\s*([^;]+);?/gi;
/** Minimums beat a maximum in CSS, so a card rule must not carry one. */
const MIN_WIDTH_PROPERTY = /(?:^|[\s;])(?:min-width|min-inline-size)\s*:\s*([^;]+);?/gi;

/** Statement at-rules (`@charset "UTF-8";`, `@layer base, components;`) carry
 *  no block of their own. Left in place, the leftover text is glued onto the
 *  NEXT selector, which both hid a rule from the card checks (`inline-size`
 *  under a statement stayed green) and turned a correct sheet red. */
const AT_RULE_STATEMENT = /(^|[\n}])\s*@[\w-]+[^;{}]*;/g;

/** Split a selector list on its TOP-LEVEL commas only: a comma inside
 *  `:is(.a, .b)`, `[data-x="a,b"]` or an escaped `\,` belongs to one selector,
 *  and splitting there invented extra subjects that hid the real one
 *  (`:not(:is(.a, .b)):not(.s-auth-card--x)` stayed green). */
function splitSelectors(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let buf = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\\") {
      buf += ch + (text[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  parts.push(buf);
  return parts.map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
}

/** `selector { declarations }` pairs from the flattened sheet. */
function rules(css: string): Array<[string[], string]> {
  const out: Array<[string[], string]> = [];
  const stripped = css.replace(AT_RULE_STATEMENT, "$1");
  for (const m of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push([splitSelectors(m[1]), m[2]]);
  }
  return out;
}

/** The compound the declarations land on: everything after the last TOP-LEVEL
 *  combinator. `[class~="x"]`, `:has(+ .x)` and `:nth-child(2n+1)` spell their
 *  combinators inside brackets/parens, which must not split the selector. */
function subjectOf(selector: string): string {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i];
    if (ch === "[" || ch === "(") depth += 1;
    else if (ch === "]" || ch === ")") depth -= 1;
    else if (
      depth === 0 &&
      (ch === ">" || ch === "+" || ch === "~" || /\s/.test(ch))
    ) {
      start = i + 1;
    }
  }
  return selector.slice(start);
}

/** `:not()`/`:has()` arguments do NOT make the subject the card — `.s-auth-footer:not(.s-auth-card)`
 *  still lands on the footer — while `:is()`/`:where()` are subject-transparent
 *  and must keep their argument. Drop the former before reading class tokens. */
function withoutForeignSubjects(compound: string): string {
  let out = compound;
  for (const fn of [":not(", ":has("]) {
    let at = out.indexOf(fn);
    while (at !== -1) {
      let depth = 1;
      let i = at + fn.length;
      while (i < out.length && depth > 0) {
        if (out[i] === "(") depth += 1;
        else if (out[i] === ")") depth -= 1;
        i += 1;
      }
      out = out.slice(0, at) + out.slice(i);
      at = out.indexOf(fn);
    }
  }
  return out;
}

/** The class tokens a compound can carry: `.x` and `[class~="x"]` reach the
 *  same element, and both spellings must be recognised. Attribute names are
 *  case-insensitive in HTML and an `i` flag makes the VALUE so too
 *  (`[CLASS~="S-AUTH-CARD" i]` names the card), while without a flag
 *  `[class~="S-AUTH-CARD"]` is a DIFFERENT class — CSS class values are
 *  case-sensitive — and must not be read as the card. */
function classTokens(compound: string): string[] {
  const tokens: string[] = [];
  for (const m of compound.matchAll(/\.([\w-]+)/g)) tokens.push(m[1]);
  for (const m of compound.matchAll(
    /\[\s*class\s*[~|^$*]?=\s*["']?([\w-]+)["']?(\s+[is])?\s*\]/gi,
  )) {
    const flag = (m[2] ?? "").trim().toLowerCase();
    tokens.push(flag === "i" ? m[1].toLowerCase() : m[1]);
  }
  return tokens;
}

/** The subject's class tokens. `:not()`/`:has()` arguments do NOT make the
 *  subject the card — `.s-auth-footer:not(.s-auth-card)` still lands on the
 *  footer — but a compound that is ONLY the negation does match the card
 *  (`:not(.s-auth-card--wide)` is true OF the bare card), so the arguments are
 *  dropped only while a class token remains to name the subject. */
function subjectClassTokens(compound: string): string[] {
  const tokens = classTokens(withoutForeignSubjects(compound));
  return tokens.length > 0 ? tokens : classTokens(compound);
}

function normalize(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/,\s*/g, ", ")
    .trim();
}

const compiledRules = rules(compiled);
// Matched by the class NAME rather than a `.s-auth` prefix: `[class~="…"]`
// and `:is(.s-auth-card)` reach the same elements and must not slip past.
// Case-insensitive: `[class~="S-AUTH-CARD" i]` names the card, and the scan
// must not drop it before `classTokens` gets to judge the class value.
const authRules = compiledRules.filter(([selectors]) =>
  selectors.some((s) => /s-auth[\w-]*/i.test(s)),
);
const isCardRule = (selectors: string[]) =>
  selectors.some((s) =>
    subjectClassTokens(subjectOf(s)).some((c) => CARD_SURFACE_CLASS.test(c)),
  );

describe("auth card width contract", () => {
  it("caps the card and its measuring wrapper with the shared property", () => {
    for (const [selectors, body] of authRules.filter(([s]) => isCardRule(s))) {
      for (const m of body.matchAll(CAP_PROPERTIES)) {
        expect(normalize(m[2]), `${selectors.join(", ")} ${m[1]}`).toBe(
          EXPECTED_MAX_WIDTH,
        );
      }
    }
    // Positive control: both surfaces really do carry the contract.
    for (const selector of CARD_SELECTORS) {
      const declared = authRules
        .filter(([s]) => s.includes(selector))
        .flatMap(([, body]) => [...body.matchAll(CAP_PROPERTIES)])
        .map((m) => normalize(m[2]));
      expect(declared, selector).toEqual([EXPECTED_MAX_WIDTH]);
    }
  });

  it("keeps every card surface at width: 100% and free of minimums", () => {
    // A fixed `width` (or its logical twin `inline-size`) on the card compiles
    // to a slot that cannot follow the host's width — verified escapes:
    // `width: 28rem` and `inline-size: 28rem` both left the card at 448px
    // while the host asked for 600px. A `min-width` is the same hazard from
    // the other side: a minimum beats a maximum, so `min-width: 32rem` forces
    // the card wider than its own cap (verified: rendered 512px).
    for (const [selectors, body] of authRules.filter(([s]) => isCardRule(s))) {
      for (const m of body.matchAll(WIDTH_PROPERTY)) {
        expect(normalize(m[1]), `${selectors.join(", ")} width`).toBe("100%");
      }
      for (const m of body.matchAll(MIN_WIDTH_PROPERTY)) {
        expect.fail(`${selectors.join(", ")} must not set a minimum width (${m[1].trim()})`);
      }
    }
    // Positive control: the loop above is vacuous if a surface loses the
    // declaration altogether — a deleted `width: 100%` (the collapse the
    // measuring wrapper exists to prevent) must not pass.
    for (const selector of CARD_SELECTORS) {
      const declared = authRules
        .filter(([s]) => s.includes(selector))
        .flatMap(([, body]) => [...body.matchAll(WIDTH_PROPERTY)])
        .map((m) => normalize(m[1]));
      expect(declared, selector).toEqual(["100%"]);
    }
  });

  it("lets no other auth rule cap a width", () => {
    // A third auth surface — or an override nested in @media, which compiles
    // to its own rule — must not declare a width cap of its own: that is the
    // second contract this guard exists to prevent.
    const offenders = authRules
      .filter(([selectors]) => !isCardRule(selectors))
      .filter(([, body]) => [...body.matchAll(CAP_PROPERTIES)].length > 0)
      .map(([selectors]) => selectors.join(", "));
    expect(offenders).toEqual([]);
  });

  it("never defines the property itself, so a host override always wins", () => {
    // Defining it in the sheet would shadow the host's own declaration for
    // every descendant and quietly pin the width back to the fallback.
    expect(compiled).not.toMatch(
      new RegExp(`${HK_AUTH_CARD_MAX_WIDTH_VAR}\\s*:`),
    );
  });
});
