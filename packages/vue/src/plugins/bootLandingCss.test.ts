// @vitest-environment node
// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-V4.1-Flash) directed and reviewed by langyo — SySL-1.0 §2.3
// disclosure.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as sass from "sass";
import { describe, expect, it } from "vitest";

import { stockDefaultPreset } from "../theme/presets";
import { BOOT_LANDING_CSS } from "./bootLandingCss.mjs";

/**
 * The boot failure panel's stylesheet drift guard.
 *
 * The pre-boot panel cannot mount Vue, but it must read as the SAME surface
 * as hikari's in-app error landing. So instead of hand-copying token values
 * (the pre-0.55.3xx `.hk-boot-recovery` card did), the panel ships the LIVE
 * component sheets: `boot-landing.scss` @uses theme/channels, theme/scale,
 * HkErrorLanding and HkButton, and `scripts/gen-boot-landing-css.mjs`
 * compiles that entry into `bootLandingCss.mjs`, which the plugin inlines.
 *
 * This suite recompiles the entry with the same sass a consumer uses and
 * fails when the checked-in module no longer matches — the guard that makes
 * "reuse the component" a mechanical property instead of a promise (edit the
 * component sheet and the panel follows through one regeneration).
 *
 * Scope note (2026-11-07 mutation round): the entry @uses the VENDORED
 * `styles/theme/scale.scss`, not the canonical `src/scale.scss` — drifting
 * the canonical copy alone turns fontStacks.contract.test.ts red (three
 * arms) but is invisible here. Token edits: change src/scale.scss, re-copy
 * to the vendored path, regenerate this artifact — all three guards then
 * see the same bytes.
 *
 * Regenerate with (from packages/vue): pnpm run gen:boot-landing-css
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(HERE, "..");

/** Compile the entry exactly the way the generator does. */
function compile(): string {
  const compiled = sass.compile(resolve(HERE, "boot-landing.scss"), {
    loadPaths: [
      SRC_DIR,
      resolve(SRC_DIR, "styles"),
      resolve(SRC_DIR, "styles", "theme"),
    ],
    style: "compressed",
    silenceDeprecations: ["import", "global-builtin", "legacy-js-api"],
  });
  return compiled.css.replace(/^@charset "UTF-8";/, "").trim();
}

/** `r g b` channel string a theme token writes into the seed channels. */
function channel(token: { r: number; g: number; b: number }): string {
  return token.r + " " + token.g + " " + token.b;
}

describe("boot failure panel stylesheet", () => {
  it("is the current compilation of boot-landing.scss", () => {
    expect(BOOT_LANDING_CSS).toBe(compile());
  });

  it("ships the component's own classes, not a bespoke panel", () => {
    for (const selector of [
      ".hk-error-landing{",
      ".hk-error-landing__card",
      ".hk-error-landing__icon",
      ".hk-error-landing__title",
      ".hk-error-landing__desc",
      ".hk-error-landing__actions",
      ".hk-error-landing.is-inline",
      ".hk-btn-sm",
      ".hk-btn-primary",
    ]) {
      expect(BOOT_LANDING_CSS, selector).toContain(selector);
    }
    // The retired hand-rolled panel class must never come back.
    expect(BOOT_LANDING_CSS).not.toContain("hk-boot-recovery");
  });

  it("carries the light seed channels the app paints before theme init", () => {
    expect(BOOT_LANDING_CSS).toContain("--color-primary: 122 162 247");
    expect(BOOT_LANDING_CSS).toContain("--color-surface: 255 255 255");
    expect(BOOT_LANDING_CSS).toContain("--color-text: 30 30 30");
  });

  it("maps the default dark palette under prefers-color-scheme", () => {
    // The panel paints before initTheme(); the media block is the only dark
    // signal a dead page has. Its values are the "default" preset's dark
    // tokens (src/theme/presets.ts) — the same palette theme-loader.js paints
    // the loader with — so the guard compares against the live preset instead
    // of restating literals.
    expect(BOOT_LANDING_CSS).toContain("prefers-color-scheme: dark");
    const dark = stockDefaultPreset.dark;
    const tokens: Array<[string, { r: number; g: number; b: number }]> = [
      ["--color-primary", dark.primary],
      ["--color-background", dark.background],
      ["--color-surface", dark.surface],
      ["--color-text", dark.text],
      ["--color-muted", dark.muted],
      ["--color-border", dark.border],
      ["--color-error", dark.error],
    ];
    for (const [name, token] of tokens) {
      expect(BOOT_LANDING_CSS, name).toContain(name + ": " + channel(token));
    }
    // Solid fills flip to the dark ink the pale primary needs.
    const onSolid = dark.onSolidText ?? { r: 255, g: 255, b: 255 };
    expect(BOOT_LANDING_CSS).toContain(
      "--color-on-solid-text: " + channel(onSolid),
    );
  });

  it("is ASCII-only and cannot terminate the inline <script> tag", () => {
    for (let i = 0; i < BOOT_LANDING_CSS.length; i += 1) {
      const code = BOOT_LANDING_CSS.charCodeAt(i);
      const printable = code === 9 || code === 10 || (code >= 32 && code <= 126);
      if (!printable) {
        throw new Error(
          "non-ASCII character at index " + i + ": " + JSON.stringify(BOOT_LANDING_CSS[i]),
        );
      }
    }
    expect(BOOT_LANDING_CSS.toLowerCase()).not.toContain("</script");
    expect(BOOT_LANDING_CSS).not.toContain("<!--");
    // @charset means nothing inside the inline <style> the panel appends.
    expect(BOOT_LANDING_CSS.startsWith("@charset")).toBe(false);
  });
});
