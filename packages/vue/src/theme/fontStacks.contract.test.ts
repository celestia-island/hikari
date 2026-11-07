import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { HIKARI_FONT_MONO, HIKARI_FONT_SANS } from "./fontContext";

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

  it("keeps --font-sans/--font-mono identical to the fontContext constants", () => {
    for (const path of SCSS_SOURCES) {
      expect(tokenFromScss(path, "font-sans")).toBe(HIKARI_FONT_SANS);
      expect(tokenFromScss(path, "font-mono")).toBe(HIKARI_FONT_MONO);
    }
  });

  it("orders every mono stack CJK-safe: a CJK UI face lands before the generic monospace catcher", () => {
    // The generic catcher is where Linux fontconfig roulette lives — a CJK
    // face must always be resolved before the stack reaches it. Known
    // positive: this exact predicate fails on the pre-2026-11-07 stack,
    // which ended `…"Microsoft YaHei", monospace` with no Linux CJK face.
    for (const stack of [HIKARI_FONT_MONO, ...SCSS_SOURCES.map((p) => tokenFromScss(p, "font-mono"))]) {
      const faces = stack.split(",").map((f) => f.trim().replace(/^"|"$/g, ""));
      const catcher = faces.indexOf("monospace");
      expect(catcher, "stack must end in the generic monospace catcher").toBe(faces.length - 1);
      const beforeCatcher = faces.slice(0, catcher);
      expect(
        beforeCatcher.some((f) => /Noto Sans CJK|PingFang|Microsoft YaHei|Hiragino Sans GB/.test(f)),
        `CJK UI face must precede the monospace catcher: ${stack}`,
      ).toBe(true);
    }
  });
});
