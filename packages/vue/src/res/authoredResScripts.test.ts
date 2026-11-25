import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

// The emitter lives beside the other packages/vue script drivers and is the
// ONE definition of how `res/<name>.ts` becomes `res/<name>.js` — the build and
// this guard must never disagree, so both import it rather than re-deriving.
import { AUTHORED_RES_SCRIPTS, transpile } from "../../scripts/emit-res-scripts.mjs";

/**
 * The two-sided lock for the pre-paint `res/` scripts.
 *
 * These five files are authored as TypeScript and SHIPPED as JavaScript: a
 * host loads them with a bare `<script src>` before any framework, and the
 * sibling repos vendor the `.js` verbatim (shittim-chest `packages/webui/src/
 * res/`, plana `res/`). The pairing is therefore bidirectional, and this suite
 * is both directions of it:
 *
 * 1. **A source edit without a regen.** [`the committed javascript is what the
 *    typescript compiles to`] re-transpiles each `.ts` in memory and compares
 *    it, byte for byte, with the committed `.js`. Editing the source and
 *    forgetting `pnpm run gen:res-scripts` leaves the shipped asset stale — the
 *    half of the pair every host actually executes — so this goes red.
 *
 * 2. **A hand edit of the emitted file.** Same test, same red: the `.js` is
 *    reproducible from the `.ts`, and a patch applied only to it cannot survive.
 *
 * Resolve either by editing the `.ts` and running `pnpm run gen:res-scripts`
 * (from `packages/vue`). Never by editing the `.js`.
 *
 * WHY THE EMITTED FILES ARE COMMITTED AT ALL (the design decision this file
 * enforces): `bootScriptsPlugin` copies `res/*.js` from the SOURCE TREE into the
 * build output, and consumers range from a full vite build to a host that
 * merely serves the directory. A gitignored output would mean a checkout that
 * never ran node ships a page with no pre-paint theme loader — the exact
 * "unpainted first frame" failure the module exists to prevent — and
 * `bootScriptsPlugin` skips a missing source silently, so the breakage would be
 * invisible until someone looked at a first paint. Committing the artifact plus
 * this lock gets both: the tree is always shippable, and it can never drift from
 * its source.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
/** packages/vue */
const VUE_DIR = resolve(HERE, "../..");
/** repository root */
const REPO_ROOT = resolve(VUE_DIR, "../..");

interface ResScript {
  /** `theme-loader` */
  readonly stem: string;
  readonly sourcePath: string;
  readonly outputPath: string;
}

const scripts = AUTHORED_RES_SCRIPTS as readonly ResScript[];

/** The exact result of a transpile, plus the bytes the emitter would write. */
function regen(script: ResScript): string {
  return transpile(readFileSync(script.sourcePath, "utf8"), `${script.stem}.ts`);
}

describe("authored res scripts: source/output pairing", () => {
  it("discovers every pre-paint asset as a .ts/.js pair", () => {
    // A new `res/<name>.ts` that the emitter's directory scan did not pick up
    // would ship with no `.js` at all, so the pair set is pinned rather than
    // implied.
    expect(scripts.map((script) => script.stem).sort()).toEqual([
      "browser-check",
      "loader-dismiss",
      "os-prefs",
      "tauri-titlebar",
      "theme-loader",
    ]);
  });

  it("keeps every compiled asset in sync with its TypeScript source", () => {
    const stale: string[] = [];
    for (const script of scripts) {
      const committed = readFileSync(script.outputPath, "utf8");
      const expected = regen(script);
      if (committed !== expected) {
        stale.push(
          `res/${script.stem}.js is out of date with res/${script.stem}.ts ` +
            `(run \`pnpm run gen:res-scripts\` from packages/vue)`,
        );
      }
    }
    expect(stale, "every res/*.js is the byte-exact output of its .ts").toEqual([]);
  });

  it("is deterministic: recompiling twice yields identical bytes", () => {
    // The bytes are hashed into host CSPs, so "same input, same output" is a
    // contract, not a nicety.
    for (const script of scripts) {
      expect(regen(script), `res/${script.stem}.js recompiles deterministically`).toBe(
        regen(script),
      );
    }
  });

  it.each([
    "browser-check",
    "loader-dismiss",
    "os-prefs",
    "tauri-titlebar",
    "theme-loader",
  ])("emits res/%s.js as valid, parseable JavaScript", (stem) => {
    const script = scripts.find((candidate) => candidate.stem === stem);
    if (!script) throw new Error(`res/${stem}.ts is not in the emitter's target list`);
    const output = readFileSync(script.outputPath, "utf8");

    // A parse error in a pre-paint asset voids the whole inline bootstrap, so
    // the syntax floor is asserted here rather than trusted.
    const sourceFile = ts.createSourceFile(
      `${stem}.js`,
      output,
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.JS,
    );
    const diagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] })
      .parseDiagnostics ?? [];
    expect(
      diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")),
      `res/${stem}.js parses at the ES2020 floor`,
    ).toEqual([]);
  });

  it.each([
    "browser-check",
    "loader-dismiss",
    "os-prefs",
    "tauri-titlebar",
    "theme-loader",
  ])("keeps res/%s.js a classic script: ASCII-only, no module syntax", (stem) => {
    const script = scripts.find((candidate) => candidate.stem === stem);
    if (!script) throw new Error(`res/${stem}.ts is not in the emitter's target list`);
    const output = readFileSync(script.outputPath, "utf8");

    // Servers answer these with `text/html`-style charset-less headers and hosts
    // hash the bytes into a CSP: a non-ASCII byte is both a mojibake risk and a
    // silent hash change.
    expect(Array.from(output).some((character) => character.charCodeAt(0) > 0x7f)).toBe(false);
    // A host loads this with a bare <script src>; an `export`/`import` would
    // make the browser reject the file as a module it was never tagged as.
    expect(output).not.toMatch(/^\s*(export|import)\s/m);
    // Provenance must travel with the artifact: a reader of the .js has to be
    // able to find its source.
    expect(output).toContain("GENERATED from the TypeScript source");
  });
});

describe("authored res scripts: source tree wiring", () => {
  it("keeps the authored sources inside the repository", () => {
    for (const script of scripts) {
      expect(script.sourcePath.startsWith(REPO_ROOT), `${script.stem}.ts lives in the repo`).toBe(
        true,
      );
      expect(script.outputPath.startsWith(REPO_ROOT), `${script.stem}.js lives in the repo`).toBe(
        true,
      );
    }
  });

  it("does not leave a stray .js without its .ts", () => {
    // The reverse of the pair set above: a `.js` in res/ with no `.ts` would be
    // an un-authored hand-kept asset sneaking past the sourcing rule.
    const present = readdirSync(resolve(REPO_ROOT, "res"))
      .filter((name) => name.endsWith(".js"))
      .map((name) => name.slice(0, -".js".length))
      .sort();
    expect(present).toEqual(scripts.map((script) => script.stem).sort());
  });
});
