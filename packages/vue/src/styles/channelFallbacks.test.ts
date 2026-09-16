import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Channel-fallback drift guard (2026-09-16).
 *
 * The sheets carry two layers of colour: the STATIC SEED
 * (`styles/theme/channels.scss`, a byte-identical copy of `src/tokens.scss`
 * — see vendoredSync.test.ts) which "renders correctly even without
 * initTheme()", and the alias fallbacks in `styles/admin-tokens.scss`,
 * `styles/reset.scss`, `components/_menu-item.scss` plus the package-local
 * ladders in `packages/theme/styles`, which apply when a host never themes
 * — or, in the legacy ladders, as plain values.
 *
 * Failure class: a fallback is a SECOND COPY of a palette decision, and
 * nothing kept it in step with the seed. Six of them still named
 * synthwave84's pink (`rgb(255 107 157)`) long after the seed had moved to
 * its own blue, so a consumer resolving the alias sheet without the seed got
 * the retired default — a downstream panel's standalone error page shipped
 * exactly that pink, the legacy focus ring glowed pink, and the button
 * ladders still carried the pink/salmon trio. A fallback must resolve to
 * what the seeded composition already declares, and no shipped sheet may
 * carry the retired family at all.
 *
 * Slots with no seed are listed in UNSEEDED rather than skipped silently:
 * `--color-bg-secondary` / `--color-bg-tertiary` are retired spellings
 * (their `#18181b` / `#27272a` fallbacks always win) and `--color-danger` is
 * defined nowhere, so there is no seed value to compare against — recorded
 * debt, not a passing check.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
const packageDir = resolve(stylesDir, "..", "..");
const legacyDir = resolve(packageDir, "..", "theme", "styles");

/** Slots this guard cannot hold to the seed, with the reason above. */
const UNSEEDED = ["--color-bg-secondary", "--color-bg-tertiary", "--color-danger"];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/** `--color-SLOT: R G B;` declarations of the static seed. */
function seedTriplets(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of source.matchAll(/--color-([a-z-]+):\s*(\d+ \d+ \d+);/g)) {
    out[match[1]] = match[2];
  }
  return out;
}

/** Normalize a colour literal to `R G B`: bare/space/comma triplets,
 *  `rgb()`/`rgba()` wrappers, an alpha term, or hex — every spelling the
 *  sheets actually use. */
function triplet(value: string): string | null {
  const v = value
    .trim()
    .replace(/^(?:rgba?)\(/i, "")
    .replace(/\)$/, "")
    .replace(/\/[^/]*$/, "")
    .trim();
  const parts = v.split(/[\s,]+/).filter(Boolean);
  if (parts.length >= 3 && parts.slice(0, 3).every((p) => /^\d+$/.test(p))) {
    return parts.slice(0, 3).join(" ");
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  }
  return null;
}

/** Typed fallbacks, whitespace-tolerant: `var( --color-x, v )` must not slip
 *  past the scan (a single occurrence of that spelling was proven to hide a
 *  drifted value while every counter stayed green). */
function fallbacks(source: string): { slot: string; value: string; line: number }[] {
  const out: { slot: string; value: string; line: number }[] = [];
  const re = /var\(\s*--color-([a-z-]+)\s*,\s*((?:[^()]|\([^()]*\))+?)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    out.push({
      slot: match[1],
      value: match[2],
      line: source.slice(0, match.index).split("\n").length,
    });
  }
  return out;
}

/** The retired pink/salmon family in EVERY spelling: flatten whitespace and
 *  commas so `rgba(238, 162, 164, 0.8)` is caught next to `238 162 164` (the
 *  space-only needles let the comma form through, proven by mutation). */
