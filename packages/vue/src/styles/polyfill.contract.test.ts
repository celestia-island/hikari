/**
 * Cross-engine prefix contract (styles/polyfill.scss).
 *
 * hikari is a library: it ships these sheets to hosts it cannot
 * enumerate, built by minifiers and target matrices it does not own. A
 * `-webkit-` prefix that comes from the CONSUMER's minifier is therefore
 * a function of that consumer's browserslist: narrow the target and the
 * prefix vanishes with no build error and no diff in the consumer's own
 * dev browser — only the old engine breaks. (2026-10-31 incident: a
 * minifier downgraded a `light-dark()` the pill relied on, the custom
 * property pair went undefined and the text fell back to the inherited
 * colour.) So the prefixes are authored in `styles/polyfill.scss` and
 * every hikari sheet that touches one of those properties must go
 * through its mixin.
 *
 * The single source of truth is `$polyfilled-properties` in the partial:
 * this guard expands both scans from that list and never keeps a second
 * copy. Adding a prefix means one entry there plus one mixin — every
 * sheet then has to convert or the bare-declaration scan fails.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as sass from "sass";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "..");
const partialPath = join(here, "polyfill.scss");
const partialFile = relative(srcDir, partialPath);

/** Replace comments with blanks (newlines kept) so line numbers survive
 *  and prose about a property never reads as a declaration. */
