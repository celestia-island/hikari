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
 * fixed `inline-size`). Statement at-rules (`@charset "UTF-8";`,
 * `@layer base, components;`) are dropped before parsing: otherwise the
 * leftover text is glued onto the next selector, which hid a rule from the card
 * checks and flagged a correct sheet as an offender.
 *
 * Scope notes (deliberately narrow, fail-closed):
 *  - the scan starts at `index.scss`, the package's style entrypoint, so a cap
 *    added to any partial this entrypoint pulls in is in reach (a sheet that is
 *    never composed in stays out — no other sheet declares `.s-auth-card*`);
 *  - stylesheet-level escapes stay out: `@scope`/positional selectors
 *    (`@scope (.s-auth-card) { :scope { … } }`, `.hk-auth-shell > *`) name their
 *    target without the class, a `!important` SCSS override or `.s-auth-card`
 *    variant declared by a host is beyond a static scan, and jsdom has no
 *    layout engine — those need a real-browser check, not this guard;
 *  - logical block properties (`block-size`, `min-block-size`) and
 *    `aspect-ratio` are left to the layout review;
 *  - the positive control wants each surface capped once: a second, identical
 *    cap is reported rather than tolerated (fail-closed — harmless today, but
 *    it is how a duplicate drifts out of sync tomorrow);
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

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const compiled = stripComments(
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

/** `selector { declarations }` pairs from the flattened sheet. */
function rules(css: string): Array<[string[], string]> {
  const out: Array<[string[], string]> = [];
  const stripped = css.replace(AT_RULE_STATEMENT, "$1");
  for (const m of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]
      .split(",")
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    out.push([selectors, m[2]]);
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

/** The class tokens a compound can carry: `.x` and `[class~="x"]` reach the
 *  same element, and both spellings must be recognised. */
function classTokens(compound: string): string[] {
  return [
    ...[...compound.matchAll(/\.([\w-]+)/g)].map((m) => m[1]),
    ...[...compound.matchAll(/\[class[~|^$*]?=\s*["']?([\w-]+)["']?\]/g)].map(
      (m) => m[1],
    ),
  ];
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
const authRules = compiledRules.filter(([selectors]) =>
  selectors.some((s) => /s-auth[\w-]*/.test(s)),
);
const isCardRule = (selectors: string[]) =>
  selectors.some((s) =>
    classTokens(subjectOf(s)).some((c) => CARD_SURFACE_CLASS.test(c)),
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
