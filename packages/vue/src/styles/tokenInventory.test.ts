import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { tokensToCSSVars, type ThemeSchemeTokens } from "../theme/presets";

/**
 * Theme token inventory guard — the normalization contract.
 *
 * Tier model (one name, one definition, one sheet):
 *   L0 channels  --color-*        palette triplets; static seed + runtime deltas
 *   L1 semantic  --hi-color-* / --c-* / --shadow-* / --border-*  derivations
 *   L2 scale     --space-N / --text-* / --radius-* / --blur-* /
 *                --duration-* / --ease-* / --z-*                 constants
 *   L3 hooks     --hk-<component>-* live in component files (not checked here)
 *
 * The allowlists below are the KNOWN legacy debt this normalization retires
 * wave by wave. Shrinking an allowlist is the wave's acceptance test; growing
 * one is a regression and should fail review.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function stripComments(source: string): string {
  // Block comments then line comments — enough for token-line parsing.
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function stripProvenanceHeader(source: string): string {
  const lines = source.split("\n");
  let marker = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes("do not hand-edit here.")) {
      marker = i;
      break;
    }
  }
  let i = marker + 1;
  while (i < lines.length && lines[i].trim() === "") {
    i += 1;
  }
  return lines.slice(i).join("\n");
}

/** name -> [{ file, value }] over `--name: value;` declarations. */
function harvestDefinitions(files: Array<[string, string]>) {
  const defs = new Map<string, Array<{ file: string; value: string }>>();
  for (const [label, source] of files) {
    const css = stripComments(source);
    for (const m of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
      const list = defs.get(m[1]) ?? [];
      list.push({ file: label, value: m[2].replace(/\s+/g, " ").trim() });
      defs.set(m[1], list);
    }
  }
  return defs;
}

// ── The shipped static sheets (what a normalized host entry loads) ──
const seedSource = stripProvenanceHeader(
  read(resolve(stylesDir, "theme/channels.scss")),
);
const scaleSource = stripProvenanceHeader(
  read(resolve(stylesDir, "theme/scale.scss")),
);
const adminSource = read(resolve(stylesDir, "admin-tokens.scss"));
const legacySheets = [
  "base.scss",
  "foundation.scss",
  "themes.scss",
  "_tokens.scss",
  "_layout.scss",
].map((b) => [`theme/${b}`, stripProvenanceHeader(read(resolve(stylesDir, "theme", b)))] as [string, string]);

const seedFiles: Array<[string, string]> = [
  ["theme/channels.scss", seedSource],
  ["theme/scale.scss", scaleSource],
];

// ── L0: channel completeness vs the runtime writer ──
// Derive the exact `--color-*` / `--hi-*` key set tokensToCSSVars emits by
// calling it with a fixture scheme — the inventory then tracks the runtime
// writer automatically as presets.ts evolves.
const FIXTURE_RGB = { r: 1, g: 2, b: 3 };
const FIXTURE_SCHEME: ThemeSchemeTokens = {
  primary: FIXTURE_RGB,
  secondary: FIXTURE_RGB,
  accent: FIXTURE_RGB,
  text: FIXTURE_RGB,
  muted: FIXTURE_RGB,
  border: FIXTURE_RGB,
  focusedBorder: FIXTURE_RGB,
  background: FIXTURE_RGB,
  surface: FIXTURE_RGB,
  selectedBackground: FIXTURE_RGB,
  selectedText: FIXTURE_RGB,
  statusBarBackground: FIXTURE_RGB,
  success: FIXTURE_RGB,
  error: FIXTURE_RGB,
  warning: FIXTURE_RGB,
  info: FIXTURE_RGB,
};
const RUNTIME_VARS = tokensToCSSVars(FIXTURE_SCHEME);
const RUNTIME_CHANNEL_KEYS = Object.keys(RUNTIME_VARS).filter((k) =>
  k.startsWith("--color-"),
);
const RUNTIME_ALIAS_KEYS = Object.keys(RUNTIME_VARS).filter((k) =>
  k.startsWith("--hi-"),
);

