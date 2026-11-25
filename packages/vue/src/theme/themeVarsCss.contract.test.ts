import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildThemeVarsCss } from "./themeVarsCss";

/**
 * Drift contract for the PRE-RENDERED theme CSS (hikari#1546): the checked
 * -in `src/styles/theme-vars.css` must be byte-identical to what
 * `buildThemeVarsCss()` composes from the live preset table. When the
 * table changes (new slot, adjusted color), the CSS MUST be regenerated in
 * the same PR — otherwise a returning visitor's pre-hydration paint uses
 * stale colors and the runtime injection visibly snaps them on mount.
 *
 * Regeneration (the preset table is TS, so the toolchain that can execute
 * it IS this runner — the vue-mirror discipline):
 *
 *   REGEN_THEME_VARS=1 \
 *     node_modules/.bin/vitest run src/theme/themeVarsCss.contract.test.ts
 *
 * The test executes the same composition any future generator would, so
 * the writer and the checker cannot disagree.
 */
const here = dirname(fileURLToPath(import.meta.url));
const cssPath = join(here, "..", "styles", "theme-vars.css");

describe("pre-rendered theme vars CSS (hikari#1546)", () => {
  const css = buildThemeVarsCss();

  it("matches the composition of the live preset table", () => {
    const checkedIn = readFileSync(cssPath, "utf8");
    if (checkedIn === css) return;
    // Drift: the preset table moved without a regen. Rewrite ONLY under the
    // explicit env (a stray REGEN_THEME_VARS in a normal run must not touch
    // the worktree silently), then re-read for a real assertion — the write
    // happens AFTER the drift is established, never before the compare.
    // MUT:mut-regen-write-order — reverting to write-before-compare silences
    // this test entirely (the round-1 review footgun).
    if (process.env.REGEN_THEME_VARS === "1") {
      writeFileSync(cssPath, css);
      expect(readFileSync(cssPath, "utf8"), "regen wrote the composition").toBe(css);
      console.log(`REGEN: rewrote drifted ${cssPath} (${css.length} bytes)`);
      return;
    }
    expect(checkedIn).toBe(css);
  });

  it("covers both modes with the core color tokens", () => {
    expect(css).toContain('html[data-mode="dark"]');
    expect(css).toContain('html[data-mode="light"]');
    // The slots with no per-component CSS fallback — a missing one leaves
    // the unthemed flash hikari#1546 describes, so each is load-bearing.
    for (const slot of [
      "--color-primary",
      "--color-text",
      "--color-background",
      "--color-surface",
      "--color-muted",
      "--color-border",
    ]) {
      expect(css, `${slot} must be pre-rendered`).toContain(`${slot}:`);
    }
  });
});
