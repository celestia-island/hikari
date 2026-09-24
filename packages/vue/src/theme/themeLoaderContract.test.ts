import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { themePresets } from "./presets";

/**
 * Pre-paint loader contract.
 *
 * `res/theme-loader.js` carries a SECOND, hand-written copy of the stock
 * palette: it runs as a bare <script> before any module loads (the backend
 * CSP blocks inline script, so it cannot be generated on the fly), which
 * means it cannot import the preset table. It only stores primary/bg/surface
 * per mode — enough to paint the loading screen — and until now nothing kept
 * those numbers in step with `presets.ts`; the "kept in sync" note at the top
 * of the file was the whole mechanism.
 *
 * The failure class this closes: the loader dereferences its table without a
 * guard (`var theme = THEMES[tid] || FALLBACK_THEME; var scheme = theme[mode]
 * || theme.dark;`). Deleting a preset id from the table while the loader
 * still names it turns `FALLBACK_THEME` into `undefined` and throws a
 * TypeError inside a plain script with no error boundary — the loading
 * screen dies for EVERY consumer before a single `--loader-*` variable is
 * set. Consumers copy this file verbatim (plana res/, plus per-app vendored
 * snapshots), so a mismatch here is a cross-repo outage, not cosmetic drift.
 *
 * Scope: the id set, the two id literals the loader resolves by name, and the
 * per-mode primary/bg/surface it paints. The loader's solar/geo math is not
 * this guard's business.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const loaderPath = resolve(repoRoot, "res", "theme-loader.js");
const source = readFileSync(loaderPath, "utf8");

/** The `var THEMES = { … };` block, sliced so the id scan cannot pick up an
 *  unrelated object literal elsewhere in the file. */
function themesBlock(): string {
  const start = source.indexOf("var THEMES = {");
  if (start < 0) throw new Error("res/theme-loader.js no longer declares `var THEMES = {`");
  const end = source.indexOf("var FALLBACK_THEME", start);
  if (end < start) throw new Error("res/theme-loader.js no longer declares `var FALLBACK_THEME` after the table");
  return source.slice(start, end);
}

/** Theme ids declared in the loader table (4-space-indented `id: {` lines). */
function declaredIds(): string[] {
  return [...themesBlock().matchAll(/^ {4}([A-Za-z0-9_-]+): \{$/gm)].map((match) => match[1]);
}

/** One `key: [r, g, b]` out of a mode line of the loader table, as `"r g b"`. */
function triplet(block: string, id: string, mode: "dark" | "light", key: "primary" | "bg" | "surface"): string {
  const idAt = block.indexOf(`    ${id}: {`);
  if (idAt < 0) throw new Error(`theme-loader.js no longer declares the ${id} entry`);
  const entry = block.slice(idAt, block.indexOf("\n    }", idAt));
  const match = new RegExp(`\\b${mode}:\\s*\\{[^}]*\\b${key}: \\[(\\d+), (\\d+), (\\d+)\\]`).exec(entry);
  if (!match) throw new Error(`theme-loader.js ${id}.${mode} no longer carries ${key} as [r, g, b]`);
  return `${match[1]} ${match[2]} ${match[3]}`;
}

describe("pre-paint theme loader mirrors the stock preset table", () => {
  it("declares exactly the stock preset ids", () => {
    expect(declaredIds().sort()).toEqual(Object.keys(themePresets).sort());
  });

  it("points FALLBACK_THEME at a declared, known id", () => {
    const match = /var FALLBACK_THEME = THEMES\.([A-Za-z0-9_-]+);/.exec(source);
    expect(match, "FALLBACK_THEME resolves a table entry by name").toBeTruthy();
    expect(declaredIds()).toContain(match![1]);
    expect(Object.keys(themePresets)).toContain(match![1]);
  });

  it("keeps the stored-id default literal a declared, known id", () => {
    // The chain is formatted across lines, so allow any whitespace between
    // the operator and the literal.
    const match = /__celestiaDefaultTheme\s*\|\|\s*"([A-Za-z0-9_-]+)"/.exec(source);
    expect(match, "the stored-id chain ends in a literal id").toBeTruthy();
    expect(declaredIds()).toContain(match![1]);
    expect(Object.keys(themePresets)).toContain(match![1]);
  });

  it("consults the hikari engine keys ahead of the page default", () => {
    // The running app persists its selection under these exact keys
    // (useTheme.ts). Without them the loading screen repaints the default
    // brand while the app restores another theme — the pre-paint and app
    // halves would disagree on every non-default boot. The legacy per-app
    // prefixed keys stay AHEAD of the engine keys for back-compat.
    expect(source).toContain('localStorage.getItem("hikari-theme")');
    expect(source).toContain('localStorage.getItem("hikari-theme-mode")');
    // Order is asserted inside the tid chain itself — `window.__celestiaDefaultTheme`
    // also appears earlier (the page-themes merge block), so a whole-file search
    // would measure the wrong occurrence.
    const chainStart = source.indexOf("var tid =");
    const chainEnd = source.indexOf("var theme =", chainStart);
    expect(chainStart, "the stored-id chain is still there").toBeGreaterThan(-1);
    expect(chainEnd).toBeGreaterThan(chainStart);
    const chain = source.slice(chainStart, chainEnd);
    const prefixAt = chain.indexOf('storagePrefix() + "theme"');
    const engineAt = chain.indexOf('localStorage.getItem("hikari-theme")');
    const pageDefaultAt = chain.indexOf("window.__celestiaDefaultTheme");
    expect(prefixAt, "the prefixed theme key is still read").toBeGreaterThan(-1);
    expect(engineAt, "the engine theme key is read").toBeGreaterThan(-1);
    expect(pageDefaultAt, "the page-declared default is still read").toBeGreaterThan(-1);
    expect(engineAt, "prefixed key stays ahead of the engine key").toBeGreaterThan(prefixAt);
    expect(engineAt, "engine key stays ahead of the page-declared default").toBeLessThan(pageDefaultAt);
  });

  it.each(["dark", "light"] as const)(
    "mirrors every %s scheme's primary/bg/surface",
    (mode) => {
      const block = themesBlock();
      for (const id of declaredIds()) {
        const preset = themePresets[id];
        if (!preset) throw new Error(`theme-loader.js declares ${id}, which the stock preset table does not`);
        const scheme = mode === "dark" ? preset.dark : preset.light;
        expect(triplet(block, id, mode, "primary")).toBe(
          `${scheme.primary.r} ${scheme.primary.g} ${scheme.primary.b}`,
        );
        expect(triplet(block, id, mode, "bg")).toBe(
          `${scheme.background.r} ${scheme.background.g} ${scheme.background.b}`,
        );
        expect(triplet(block, id, mode, "surface")).toBe(
          `${scheme.surface.r} ${scheme.surface.g} ${scheme.surface.b}`,
        );
      }
    },
  );
});