describe("theme token inventory", () => {
  // W4 complete: the static seed now carries every runtime-written token.
  const KNOWN_MISSING_CHANNELS = new Set<string>([]);
  const KNOWN_MISSING_ALIASES = new Set<string>([]);

  it("static seed defines every --color-* channel the runtime writes", () => {
    const defs = harvestDefinitions(seedFiles);
    const missing = RUNTIME_CHANNEL_KEYS.filter(
      (k) => !defs.has(k) && !KNOWN_MISSING_CHANNELS.has(k),
    );
    expect(missing, "channels missing from the static seed").toEqual([]);
  });

  it("static seed carries every --hi-* alias the runtime writes", () => {
    const defs = harvestDefinitions(seedFiles);
    const missing = RUNTIME_ALIAS_KEYS.filter(
      (k) => !defs.has(k) && !KNOWN_MISSING_ALIASES.has(k),
    );
    expect(missing, "aliases missing from the static seed").toEqual([]);
  });

  it("static seed has no --hi-* derivation that is not backed by a channel", () => {
    const defs = harvestDefinitions(seedFiles);
    const channels = new Set([...defs.keys()].filter((k) => k.startsWith("--color-")));
    const dangling = [...defs.keys()]
      .filter((k) => k.startsWith("--hi-color-"))
      .filter((k) => {
        const value = defs.get(k)![0].value;
        return ![...value.matchAll(/var\((--color-[a-z0-9-]+)/g)].every((m) =>
          channels.has(m[1]),
        );
      });
    expect(dangling, "derivations referencing undefined channels").toEqual([]);
  });

  it("scale tokens are single-defined across the normalized sheets", () => {
    // Current legacy debt: these names still multi-define across the
    // legacy sheets + admin-tokens (frozen 2026-09-12 census, 56 names).
    // Each entry must die in its wave; adding a NEW name here is a
    // regression.
    const KNOWN_MULTI_SCALE = new Set([
      "--blur-lg",
      "--blur-md",
      "--blur-sm",
      "--border-faint",
      "--border-input",
      "--border-subtle",
      "--c-primary",
      "--c-primary-light",
      "--c-primary-overlay",
      "--c-primary-subtle",
      "--duration-fast",
      "--duration-instant",
      "--duration-normal",
      "--duration-short",
      "--ease-in-expo",
      "--ease-in-out",
      "--ease-out-expo",
      "--ease-standard",
      "--font-mono",
      "--font-reading",
      "--font-sans",
      "--hi-bg-surface-dark",
      "--hi-border-color-focus",
      "--hi-duration-instant",
      "--hi-ease-default",
      "--hi-icon-color",
      "--hi-icon-size-lg",
      "--hi-icon-size-md",
      "--hi-icon-size-sm",
      "--hi-icon-size-xs",
      "--hi-radius-lg",
      "--hi-radius-md",
      "--hi-radius-sm",
      "--hi-radius-xl",
      "--hi-shadow-button",
      "--hi-shadow-elevated",
      "--hi-shadow-lg",
      "--hi-shadow-md",
      "--hi-shadow-sm",
      "--hi-shadow-xl",
      "--opacity-half",
      "--radius-md",
      "--radius-sm",
      "--space-10",
      "--space-12",
      "--space-14",
      "--space-16",
      "--space-2",
      "--space-20",
      "--space-24",
      "--space-28",
      "--space-32",
      "--space-4",
      "--space-40",
      "--space-6",
      "--space-8",
      "--text-2xs",
      "--text-base",
      "--text-lg",
      "--text-md",
      "--text-sm",
      "--text-xs",
      "--z-base",
      "--z-header",
      "--z-sidebar",
    ]);

    const defs = harvestDefinitions([
      seedFiles[0],
      ...legacySheets,
      ["admin-tokens.scss", adminSource],
    ]);
    const scaleRe = /^--(space-|text-|radius-|blur-|duration-|ease-|z-|border-|c-|opacity-|shadow-(?!dropdown|focus|button-danger)|font-|hi-(duration|ease|radius|icon|blur|opacity|shadow-(?!dropdown|focus)|z-|border-color))/;
    const unexpected = [...defs.entries()]
      .filter(([name, sites]) => {
        if (!scaleRe.test(name)) return false;
        const files = new Set(sites.map((s) => s.file));
        if (files.size <= 1) return false;
        return !KNOWN_MULTI_SCALE.has(name);
      })
      .map(([name]) => name);
    expect(unexpected, "new multi-defined scale tokens").toEqual([]);
  });

  it("component --hi-color-* fallbacks stay on the canonical literals", () => {
    // The standalone-render contract: when a host loads nothing, a
    // component renders through these literals. They are DERIVED FROM THE
    // SEED triplets (theme/channels.scss) so the standalone face equals
    // the documented default palette — derived programmatically below so
    // the table tracks the seed automatically.
    const seedTriplets = harvestDefinitions(seedFiles);
    const hexFromSeed = (channel: string): string => {
      const def = seedTriplets.get(channel)![0].value; // "r g b"
      const [r, g, b] = def
        .split(" ")
        .map((n) => Number(n).toString(16).padStart(2, "0"));
      return `#${r}${g}${b}`;
    };
    const CANONICAL: Record<string, string> = {
      "--hi-color-primary": hexFromSeed("--color-primary"),
      "--hi-color-secondary": hexFromSeed("--color-secondary"),
      "--hi-color-surface": hexFromSeed("--color-surface"),
      "--hi-color-background": hexFromSeed("--color-background"),
      "--hi-color-border": hexFromSeed("--color-border"),
      "--hi-color-text-primary": hexFromSeed("--color-text"),
      "--hi-color-text-secondary": hexFromSeed("--color-text-secondary"),
      "--hi-color-muted": hexFromSeed("--color-muted"),
      "--hi-color-success": hexFromSeed("--color-success"),
      "--hi-color-error": hexFromSeed("--color-error"),
      "--hi-color-warning": hexFromSeed("--color-warning"),
      "--hi-color-info": hexFromSeed("--color-info"),
      "--hi-color-focused-border": hexFromSeed("--color-focused-border"),
    };
    const KNOWN_DEVIANT_FALLBACKS = new Set<string>([]);

    const componentsDir = resolve(stylesDir, "../components");
    const files = readdirSync(componentsDir).filter((f) => f.endsWith(".scss"));
    const deviants: string[] = [];
    for (const f of files) {
      const css = read(resolve(componentsDir, f));
      for (const m of css.matchAll(/var\((--hi-color-[a-z0-9-]+),\s*(#[0-9a-fA-F]{3,8})\)/g)) {
        const token = m[1];
        const fallback = m[2].toLowerCase();
        const canonical = CANONICAL[token];
        if (!canonical) continue;
        if (fallback !== canonical && !KNOWN_DEVIANT_FALLBACKS.has(fallback)) {
          deviants.push(`${f}: var(${token}, ${m[2]})`);
        }
      }
    }
    expect(deviants, "non-canonical hex fallbacks").toEqual([]);
  });
});
