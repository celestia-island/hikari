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
  });

  it("reserves the drawer face's workspace-switcher slot at the trigger's own footprint", () => {
    // 2026-10-29 user direction: the chat header's left wing is avatar +
    // ws-trigger, and that wing's min-content floor is what stops the
    // balanced grid's centre strip from sliding into the space on a
    // phone. The console drawer face (no title, no workspace concept)
    // must keep the slot as a blank of the trigger's own 28px box —
    // dropping the rule would drop the floor and the strip would hug
    // the avatar again.
    const rule = ruleDeclarations(adminTokens, ".s-admin-header-ws-slot");
    expect(rule, ".s-admin-header-ws-slot must be declared").not.toBeNull();
    expect(rule).toContainEqual(["width", "var(--space-28)"]);
    expect(rule).toContainEqual(["flex-shrink", "0"]);
  });

  it("hangs the shared balanced-header grid contract (the ONE header layout)", () => {
    // User report 2026-10-15: the console's header-centre tab strip sat
    // LEFT of centre on phones (drawer mode hides the title, so the left
    // wing is just the avatar while three icon buttons sit right) while
    // the frontend's strip read centred — two per-band flex dialects had
    // drifted from the same idea. Both faces now hang the ONE grid
    // contract: two EQUAL 1fr side tracks (true centring regardless of
    // wing content) with min-content floors (wings can never be squeezed
    // out of existence) around a shrinkable centre column (the strip
    // slides inside its own box, edge fades + swipe).
    const balanced = ruleDeclarations(adminTokens, ".s-balanced-header");
    expect(balanced, ".s-balanced-header must be declared").not.toBeNull();
    expect(balanced).toContainEqual([
      "grid-template-columns",
      "minmax(min-content, 1fr) minmax(0, auto) minmax(min-content, 1fr)",
    ]);
    const start = ruleDeclarations(adminTokens, ".s-header-wing-start");
    expect(start, ".s-header-wing-start must be declared").not.toBeNull();
    // Each wing names its column EXPLICITLY: with auto-placement a
    // centre-less host (the vast majority of admin pages — most never
    // register a centre group) renders only two in-flow children and the
    // actions wing would fall into the MIDDLE track, drifting to the
    // viewport centre instead of hugging the right edge (R2, 2026-10-15).
    expect(start).toContainEqual(["grid-column", "1"]);
    expect(start).toContainEqual(["justify-self", "start"]);
    expect(start).toContainEqual(["overflow", "hidden"]);
    const centre = ruleDeclarations(adminTokens, ".s-header-wing-center");
    expect(centre, ".s-header-wing-center must be declared").not.toBeNull();
    // Default stretch, NOT justify-self: center: a centered item sizes by
    // fit-content, whose min-content floor (the full strip width) punches
    // the item past a shrunken middle track — the strip would paint over
    // the wings instead of scrolling inside its own box.
    expect(centre).toContainEqual(["grid-column", "2"]);
    expect(centre).toContainEqual(["min-width", "0"]);
    expect(centre).not.toContainEqual(["justify-self", "center"]);
    const end = ruleDeclarations(adminTokens, ".s-header-wing-end");
    expect(end, ".s-header-wing-end must be declared").not.toBeNull();
    expect(end).toContainEqual(["grid-column", "3"]);
    expect(end).toContainEqual(["justify-self", "end"]);
    expect(end).toContainEqual(["overflow", "hidden"]);
  });

  it("keeps the wings free of their own flex-geometry dialect (the grid owns it)", () => {
    // The flex era's per-wing declarations must stay gone: any return of
    // `flex` on a wing re-introduces a second geometry that drifts from
    // the shared grid (the 2026-10-15 skew).
    expect(ruleDeclarations(adminTokens, ".s-admin-header-user")).not.toContainEqual(["flex", "1 1 0"]);
    expect(ruleDeclarations(adminTokens, ".s-admin-header-actions")).not.toContainEqual(["flex", "1 1 0"]);
    expect(ruleDeclarations(adminTokens, ".s-admin-header-center")).not.toContainEqual(["flex", "0 1 auto"]);
    // The old push would fight the centre wing for the middle.
    expect(ruleDeclarations(adminTokens, ".s-admin-header-actions")).not.toContainEqual(["margin-left", "auto"]);
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

  it("keeps the phone band free of ad-hoc wing overrides (one geometry at every width)", () => {
    // The 2026-10-12 band pinned the wings and handed the leftover to
    // the centre; it fixed the avatar overlap but skewed the strip off
    // the viewport middle (user report 2026-10-15). The shared grid's
    // min-content floors + shrinkable centre column handle phones
    // intrinsically, so no per-band flex override may come back.
    const userRules = allRuleDeclarations(adminTokens, ".s-admin-header-user");
    const centreRules = allRuleDeclarations(adminTokens, ".s-admin-header-center");
    const actionsRules = allRuleDeclarations(adminTokens, ".s-admin-header-actions");
    for (const [name, rules] of [["user", userRules], ["centre", centreRules], ["actions", actionsRules]] as const) {
      expect(rules.filter((r) => r.nested), `${name}: no band-nested rules may remain`).toHaveLength(0);
      for (const r of rules) {
        expect(r.decls.map((d) => d[0]), `${name}: no flex geometry may remain`).not.toContain("flex");
      }
    }
  });
});
