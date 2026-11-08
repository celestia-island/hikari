import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for the avatar letter-fallback optical
 * centering (2026-11-08 user report: 头像首字母偏下).
 *
 * Flex centering centers the LINE box, but a capital glyph sits on the
 * baseline — below the line box's geometric center on every UI font
 * whose ascent exceeds its descent (Noto Sans CJK ≈0.065em, Windows
 * Segoe UI ≈0.064em). The fix trims the line box to [cap-top, baseline]
 * with `text-box: trim-both cap alphabetic` under an @supports guard
 * (trim only reaches BLOCK-container line boxes — Chromium ignores it on
 * a flex container's anonymous text block, verified headless — so the
 * height:100% fallbacks swap flex for block + align-content centering
 * under the guard; the auto-height menu fallback only adds the trim).
 *
 * Vitest stubs CSS, so the runtime suite can never catch a lost rule;
 * this guard pins the COMPILED sheets. All three sheets are mirrored
 * verbatim into the Rust crate (vue-mirror drift tests), which catches
 * one-sided edits — this file catches the block disappearing from BOTH
 * copies at once. Supported engines: Chromium 133+, Safari 18.2+,
 * Firefox 154+ (the guard tests the text-box shorthand; the longhands
 * exist in Chromium from 128) — anything older fails @supports and keeps
 * the flex anatomy (the pre-fix behavior), which is why the base rules
 * below are also pinned to keep their flex centering.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

const SUPPORTS_PREAMBLE = "@supports (text-box: trim-both cap alphabetic)";

const css = {
  avatar: compile(resolve(componentDir, "HkAvatar.scss"), { style: "expanded" }).css,
  menuIdentity: compile(resolve(componentDir, "HkMenuIdentityItem.scss"), { style: "expanded" }).css,
  adminTokens: compile(resolve(componentDir, "../styles/admin-tokens.scss"), { style: "expanded" }).css,
};

/** The body of the FIRST @supports block with exactly `preamble`, brace-matched. */
function supportsBody(sheetCss: string, preamble: string, label: string): string {
  const start = sheetCss.indexOf(preamble);
  expect(start, `${label}: ${preamble} block present in the compiled sheet`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  let open = -1;
  for (let at = start + preamble.length; at < sheetCss.length; at += 1) {
    const ch = sheetCss[at];
    if (ch === "{") {
      if (open < 0) open = at;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return sheetCss.slice(open + 1, at);
    }
  }
  throw new Error(`${label}: unterminated @supports block`);
}

/** The prelude of the FIRST rule inside the first `@supports` block with
 *  exactly `preamble` — the selector the guard actually targets. */
function guardedSelector(sheetCss: string, preamble: string, label: string): string {
  const body = supportsBody(sheetCss, preamble, label);
  const open = body.indexOf("{");
  return body.slice(0, open).trim();
}

/** The body of the top-level rule whose prelude is exactly `selector`. */
function ruleFor(sheetCss: string, selector: string, label: string): string {
  const needle = `${selector} {`;
  const start = sheetCss.indexOf(needle);
  expect(start, `${label}: ${selector} rule present in the compiled sheet`).toBeGreaterThanOrEqual(0);
  const close = sheetCss.indexOf("}", start);
  return sheetCss.slice(start, close + 1);
}

describe("avatar letter-fallback optical centering (text-box guard)", () => {
  it("positive control: the extractor finds the known base anatomy", () => {
    // If this stops matching, ruleFor/supportsBody are broken — fix the
    // extractor, not the assertions below.
    expect(ruleFor(css.avatar, ".hk-avatar", "avatar")).toContain("align-items: center");
    expect(ruleFor(css.adminTokens, ".s-user-avatar", "admin-tokens")).toContain("display: flex");
  });

  it("hk-avatar-fallback: guard block swaps flex for block + centered trimmed line", () => {
    const body = supportsBody(css.avatar, SUPPORTS_PREAMBLE, "avatar");
    expect(guardedSelector(css.avatar, SUPPORTS_PREAMBLE, "avatar")).toBe(".hk-avatar-fallback");
    expect(body).toContain("display: block");
    expect(body).toContain("align-content: center");
    expect(body).toContain("text-align: center");
    expect(body).toContain("text-box: trim-both cap alphabetic");
  });

  it("hk-avatar-fallback: base rule keeps the flex anatomy (no-trim engines)", () => {
    const rule = ruleFor(css.avatar, ".hk-avatar-fallback", "avatar");
    expect(rule).toContain("display: flex");
    expect(rule).toContain("align-items: center");
    expect(rule).toContain("justify-content: center");
  });

  it("s-user-avatar: guard block swaps flex for block + centered trimmed line", () => {
    const body = supportsBody(css.adminTokens, SUPPORTS_PREAMBLE, "admin-tokens");
    expect(guardedSelector(css.adminTokens, SUPPORTS_PREAMBLE, "admin-tokens")).toBe(".s-user-avatar");
    expect(body).toContain("display: block");
    expect(body).toContain("align-content: center");
    expect(body).toContain("text-align: center");
    expect(body).toContain("text-box: trim-both cap alphabetic");
  });

  it("s-user-avatar: base rule keeps the flex anatomy (no-trim engines)", () => {
    const rule = ruleFor(css.adminTokens, ".s-user-avatar", "admin-tokens");
    expect(rule).toContain("display: flex");
    expect(rule).toContain("align-items: center");
    expect(rule).toContain("justify-content: center");
  });

  it("menu identity fallback: trim only — auto-height flex item needs no anatomy swap", () => {
    const body = supportsBody(css.menuIdentity, SUPPORTS_PREAMBLE, "menu-identity");
    expect(guardedSelector(css.menuIdentity, SUPPORTS_PREAMBLE, "menu-identity")).toBe(
      ".hk-menu-identity-item__fallback",
    );
    expect(body).toContain("text-box: trim-both cap alphabetic");
    expect(body).not.toContain("display:");
  });
});

describe("avatar letter-fallback sheets stay mirrored", () => {
  // The Rust crate compiles vendored copies of these sheets; the drift
  // tests over there fail on one-sided edits. This re-reads the SOURCE
  // files to pin the mirror files' presence next to the pinned behavior,
  // so deleting the guard from BOTH copies cannot slip through silently
  // (drift tests compare copies — they stay green when both sides lose
  // the block together).
  it("vendored mirror copies still carry the guard (double-sided delete tripwire)", () => {
    const crateRoot = resolve(componentDir, "../../../components/src/styles/vue-mirror");
    for (const rel of [
      "components/HkAvatar.scss",
      "components/HkMenuIdentityItem.scss",
      "styles/admin-tokens.scss",
    ]) {
      const mirror = readFileSync(resolve(crateRoot, rel), "utf8");
      expect(mirror, `${rel} mirror carries the guard`).toContain("text-box: trim-both cap alphabetic");
    }
  });
});
