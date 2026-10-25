import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Static pins for the window-controls chrome-edge contract (field report
 * 2026-10-25: the chest login strip rendered the standard HkWindowControls
 * cluster glued to the frame corner — zero right padding — while the chat
 * face had ruled the inset to 12px/8px and the console face kept a full
 * 24px of dead air; three faces, three ad-hoc computations of the same
 * number). happy-dom has no layout engine, so — adminHeaderChrome-style —
 * these read the declarations themselves; reverting any pinned value keeps
 * the rest of the suite green, so each pin below is the only red-if-broken
 * evidence for its contract. A deliberate rewrite is expected to update
 * them.
 *
 * Pinned here:
 *   1. the canonical tokens exist at :root (admin-tokens.scss top level —
 *      a nested declaration would not reach host headers);
 *   2. .s-glass-header--chrome sources BOTH bands from the tokens (the
 *      in-library implementation of the host contract);
 *   3. HkAdminHeader actually hangs the class from the `chrome` prop
 *      (the prop without the class, or vice versa, ships the 24px inset);
 *   4. the standard-mode HOST CONTRACT is documented on HkWindowControls
 *      (the doc is the contract's prose home — keep it in sync).
 */

const here = dirname(fileURLToPath(import.meta.url));

const adminTokens = readFileSync(join(here, "..", "styles", "admin-tokens.scss"), "utf8");
const adminHeader = readFileSync(join(here, "HkAdminHeader.tsx"), "utf8");
const windowControls = readFileSync(join(here, "HkWindowControls.tsx"), "utf8");

/** Brace depth of `code` at character index `at` (0 = top level). */
function braceDepthAt(code: string, at: number): number {
  let depth = 0;
  for (let i = 0; i < at; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}") depth -= 1;
  }
  return depth;
}

/** Declarations of every rule whose prelude IS `selector` (whole-prelude
 *  match, comments stripped), with whether it sits inside an at-block. */
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

describe("window-controls chrome-edge contract (the three faces had drifted)", () => {
  it("declares the canonical edge-inset tokens at :root top level", () => {
    // :root is a top-level rule; a token declared inside an at-block (or
    // renamed) silently falls every consumer back to its var() fallback —
    // the token must exist AND sit where it cascades.
    const rootRules = allRuleDeclarations(adminTokens, ":root").filter((r) => !r.nested);
    expect(rootRules.length, ":root must be declared at top level").toBeGreaterThan(0);
    const joined = rootRules.flatMap((r) => r.decls);
    expect(joined).toContainEqual(["--hk-window-controls-edge-inset", "0.75rem"]);
    expect(joined).toContainEqual(["--hk-window-controls-edge-inset-compact", "0.5rem"]);
  });

  it("sources the chrome header's desktop inset from the token (logical property)", () => {
    // padding-INLINE-END, not padding-right: in a dir="rtl" host the
    // caption row flips to the visual left and the inset must flip with
    // it (same reasoning as the RTL-mirrored titlebar close button).
    const rules = allRuleDeclarations(adminTokens, ".s-glass-header.s-glass-header--chrome").filter(
      (r) => !r.nested,
    );
    expect(rules.length, ".s-glass-header--chrome must be declared at top level").toBe(1);
    expect(rules[0].decls).toContainEqual([
      "padding-inline-end",
      "var(--hk-window-controls-edge-inset, 0.75rem)",
    ]);
  });

  it("sources the chrome header's ≤1023px inset from the compact token", () => {
    const rules = allRuleDeclarations(adminTokens, ".s-glass-header.s-glass-header--chrome").filter(
      (r) => r.nested,
    );
    expect(rules.length, "the compact band must override the chrome inset").toBe(1);
    expect(rules[0].decls).toContainEqual([
      "padding-inline-end",
      "var(--hk-window-controls-edge-inset-compact, 0.5rem)",
    ]);
  });

  it("hangs the chrome class from the HkAdminHeader chrome prop", () => {
    // The prop without the class (or the class without a producer) leaves
    // the console face on the base 24px inset — both halves are the pin.
    expect(adminHeader).toMatch(/chrome:\s*\{\s*type:\s*Boolean,\s*default:\s*false\s*\}/);
    expect(adminHeader).toMatch(
      /props\.chrome\s*\?\s*"s-glass-header--chrome"\s*:\s*""/,
    );
  });

  it("documents the standard-mode host contract on HkWindowControls", () => {
    // The doc comment is the contract's prose home: the token name and the
    // never-flush rule must stay stated where hosts read the component.
    expect(windowControls).toContain("HOST CONTRACT");
    expect(windowControls).toContain("--hk-window-controls-edge-inset");
    expect(windowControls).toContain("never rides the window edge");
  });
});