function stripComments(source: string): string {
  let out = "";
  let quote: string | null = null;
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (quote !== null) {
      out += char;
      if (char === "\\") {
        out += source[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (char === quote) quote = null;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      out += char;
      i += 1;
      continue;
    }
    if (char === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      out += "  ";
      i += 2;
      continue;
    }
    out += char;
    i += 1;
  }
  return out;
}

const partialBody = stripComments(readFileSync(partialPath, "utf-8"));

/** The polyfilled property list, parsed from the partial (single source
 *  of truth): each name is also the name of its mixin. */
function polyfilledProperties(): string[] {
  const match = /\$polyfilled-properties\s*:\s*([^;]+);/.exec(partialBody);
  expect(match, `positive control: ${partialFile} exports $polyfilled-properties`).not.toBeNull();
  const names = match![1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  expect(names.length, "the property list is not empty").toBeGreaterThan(0);
  return names;
}

/** One probe value per polyfilled property, used by the compile test
 *  below. Its KEY SET must equal `$polyfilled-properties`: the assertion
 *  in that test fails when a property is listed without a sample (the
 *  probe would silently skip it) or sampled without being listed.
 *
 *  The samples are chosen to pin the variadic contract too — a space list
 *  (`blur(4px) saturate(1.2)`) and a comma list of layers
 *  (`linear-gradient(...), linear-gradient(...)`) must pass through as
 *  ONE value of that shape. */
const PROBE_VALUES: Record<string, string> = {
  "backdrop-filter": "blur(4px) saturate(1.2)",
  "user-select": "none",
  "mask-image":
    "linear-gradient(a, transparent 0), linear-gradient(b, transparent 0)",
};

function sheets(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules") continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".scss") && path !== partialPath) found.push(path);
    }
  };
  walk(srcDir);
  return found;
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

/** `-webkit-<prop>:` and plain `<prop>:` written as a declaration
 *  (start of a line or right after `{`/`;` — the `-webkit-` spelling
 *  counts as bare: it means the pair was hand-written, not included). */
function bareDeclarationHits(source: string, property: string): number[] {
  const pattern = new RegExp(
    String.raw`(?:^|[{;}])[ \t]*(?:-webkit-)?${escapeForRegExp(property)}[ \t]*:`,
    "gim",
  );
  const lines: number[] = [];
  for (const match of source.matchAll(pattern)) lines.push(lineOf(source, match.index));
  return lines;
}

function polyfillUse(source: string): boolean {
  return /@use\s+["'][^"']*polyfill(?:\.scss)?["']/.test(source);
}

function mixinIncludes(source: string, properties: string[]): number[] {
  const names = properties.map(escapeForRegExp).join("|");
  const pattern = new RegExp(
    String.raw`@include\s+(?:[A-Za-z_][\w-]*\.)?(?:${names})\s*\(`,
    "gim",
  );
  const lines: number[] = [];
  for (const match of source.matchAll(pattern)) lines.push(lineOf(source, match.index));
  return lines;
}

describe("cross-engine prefixes are authored in styles/polyfill.scss", () => {
  const properties = polyfilledProperties();
  const all = sheets();

  it("walks the source tree and keeps the partial out of the sweep", () => {
    // Mis-rooted walk or a self-including sweep would make the scans
    // below pass vacuously (the partial must declare the properties).
    expect(all.length, "sheets found under src/").toBeGreaterThan(100);
    expect(all, "the partial is not one of the swept sheets").not.toContain(partialPath);
  });

  it("ships one mixin per listed property, each pairing both sides", () => {
    for (const property of properties) {
      expect(
        new RegExp(String.raw`@mixin\s+${escapeForRegExp(property)}\s*\(`).test(partialBody),
        `${partialFile} defines @mixin ${property}`,
      ).toBe(true);
      expect(
        new RegExp(String.raw`^\s*-webkit-${escapeForRegExp(property)}\s*:`, "m").test(partialBody),
        `@mixin ${property} emits the -webkit- side`,
      ).toBe(true);
      expect(
        new RegExp(String.raw`^\s*${escapeForRegExp(property)}\s*:`, "m").test(partialBody),
        `@mixin ${property} emits the standard side`,
      ).toBe(true);
    }
  });

  it("never declares a polyfilled property raw in a sheet", () => {
    const offenders: string[] = [];
    for (const file of all) {
      const source = stripComments(readFileSync(file, "utf-8"));
      for (const property of properties) {
        for (const line of bareDeclarationHits(source, property)) {
          offenders.push(`${relative(srcDir, file)}:${line} ${property}`);
        }
      }
    }
    expect(
      offenders,
      `use @include <property>(<value>); from ${partialFile} instead of a raw declaration`,
    ).toEqual([]);
  });

  it("only includes those mixins from a sheet that @use-es the partial", () => {
    const offenders: string[] = [];
    for (const file of all) {
      const source = stripComments(readFileSync(file, "utf-8"));
      const includes = mixinIncludes(source, properties);
      if (includes.length === 0) continue;
      if (!polyfillUse(source)) offenders.push(relative(srcDir, file));
    }
    expect(
      offenders,
      `a sheet that @include-s a polyfill mixin must @use ${partialFile}`,
    ).toEqual([]);
  });

  it("probes every listed property, and nothing outside the list", () => {
    expect(
      Object.keys(PROBE_VALUES).sort(),
      `PROBE_VALUES must cover exactly $polyfilled-properties (add a sample ` +
        `when adding a mixin, or the compile probe silently skips it)`,
    ).toEqual([...properties].sort());
  });

  it("compiles the prefix pairs for real (variadic values included)", () => {
    const probe = [
      `@use "polyfill" as *;`,
      `.probe {`,
      ...properties.map((property) => `  @include ${property}(${PROBE_VALUES[property]});`),
      ...properties.map(
        (property) => `  @include ${property}(${PROBE_VALUES[property]}, $important: true);`,
      ),
      `}`,
    ].join("\n");
    const css = sass.compileString(probe, {
      loadPaths: [here],
      silenceDeprecations: ["import", "global-builtin", "legacy-js-api"],
    }).css;

    for (const property of properties) {
      const pattern = new RegExp(
        String.raw`^\s*(-webkit-)?${escapeForRegExp(property)}\s*:\s*([^;]+);`,
        "gm",
      );
      const pairs = [...css.matchAll(pattern)].map((match) => ({
        prefixed: Boolean(match[1]),
        value: match[2].trim(),
      }));
      const standard = pairs.filter((row) => !row.prefixed);
      const prefixed = pairs.filter((row) => row.prefixed);
      expect(standard.length, `compiled ${property} declarations`).toBeGreaterThan(0);
      expect(
        prefixed.length,
        `every compiled ${property} declaration has a -webkit- twin`,
      ).toBe(standard.length);
      // The value passes through verbatim (space list / comma list kept
      // as one value), and $important reaches both sides.
      expect(
        standard.map((row) => row.value),
        `${property} emits the sample verbatim, then again as !important`,
      ).toEqual([PROBE_VALUES[property], `${PROBE_VALUES[property]} !important`]);
      expect(
        prefixed.map((row) => row.value),
        `-webkit-${property} carries the same values as ${property}`,
      ).toEqual(standard.map((row) => row.value));
    }
  });

  it("keeps the guard able to see the defect classes it forbids", () => {
    // Instrument self-tests: a guard that cannot fail proves nothing.
    expect(bareDeclarationHits(".x {\n  backdrop-filter: none;\n}", "backdrop-filter")).toHaveLength(1);
    expect(bareDeclarationHits(".x { backdrop-filter: none; }", "backdrop-filter")).toHaveLength(1);
    expect(bareDeclarationHits(".x { -webkit-user-select: none; }", "user-select")).toHaveLength(1);
    expect(
      bareDeclarationHits("/* mask-image: none; */ .x { color: red; }", "mask-image"),
      "prose in a comment is not a declaration",
    ).toEqual([]);
    // A declaration can follow a nested block's closing brace on the
    // same line — the boundary set must include `}` (S3-2).
    expect(
      bareDeclarationHits(".x { .y { color: red; } mask-image: none; }", "mask-image"),
    ).toHaveLength(1);
    expect(mixinIncludes(".x { @include mask-image(none); }", properties)).toHaveLength(1);
    expect(mixinIncludes(".x { @include p.mask-image(none); }", properties)).toHaveLength(1);
    // Sass keywords are case-insensitive: `@INCLUDE` must not walk past
    // the @use requirement (S3-1).
    expect(mixinIncludes(".x { @INCLUDE user-select(none); }", properties)).toHaveLength(1);
    expect(mixinIncludes(".x { @include USER-SELECT(none); }", properties)).toHaveLength(1);
    expect(polyfillUse('@use "../styles/polyfill" as *;')).toBe(true);
    expect(polyfillUse('@use "./polyfill" as p;')).toBe(true);
  });
});
