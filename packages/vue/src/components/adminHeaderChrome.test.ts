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

const adminTokens = readFileSync(join(here, "..", "styles", "admin-tokens.scss"), "utf8");
const iconButtonVars = readFileSync(join(here, "HkIconButtonVars.scss"), "utf8");
const iconButton = readFileSync(join(here, "HkIconButton.tsx"), "utf8");

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
});