function retiredHits(source: string): string[] {
  const flat = source.toLowerCase().replace(/[\s,]+/g, "");
  return [
    // synthwave84's pink pair
    "#ff6b9d",
    "#d63384",
    "255107157",
    "21451132",
    // the Gen-1 peony brand and its tints/salmon form
    "#eea2a4",
    "#f4c4c5",
    "#d88b8e",
    "238162164",
    "244196197",
    "216139142",
    // NOT listed: the Gen-1 vermilion danger family (#FF4C00 / #FF7A33 /
    // #CC3D00 / rgba(255, 76, 0, …) — 26 sites across the component sheets
    // and base.scss's danger slot). That is a deliberate Gen-1 palette, not
    // a leftover of the pink brand line, so moving it is a design decision
    // of its own; recorded in the PR instead of smuggled into this guard.
  ].filter((needle) => flat.includes(needle));
}

describe("channel fallbacks mirror the static seed", () => {
  const seedSource = read(resolve(packageDir, "src", "tokens.scss"));
  const seed = seedTriplets(seedSource);

  /** Sheets that carry typed `var(--color-SLOT, …)` fallbacks. */
  const FALLBACK_SHEETS: [string, string][] = [
    ["src/tokens.scss", seedSource],
    ["src/styles/theme/channels.scss", read(resolve(stylesDir, "theme", "channels.scss"))],
    ["src/styles/admin-tokens.scss", read(resolve(stylesDir, "admin-tokens.scss"))],
    ["src/styles/reset.scss", read(resolve(stylesDir, "reset.scss"))],
    ["src/components/_menu-item.scss", read(resolve(packageDir, "src", "components", "_menu-item.scss"))],
  ];

  /** Every shipped sheet, for the retired-family sweep. */
  const ALL_SHEETS: [string, string][] = [
    ...FALLBACK_SHEETS,
    ["src/styles/theme/scale.scss", read(resolve(stylesDir, "theme", "scale.scss"))],
    ["src/styles/theme/scrollbar.scss", read(resolve(stylesDir, "theme", "scrollbar.scss"))],
    ...[
      "_tokens.scss",
      "base.scss",
      "foundation.scss",
      "themes.scss",
      "variables.scss",
      "_layout.scss",
      "_glass.scss",
      "mixins.scss",
      "_scrollbar.scss",
    ].map((name) => [`packages/theme/styles/${name}`, read(resolve(legacyDir, name))] as [string, string]),
  ];

  it("finds both the seed and the fallbacks (positive control)", () => {
    // An empty or mis-pathed read would make every check below pass
    // vacuously, so each scan must prove it saw real content.
    expect(Object.keys(seed).length).toBeGreaterThanOrEqual(15);
    const typed = FALLBACK_SHEETS.flatMap(([, source]) => fallbacks(source));
    expect(typed.length).toBeGreaterThanOrEqual(20);
    for (const [label, source] of ALL_SHEETS) {
      expect(source.length, `${label} read empty`).toBeGreaterThan(200);
    }
  });

  it("declares every typed fallback with the seed value for its slot", () => {
    const checked: string[] = [];
    for (const [label, source] of FALLBACK_SHEETS) {
      for (const row of fallbacks(source)) {
        const slot = `--color-${row.slot}`;
        if (UNSEEDED.includes(slot)) continue;
        expect(seed[row.slot], `${label}:${row.line} ${slot} has no seed slot`).toBeDefined();
        checked.push(`${label}:${row.line}`);
        expect(
          triplet(row.value),
          `${label}:${row.line} var(${slot}, ${row.value})`,
        ).toBe(seed[row.slot]);
      }
    }
    // The scan must actually reach the sheets (guards against a regex that
    // silently matches nothing after an edit).
    expect(checked.length).toBeGreaterThanOrEqual(25);
  });

  it("keeps the retired synthwave pink family out of every shipped sheet", () => {
    for (const [label, source] of ALL_SHEETS) {
      expect(retiredHits(source), `${label} reintroduced a retired colour`).toEqual([]);
    }
    // Positive control: the detector must fire on the known-bad spellings.
    expect(retiredHits("--x: rgba(238, 162, 164, 0.8);")).toContain("238162164");
    expect(retiredHits("--x: #F4C4C5;")).toContain("#f4c4c5");
    expect(retiredHits("--x: rgb(255 107 157 / 12%);")).toContain("255107157");
  });
});
