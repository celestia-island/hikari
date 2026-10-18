/**
 * Retired color spellings — source contract (2026-10-19 color audit).
 *
 * The audit swept every var() reference across the shipped sheets and the
 * components crate against the two real emitters (vue's tokensToCSSVars
 * channels + the Rust css.rs alias emissions) and found a family of ghost
 * spellings: names that LOOK like theme tokens, were never emitted by
 * anything, and therefore always resolved to their (often one-mode-biased)
 * literal fallbacks — or, with no fallback, silently killed the face
 * (hover washes → transparent, glows → none). Each entry below was
 * re-pointed to its canonical channel in the same change that added this
 * guard; this file exists so none of them can quietly come back.
 *
 * Scope: shipped sheets and crate style strings only (tests, demos and
 * comments are stripped). Not a general resolver — a name lands here only
 * when it is permanently retired, never to be emitted; names that ARE
 * emitted are guarded by their own contracts (see
 * theme::css::interaction_alias_tests in the crate).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const vueDir = resolve(here, "..", "..");
const repoDir = resolve(vueDir, "..", "..");
const crateSrc = join(repoDir, "packages", "components", "src");
const themeStyles = join(repoDir, "packages", "theme", "styles");

/** Permanently retired spellings — a var() reference to any of these is a
 *  regression. (Names that are merely host-tunable knobs live elsewhere;
 *  this list is only for spellings the emitters must never grow.) */
const RETIRED = [
  // wrong channel: the danger channel is --color-error (seed 247 118 142);
  // --color-danger was emitted by nothing and its 240 70 80 fallback was a
  // second, drifting palette decision (the 2026-09-16 bug class again).
  "--color-danger",
  // retired spellings: the audit's admin-surface backgrounds ride
  // --color-background / --color-surface now.
  "--color-bg-secondary",
  "--color-bg-tertiary",
  // the vue-channel namespace has no --color-text-primary slot (the primary
  // ink channel is --color-text); the admin .a-text-primary utility rode
  // this phantom spelling with no fallback and inherited its parent ink.
  "--color-text-primary",
  // the alias family spells the primary ink slot --hi-color-text-primary;
  // plain --hi-color-text never existed, and its #333 fallback was unreadable
  // on dark surfaces (the exact bug class of the 2026-10-18 breadcrumb fix).
  "--hi-color-text",
  // the crate emits --hi-border-light; the --hi-color-border-light spelling
  // was a ghost whose #f3f4f6 fallback was light-biased.
  "--hi-color-border-light",
  // spelling typo that was never emitted anywhere; the canonical scale token
  // is --text-sm.
  "--hi-text-sm",
  // invented family prefix nothing emits; the values were already inline
  // (unwrapped to the same literals).
  "--hikari-duration-fast",
  "--hikari-duration-normal",
  "--hikari-ease-smooth",
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Boundary-aware retired-spelling probe: `var(--name` NOT followed by
 *  another name character, so --hi-color-text does not collide with the
 *  legitimate --hi-color-text-primary/-secondary emissions. */
function referencesRetired(source: string, name: string): boolean {
  const re = new RegExp(`var\\(\\s*${name}(?![a-zA-Z-])`);
  return re.test(source);
}

function* sheetsUnder(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === "node_modules" || entry === "target" || entry.includes(".test.")) continue;
      yield* sheetsUnder(p);
    } else if (entry.endsWith(".scss") || entry.endsWith(".css")) {
      yield p;
    } else if (entry.endsWith(".rs") && !entry.endsWith(".test.rs")) {
      yield p;
    }
  }
}

describe("retired color spellings", () => {
  it("never appears in a shipped vue sheet", () => {
    for (const file of sheetsUnder(join(vueDir, "src", "styles"))) {
      const text = stripComments(readFileSync(file, "utf8"));
      for (const name of RETIRED) {
        expect(
          referencesRetired(text, name),
          `${file.replace(vueDir, "packages/vue")} references retired spelling ${name}`,
        ).toBe(false);
      }
    }
  });

  it("never appears in a shipped component scss", () => {
    for (const file of sheetsUnder(join(vueDir, "src", "components"))) {
      const text = stripComments(readFileSync(file, "utf8"));
      for (const name of RETIRED) {
        expect(
          referencesRetired(text, name),
          `${file.replace(vueDir, "packages/vue")} references retired spelling ${name}`,
        ).toBe(false);
      }
    }
  });

  it("never appears in the components crate styles or rs style strings", () => {
    for (const root of [crateSrc, themeStyles]) {
      for (const file of sheetsUnder(root)) {
        const text = stripComments(readFileSync(file, "utf8"));
        for (const name of RETIRED) {
          expect(
            referencesRetired(text, name),
            `${file.replace(repoDir, "packages")} references retired spelling ${name}`,
          ).toBe(false);
        }
      }
    }
  });

  it("keeps its own denylist honest (positive control)", () => {
    // The sweep above must be able to see a violation: feed it a synthetic
    // line carrying a retired spelling and assert the detector matches.
    const probe = "color: var(--color-danger, 240 70 80);";
    expect(referencesRetired(probe, "--color-danger")).toBe(true);
    // and the boundary holds: a legit longer name must NOT trip the probe
    expect(referencesRetired("color: var(--color-dangerous);", "--color-danger")).toBe(false);
  });
});
