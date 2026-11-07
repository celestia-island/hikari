import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { HIKARI_FONT_MONO, HIKARI_FONT_READING, HIKARI_FONT_SANS } from "./fontContext";

/**
 * Font-stack sync contract (2026-11-07): the static SCSS tokens and the
 * runtime fontContext constants are TWO copies of one truth, and they
 * drifted once — `--font-sans` carried the Linux CJK face
 * ("Noto Sans CJK SC") in both copies while `--font-mono` carried it only
 * in fontContext.ts, so any surface rendering the STATIC sheet (pre-boot
 * paint, or a downstream utility emitting its own literal stack) dropped
 * CJK text into a random platform mono on Linux. This file pins all
 * three copies to each other, so the next face can only be added in one
 * place by failing here.
 *
 * Known-positive anchor: the mono stack must keep a CJK UI face AFTER the
 * Latin mono faces and BEFORE the generic `monospace` catcher — that
 * ordering IS the CJK-safety contract (Latin glyphs mono, CJK glyphs
 * sans), not an accident of copy order.
 */

const here = dirname(fileURLToPath(import.meta.url));

const SCSS_SOURCES = [
  resolve(here, "../scale.scss"),
  // Vendored byte-identical copy for npm installs (see its header).
  resolve(here, "../styles/theme/scale.scss"),
];

function tokenFromScss(path: string, token: string): string {
  const css = readFileSync(path, "utf-8");
  const match = css.match(new RegExp(`--${token}:\\s*([^;]+);`));
  expect(match, `${path} must declare --${token}`).toBeTruthy();
  return match![1]!.trim();
}

describe("font stack sync (scale.scss ↔ fontContext.ts)", () => {
  it("keeps every vendored scale.scss copy byte-identical on the font block", () => {
    const blocks = SCSS_SOURCES.map((path) => {
      const css = readFileSync(path, "utf-8");
      const match = css.match(/--font-sans:[^;]+;\s*--font-reading:[^;]+;\s*--font-mono:[^;]+;/);
      expect(match, `${path} must declare the font token block`).toBeTruthy();
      return match![0];
    });
    for (const block of blocks.slice(1)) {
      expect(block).toBe(blocks[0]);
    }
  });

  it("keeps --font-sans/--font-reading/--font-mono identical to the fontContext constants", () => {
    for (const path of SCSS_SOURCES) {
      expect(tokenFromScss(path, "font-sans")).toBe(HIKARI_FONT_SANS);
      expect(tokenFromScss(path, "font-reading")).toBe(HIKARI_FONT_READING);
      expect(tokenFromScss(path, "font-mono")).toBe(HIKARI_FONT_MONO);
    }
  });

  it("keeps the Sass-variable fallback copies identical to the constants too", () => {
    // _hikari-vars.scss mirrors both stacks as Sass variables for the
    // `var(--font-*, …)` fallbacks component sheets use; normalize its
    // single-quoted faces before comparing.
    const normalize = (stack: string) => stack.replace(/'/g, '"').trim();
    const vars = readFileSync(resolve(here, "../components/_hikari-vars.scss"), "utf-8");
    const sassSans = vars.match(/\$hikari-font-family-sans:\s*([^;]+);/);
    const sassMono = vars.match(/\$hikari-font-family-mono:\s*([^;]+);/);
    expect(sassSans, "_hikari-vars.scss must declare the sans fallback").toBeTruthy();
    expect(sassMono, "_hikari-vars.scss must declare the mono fallback").toBeTruthy();
    expect(normalize(sassSans![1]!)).toBe(HIKARI_FONT_SANS);
    expect(normalize(sassMono![1]!)).toBe(HIKARI_FONT_MONO);
  });

  it("orders every mono stack CJK-safe: the Linux CJK face lands before the generic monospace catcher", () => {
    // The generic catcher is where Linux fontconfig roulette lives — the
    // Linux-reachable CJK face must always be resolved before the stack
    // reaches it. Known positive: this exact predicate FAILS on the
    // pre-2026-11-07 stack (`…"PingFang SC", "Microsoft YaHei",
    // monospace`) — "PingFang SC" / "Microsoft YaHei" don't exist on
    // Linux builds, so a predicate accepting ANY CJK face there would
    // have passed the stack that caused the incident. Only the
    // Linux-coverable face satisfies it.
    for (const stack of [HIKARI_FONT_MONO, ...SCSS_SOURCES.map((p) => tokenFromScss(p, "font-mono")),]) {
      const faces = stack.split(",").map((f) => f.trim().replace(/^"|"$/g, ""));
      const catcher = faces.indexOf("monospace");
      expect(catcher, "stack must end in the generic monospace catcher").toBe(faces.length - 1);
      const beforeCatcher = faces.slice(0, catcher);
      expect(
        beforeCatcher.some((f) => /Noto Sans CJK/.test(f)),
        `Linux CJK face must precede the monospace catcher: ${stack}`,
      ).toBe(true);
    }
  });
});
