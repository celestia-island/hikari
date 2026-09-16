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
 * Scope notes (deliberately narrow, fail-closed):
 *  - the scan covers `admin-tokens.scss`; a cap moved into another sheet is
 *    out of reach here (no other sheet declares `.s-auth-card*` today);
 *  - Sass indirection is judged by what it COMPILES to: a `@extend`ed
 *    placeholder is fine while it carries the property, and fails once it
 *    compiles back into a literal — which is the behaviour we want, since the
 *    browser only ever sees the compiled sheet.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
const sheetPath = resolve(stylesDir, "admin-tokens.scss");
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
const EXPECTED_MAX_WIDTH = `var(${HK_AUTH_CARD_MAX_WIDTH_VAR}, ${HK_AUTH_CARD_MAX_WIDTH})`;
const CAP_PROPERTIES = /(?:^|[\s;])(max-width|max-inline-size)\s*:\s*([^;]+);?/gi;
const WIDTH_PROPERTY = /(?:^|[\s;])width\s*:\s*([^;]+);?/gi;

/** `selector { declarations }` pairs from the flattened sheet. */
function rules(css: string): Array<[string[], string]> {
  const out: Array<[string[], string]> = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]
      .split(",")
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    out.push([selectors, m[2]]);
  }
  return out;
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
const authRules = compiledRules.filter(([selectors]) =>
  selectors.some((s) => /\.s-auth[\w-]*/.test(s)),
);
const isCardRule = (selectors: string[]) =>
  selectors.some((s) => CARD_SELECTORS.includes(s));

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

  it("keeps every card surface at width: 100%", () => {
    // A fixed `width` on the card compiles to a slot that cannot follow the
    // host's width (verified escape: `width: 28rem` beside the cap left the
    // card at 448px while the host asked for 600px).
    for (const [selectors, body] of authRules.filter(([s]) => isCardRule(s))) {
      for (const m of body.matchAll(WIDTH_PROPERTY)) {
        expect(normalize(m[1]), `${selectors.join(", ")} width`).toBe("100%");
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
