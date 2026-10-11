import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Static pins for the admin header's chrome geometry (2026-09-28 user
 * report, R1 findings b/c: reverting either the avatar→title gap or the
 * 28px icon-button box kept the whole suite green — the two values the
 * user explicitly asked for had no red-if-broken evidence). happy-dom
 * has no layout engine, so — headerAvatarGeometry-style — these read the
 * declarations themselves; they fail when the values move, disappear or
 * stop reading the way they read here, and a deliberate rewrite is
 * expected to update them.
 */

const here = dirname(fileURLToPath(import.meta.url));

/** Declarations of the rule whose prelude IS `selector` (whole-prelude
 *  match, comments stripped), as [prop, value] pairs; null when absent. */
function ruleDeclarations(source: string, selector: string): Array<[string, string]> | null {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
  for (let at = code.indexOf(selector); at >= 0; at = code.indexOf(selector, at + 1)) {
    const open = code.indexOf("{", at + selector.length);
    if (open < 0) continue;
    if (code.slice(at + selector.length, open).trim() !== "") continue;
    let boundary = at - 1;
    while (boundary >= 0 && !"}{;".includes(code[boundary])) boundary -= 1;
    if (code.slice(boundary + 1, at).replace(/\s+/g, " ").trim() !== "") continue;
    // Top-level rules only: a nested occurrence (the ≤767px phone band)
    // must not satisfy the desktop pins.
    if (braceDepthAt(code, at) !== 0) continue;
    const body = code.slice(open + 1, code.indexOf("}", open));
    const out: Array<[string, string]> = [];
    for (const part of body.split(";")) {
      const m = /^\s*([-a-zA-Z]+)\s*:\s*([\s\S]+?)\s*$/.exec(part);
      if (m) out.push([m[1], m[2].replace(/\s+/g, " ")]);
    }
    return out;
  }
  return null;
}


/** Brace depth of `code` at character index `at` — 0 = top level, ≥1 =
 *  nested inside an at-block (e.g. the ≤767px phone band's @media). */
function braceDepthAt(code: string, at: number): number {
  let depth = 0;
  for (let i = 0; i < at; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}") depth -= 1;
  }
  return depth;
}

const adminTokens = readFileSync(join(here, "..", "styles", "admin-tokens.scss"), "utf8");
const iconButtonVars = readFileSync(join(here, "HkIconButtonVars.scss"), "utf8");
const iconButton = readFileSync(join(here, "HkIconButton.tsx"), "utf8");

/** Every rule whose prelude IS `selector` (whole-prelude match, comments
 *  stripped) — used for the phone band, where the same prelude appears
 *  both at top level (desktop) and inside the ≤767px media block. */
function allRuleDeclarations(
  source: string,
  selector: string,
): Array<{ nested: boolean; decls: Array<[string, string]> }> {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Array<{ nested: boolean; decls: Array<[string, string]> }> = [];
  for (let at = code.indexOf(selector); at >= 0; at = code.indexOf(selector, at + 1)) {
    const open = code.indexOf("{", at + selector.length);
    if (open < 0) continue;
    if (code.slice(at + selector.length, open).trim() !== "") continue;
    let boundary = at - 1;
    while (boundary >= 0 && !"}{;".includes(code[boundary])) boundary -= 1;
    if (code.slice(boundary + 1, at).replace(/\s+/g, " ").trim() !== "") continue;
    const nested = braceDepthAt(code, at) > 0;
    const body = code.slice(open + 1, code.indexOf("}", open));
    const decls: Array<[string, string]> = [];
    for (const part of body.split(";")) {
      const m = /^\s*([-a-zA-Z]+)\s*:\s*([\s\S]+?)\s*$/.exec(part);
      if (m) decls.push([m[1], m[2].replace(/\s+/g, " ")]);
    }
    out.push({ nested, decls });
  }
  return out;
}

describe("admin header chrome geometry (the two user-requested fixes)", () => {
  it("keeps the console title at the panel's visual distance from the avatar (16px wing gap)", () => {
    // The frontend's workspace button sits a flex gap PLUS its own 8px
    // inline padding from the avatar (16px visual); the console title
    // carried only the 8px flex gap and visibly hugged the avatar.
    const rule = ruleDeclarations(adminTokens, ".s-admin-header-user");
    expect(rule, ".s-admin-header-user must be declared").not.toBeNull();
    expect(rule).toContainEqual(["gap", "var(--space-16)"]);
    // Balanced left wing (the centre group stays viewport-centred).
    expect(rule).toContainEqual(["flex", "1 1 0"]);
  });

  it("keeps the actions wing balanced (no margin-left:auto push) and the centre wing shrinkable", () => {
    const actions = ruleDeclarations(adminTokens, ".s-admin-header-actions");
    expect(actions, ".s-admin-header-actions must be declared").not.toBeNull();
    expect(actions).toContainEqual(["flex", "1 1 0"]);
    expect(actions).toContainEqual(["justify-content", "flex-end"]);
    // The old push would fight the centre wing for the middle.
    expect(actions).not.toContainEqual(["margin-left", "auto"]);
    const centre = ruleDeclarations(adminTokens, ".s-admin-header-center");
    expect(centre, ".s-admin-header-center must be declared").not.toBeNull();
    expect(centre).toContainEqual(["flex", "0 1 auto"]);
  });

  it("keeps the 28px icon-button step at the theme toggle's own box", () => {
    // HkThemeToggle's trigger buttons are 1.75rem (28px) boxes with 16px
    // glyphs — the size any header action that must read as the same
    // kind of button composes at.
    const rule = ruleDeclarations(iconButtonVars, ".hk-icon-button-28");
    expect(rule, ".hk-icon-button-28 must be declared").not.toBeNull();
    expect(rule).toContainEqual(["--hi-icon-button-size", "28px"]);
    // The component accepts the step.
    expect(iconButton).toMatch(/PropType<16 \| 24 \| 28 \| 32 \| 36 \| 40>/);
  });

  it("pins the phone band: wings keep their floors, the centre strip owns the overflow", () => {
    // User report 2026-10-12: on phones the balanced wings (flex 1 1 0 +
    // min-width 0) were squeezed BELOW the avatar's 28px floor by a wide
    // centre tab strip, and the strip painted straight over the avatar.
    // The ≤767px band must pin both wings and hand the leftover to the
    // centre (mirroring ChatLayout's own phone band) so the strip slides
    // inside its own box instead of over the avatar.
    const userRules = allRuleDeclarations(adminTokens, ".s-admin-header-user");
    const centreRules = allRuleDeclarations(adminTokens, ".s-admin-header-center");
    const actionsRules = allRuleDeclarations(adminTokens, ".s-admin-header-actions");
    // Exactly one NESTED occurrence (the phone band) per prelude.
    const phone = (rules: typeof userRules) => rules.filter((r) => r.nested).map((r) => r.decls);
    expect(phone(userRules)).toHaveLength(1);
    expect(phone(centreRules)).toHaveLength(1);
    expect(phone(actionsRules)).toHaveLength(1);
    expect(phone(userRules)[0]).toContainEqual(["flex", "0 0 auto"]);
    expect(phone(actionsRules)[0]).toContainEqual(["flex", "0 0 auto"]);
    expect(phone(centreRules)[0]).toContainEqual(["flex", "1 1 auto"]);
    expect(phone(centreRules)[0]).toContainEqual(["min-width", "0"]);
    expect(phone(centreRules)[0]).toContainEqual(["overflow", "hidden"]);
  });
});
