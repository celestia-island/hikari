import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Vendored-copy drift guard.
 *
 * Two file families in src/styles are byte-identical re-copies of upstream
 * sources (registry installs can only resolve paths inside this package):
 *
 *   1. styles/theme/channels.scss  ← src/tokens.scss
 *   2. styles/theme/{base,foundation,themes,_tokens,_layout,variables,
 *      mixins,_glass,_scrollbar}.scss  ← packages/theme/styles/*
 *
 * The re-copy adds exactly one provenance header comment block; everything
 * after it must match the upstream byte-for-byte. Edit the UPSTREAM, then
 * re-run scripts/theme/sync-vendored.sh — never hand-edit the copies.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));

function readTrimmed(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

/** Strip the vendored provenance header: lines from the start through the
 *  "do not hand-edit here." marker line, plus immediately following blank
 *  lines. Everything after must equal the upstream byte-for-byte. */
function stripProvenanceHeader(source: string): string {
  const lines = source.split("\n");
  let marker = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes("do not hand-edit here.")) {
      marker = i;
      break;
    }
  }
  expect(marker, "vendored provenance header marker line").toBeGreaterThan(-1);
  let i = marker + 1;
  while (i < lines.length && lines[i].trim() === "") {
    i += 1;
  }
  return lines.slice(i).join("\n");
}

const VENDORED_FROM_VUE: Array<[string, string]> = [
  ["theme/channels.scss", "tokens.scss"],
  ["theme/scale.scss", "scale.scss"],
];

const VENDORED_FROM_THEME_PKG = [
  "base.scss",
  "foundation.scss",
  "themes.scss",
  "_tokens.scss",
  "_layout.scss",
  "variables.scss",
  "mixins.scss",
  "_glass.scss",
  "_scrollbar.scss",
];

describe("vendored theme copies match their upstream sources", () => {
  it.each(VENDORED_FROM_VUE)(
    "styles/%s is the headered copy of src/%s",
    (vendored, upstream) => {
      const upstreamSource = readTrimmed(
        resolve(stylesDir, "..", upstream),
      );
      const vendoredBody = stripProvenanceHeader(
        readTrimmed(resolve(stylesDir, vendored)),
      );
      expect(vendoredBody).toBe(upstreamSource);
    },
  );

  it.each(VENDORED_FROM_THEME_PKG)(
    "styles/theme/%s is the headered copy of packages/theme/styles/%s",
    (basename) => {
      const upstreamSource = readTrimmed(
        resolve(stylesDir, "../../../theme/styles", basename),
      );
      const vendoredBody = stripProvenanceHeader(
        readTrimmed(resolve(stylesDir, "theme", basename)),
      );
      expect(vendoredBody).toBe(upstreamSource);
    },
  );
});
