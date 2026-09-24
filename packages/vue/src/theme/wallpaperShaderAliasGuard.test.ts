import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Why this guard exists: hikari ships TS source with ZERO path aliases.
// A module that imports a consumer-side alias (`@shaders/shaders`,
// `@wallpapers/wallpapers`, …) compiles fine inside the host that
// defines the alias and breaks every OTHER consumer's vite/tsconfig —
// the wallpaper shader adoption (#657's backdrop deliberately took its
// driver through a `createSurface` prop for exactly this reason). The
// shader modules added alongside this test are the first hikari modules
// that would be tempted; the rule is now mechanically enforced for the
// whole src tree.

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** A quoted module specifier that resolves through a path alias — the
 *  form every alias import must take (static, dynamic, require-like). */
const ALIAS_SPECIFIER_RE = /["']@(?:shaders|wallpapers)\//;

/** Strip full-line `//` comments and `/* … *&#47;` blocks so prose and
 *  commented-out code do not count (registerAnimations.test.ts holds
 *  the same line for its keyframe scan). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Lines of a source file that reference an alias specifier, in order. */
function aliasLines(src: string): string[] {
  return src
    .split("\n")
    .filter((line) => ALIAS_SPECIFIER_RE.test(line))
    .map((line) => line.trim());
}

/** Recursively collect TS/TSX/Vue sources under the package src tree.
 *  This test's own file is skipped: its positive-control fixtures are
 *  RUNTIME strings (not comments), and the guard would flag itself —
 *  the thing under test is never its own subject (registerAnimations
 *  holds the same line for the animation dir). */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      out.push(...collectSourceFiles(p));
    } else if (/\.(ts|tsx|vue)$/.test(entry.name)) {
      if (p === path.resolve(fileURLToPath(import.meta.url))) continue;
      out.push(p);
    }
  }
  return out;
}

describe("hikari src carries no consumer-side alias imports", () => {
  // ── Self-proofs (an extractive check with 0 hits must first prove it
  //    CAN hit — otherwise the pattern is silently broken and the guard
  //    is a tautology) ────────────────────────────────────────────────
  it("self-proof: the matcher catches every alias-import shape it exists for", () => {
    const positives = [
      'import * as s from "@shaders/shaders";',
      "import meta from '@shaders/themes.json';",
      'import("@wallpapers/wallpapers").then((m) => m.pack());',
      'const r = require("@shaders/shaders");',
    ];
    for (const line of positives) {
      expect(aliasLines(line)).toHaveLength(1);
    }
  });

  it("self-proof: comment stripping removes prose mentions without touching live code", () => {
    const sample = [
      "/** Chest's `@shaders/shaders` alias is consumer-side. */",
      "// import x from \"@shaders/shaders\"; // retired experiment",
      'import { onFrame } from "../runtime/animationBus";',
      'import x from "@shaders/shaders";',
    ].join("\n");
    const hits = aliasLines(stripComments(sample));
    expect(hits).toEqual(['import x from "@shaders/shaders";']);
  });

  it("self-proof: the walk covers the tree and includes the shader modules", () => {
    const files = collectSourceFiles(srcDir);
    // The walk is not accidentally empty or rooted somewhere else: the
    // baseline tree is hundreds of files and MUST contain the two
    // modules this guard was written for (and, per the skip rule above,
    // must NOT contain this test's own file).
    expect(files.length).toBeGreaterThan(200);
    const names = files.map((f) => path.basename(f));
    for (const required of ["wallpaperShaderPresets.ts", "wallpaperShaderRenderer.ts"]) {
      expect(names).toContain(required);
    }
    expect(names).not.toContain("wallpaperShaderAliasGuard.test.ts");
  });

  // ── The actual invariant ────────────────────────────────────────────
  it("no src file references an @shaders/@wallpapers alias specifier", () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(srcDir)) {
      const stripped = stripComments(readFileSync(file, "utf-8"));
      const hits = aliasLines(stripped);
      if (hits.length > 0) {
        offenders.push(`${path.relative(srcDir, file)}: ${hits[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
