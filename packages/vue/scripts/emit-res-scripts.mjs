#!/usr/bin/env node
// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-V4.1-Flash) directed and reviewed by langyo — SySL-1.0 §2.3
// disclosure.
//
// Compile the authored TypeScript pre-paint assets in `res/` into the plain
// JavaScript files their consumers fetch.
//
//   res/<name>.ts  ->  res/<name>.js
//
// WHY THIS EXISTS
// The five files in `res/` are hikari's pre-paint runtime assets: classic
// scripts a host page loads with a bare `<script src>`, BEFORE any framework,
// bundle or module graph exists. They are authored sources (not generated),
// so the family's sourcing rule — authored code is TypeScript, the shipped
// artifact is JavaScript — applies to them like any other module. This script
// is the only thing that turns the first into the second.
//
// THE EMITTED BYTES ARE THE CONTRACT. These scripts are vendored into sibling
// repos (shittim-chest `packages/webui/src/res/`, plana `res/`) and served
// raw; hosts hash them into CSPs. `res/theme-loader.js` runs before any error
// boundary, so a behavioral change breaks first-paint theming on every host
// face. The design therefore is:
//
//   * the emitted `.js` stays COMMITTED, beside its `.ts`. `bootScriptsPlugin`
//     copies `res/*.js` from the SOURCE TREE at build time
//     (`packages/vue/src/plugins/bootScriptsPlugin.ts`), so whatever is in
//     the tree is what ships — a gitignored output would be a missing file on
//     any checkout that did not run node first, and a build that silently
//     skips a missing boot script is exactly the "unpainted first frame" bug
//     these assets exist to prevent.
//   * the transpile is SYNTAX ONLY. Type annotations vanish; the statement
//     surface does not move. A classic IIFE stays a classic IIFE, and a file
//     that is not a module never acquires an `export`.
//   * comments are NOT carried over. They are allowed to say "this is the
//     source, the .js is the build output" — words that must never end up in
//     the shipped bytes. The output gets one fixed header instead.
//   * the output is ASCII-only and deterministic: same input, same bytes, so
//     it can be hashed and committed (see the drift test).
//
// Usage (from packages/vue): pnpm run gen:res-scripts
// Also run by the drift test `src/res/authoredResScripts.test.ts`, which
// re-emits into memory and fails when the committed `.js` no longer matches.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

const HERE = dirname(fileURLToPath(import.meta.url));
/** packages/vue */
const VUE_DIR = resolve(HERE, "..");
/** repository root — `res/` lives beside `packages/` */
const REPO_ROOT = resolve(VUE_DIR, "../..");
const RES_DIR = resolve(REPO_ROOT, "res");

/** The one comment the emitted asset carries: provenance + build instruction. */
export const GENERATED_BANNER =
  "/* GENERATED from the TypeScript source of the same name in this directory. " +
  "Do not edit by hand. Regenerate with (from packages/vue): " +
  "pnpm run gen:res-scripts */";

/**
 * Every `res/<name>.ts` is a compile target. Discovered from the directory
 * rather than listed, so adding an asset cannot silently skip the build.
 */
export function authoredResScripts() {
  return readdirSync(RES_DIR)
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => {
      const stem = name.slice(0, -".ts".length);
      return {
        /** `theme-loader.ts` */
        source: name,
        /** `theme-loader` */
        stem,
        /** absolute source path */
        sourcePath: resolve(RES_DIR, name),
        /** absolute destination path (`theme-loader.js`) */
        outputPath: resolve(RES_DIR, stem + ".js"),
      };
    });
}

/**
 * The compile targets, computed once, for consumers that need "what was
 * built" without touching the disk: the drift test `src/res/
 * authoredResScripts.test.ts` imports this exact list so the build and its
 * guard cannot disagree about the file set.
 */
export const AUTHORED_RES_SCRIPTS = Object.freeze(authoredResScripts());

/** The compiler options that make the output a byte-stable classic script. */
const COMPILER_OPTIONS = {
  // ES2020 is the floor the family's bundles target (vite target es2020).
  // Nothing newer may appear in a pre-paint asset: a parse error voids the
  // surrounding inline bootstrap and the page keeps an unthemed first frame.
  target: ts.ScriptTarget.ES2020,
  // `ESNext` + `verbatimModuleSyntax` = emit module syntax exactly as written.
  // None of these files is a module, so nothing is rewritten and no `export`
  // or `define` wrapper is invented. (`module: None` would say the same and is
  // deprecated in TypeScript 6.)
  module: ts.ModuleKind.ESNext,
  verbatimModuleSyntax: true,
  importHelpers: false,
  // Comments are dropped: the authored headers discuss the source/build
  // split, which is not part of the shipped asset. GENERATED_BANNER replaces
  // them so a reader of the .js still learns where the truth lives.
  removeComments: true,
  newLine: ts.NewLineKind.LineFeed,
};

/**
 * Build-directive comments that must survive the transpile.
 *
 * They are not documentation — a bundler reads them. `/* @__PURE__ *\/` on a
 * call tells a downstream minifier (and tree-shaker) that the call has no side
 * effects and may be dropped if its result is unused; losing it silently turns
 * a dead computation into a kept one, or vice versa. `removedComments: true`
 * erases every comment, so these are re-attached below by AST position.
 *
 * Anything esbuild/rollup treat as a directive lives here. `@__NO_SIDE_EFFECTS__`
 * annotates a DECLARATION rather than a call; it is carried the same way.
 */
const BUILD_DIRECTIVE = /@__PURE__|@__NO_SIDE_EFFECTS__/;

/**
 * Every build-directive comment in `text`, with its offset and the offset of
 * the next real token after it.
 *
 * Uses the TS scanner rather than `getLeadingCommentRanges`, because a
 * directive can sit anywhere — `f(a, /* @__PURE__ *\/ new Date())` puts it in
 * the middle of an argument list, where the node-trivia API does not report it
 * at all (measured: `getLeadingCommentRanges` returns `undefined` for exactly
 * this position). The scanner reports every comment regardless of grammar.
 */
function scanBuildDirectives(text) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.ES2020,
    false,
    ts.LanguageVariant.Standard,
    text,
  );
  const found = [];
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const comment = scanner.getTokenText();
      if (BUILD_DIRECTIVE.test(comment)) {
        found.push({ offset: scanner.getTokenStart(), comment });
      }
    }
    token = scanner.scan();
  }
  return found;
}

/**
 * The comments in `outputText` survive neither the transpile nor the re-indent,
 * so directives are re-attached by ORDINAL: the Nth directive of the source
 * anchors the Nth candidate call expression of the output.
 *
 * WHY ORDINAL AND NOT AN OFFSET MAP. The transpile rewrites whitespace, adds
 * semicolons and strips types, so no source offset maps to an output offset.
 * But syntax-only transpilation preserves the ORDER (and count) of
 * `new`-expressions and call expressions, and a `@__PURE__` directive is only
 * ever attached to one of those. Anchoring by ordinal keeps the alignment
 * checkable: if the counts disagree the emit fails loudly instead of silently
 * attaching a directive to the wrong call — a dropped `@__PURE__` costs a
 * tree-shaking opportunity, a MISPLACED one can make a bundler delete real work.
 */
function reattachBuildDirectives(sourceText, outputText) {
  const directives = scanBuildDirectives(sourceText);
  if (directives.length === 0) return outputText;

  /** Offsets of the expressions a `@__PURE__` may annotate, in document order. */
  const annotatable = (file) => {
    const offsets = [];
    const visit = (node) => {
      if (ts.isNewExpression(node) || ts.isCallExpression(node)) {
        offsets.push(node.getStart(file));
      }
      node.forEachChild(visit);
    };
    visit(file);
    return offsets;
  };

  const sourceFile = ts.createSourceFile(
    "source.ts",
    sourceText,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TS,
  );
  const outputFile = ts.createSourceFile(
    "output.js",
    outputText,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.JS,
  );
  const sourceCalls = annotatable(sourceFile);
  const outputCalls = annotatable(outputFile);

  // The ordinal of each directive among the source's annotatable expressions:
  // the first one starting after the comment.
  const edits = directives.map((directive) => {
    const ordinal = sourceCalls.findIndex((offset) => offset > directive.offset);
    if (ordinal < 0) {
      throw new Error(
        `res script emit: build directive ${JSON.stringify(directive.comment)} ` +
          "has no call expression after it to annotate",
      );
    }
    if (ordinal >= outputCalls.length) {
      throw new Error(
        `res script emit: build directive #${ordinal} has no counterpart in ` +
          "the output — the transpile changed the program shape, so the " +
          "directive cannot be anchored safely",
      );
    }
    return { ordinal, offset: outputCalls[ordinal], comment: directive.comment };
  });

  // Applied back-to-front so earlier offsets stay valid.
  let patched = outputText;
  for (const edit of [...edits].sort((left, right) => right.offset - left.offset)) {
    patched =
      patched.slice(0, edit.offset) +
      `${edit.comment} ` +
      patched.slice(edit.offset);
  }
  return patched;
}

/**
 * Transpile one authored source to its classic-script JavaScript.
 *
 * Pure: no filesystem access, so the drift test and the build share exactly
 * one definition of "the emitted bytes".
 */
export function transpile(sourceText, fileName = "res-script.ts") {
  const result = ts.transpileModule(sourceText, {
    compilerOptions: COMPILER_OPTIONS,
    fileName,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length > 0) {
    const host = {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => REPO_ROOT,
      getNewLine: () => "\n",
    };
    throw new Error(
      "res script transpile failed:\n" +
        ts.formatDiagnosticsWithColorAndContext(errors, host),
    );
  }

  // tsc hoists `"use strict"` to the top of a transpiled module-shaped unit.
  // A source that opens with its own `"use strict";` already carries it (and
  // the emitted order must match the authored one, since `;(` insurance
  // depends on where the statement sits), so drop the synthesised copy.
  let body = result.outputText;
  if (!/^\s*"use strict";/.test(sourceText)) {
    body = body.replace(/^"use strict";\n/, "");
  }

  // Build-directive comments are erased by `removeComments`, but a downstream
  // bundler reads them. Put them back before the formatting pass below, so the
  // re-indent sees them in their final place.
  body = reattachBuildDirectives(sourceText, body);

  // tsc emits 4-space indentation. These are classic scripts that siblings
  // vendor and read, so the family's 2-space style is normalised back in; the
  // indentation is what keeps a documented literal shape (theme-loader's
  // `THEMES` table, read by a line-anchored contract test) legible.
  //
  // NEVER on a file with a multi-line template literal: a re-indent would edit
  // the literal's DATA (tauri-titlebar's stylesheet is a template string, one
  // literal newline apart from the CSS the shell actually paints). Those files
  // keep tsc's 4-space output, which is why the normaliser is a per-file
  // decision rather than a global formatting step.
  if (!hasMultilineTemplateLiteral(result.outputText)) {
    body = body
      .split("\n")
      .map((line) => {
        const indent = line.length - line.replace(/^ +/, "").length;
        return " ".repeat(indent / 2) + line.slice(indent);
      })
      .join("\n");
  }

  // The authored headers say "this is the source" — those words must not ship.
  const output = `${GENERATED_BANNER}\n${body}`;

  // A classic script may not carry non-ASCII: hosts serve it without a charset.
  for (let index = 0; index < output.length; index += 1) {
    if (output.charCodeAt(index) > 0x7f) {
      throw new Error(
        `${fileName}: emitted script is non-ASCII at index ${index} — a ` +
          "pre-paint asset must stay ASCII for host CSP hashing and charset-less serving",
      );
    }
  }
  return output;
}

/**
 * True when the script contains a template literal spanning more than one
 * line — i.e. the emitted text carries PROGRAM DATA that whitespace formatting
 * must not rewrite.
 *
 * Reads the AST rather than grepping for backticks, so a single-line template
 * (`` `${BAR_HEIGHT}px` ``) does not disable the normaliser for a whole file.
 */
function hasMultilineTemplateLiteral(code) {
  const sourceFile = ts.createSourceFile(
    "emit.ts",
    code,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TS,
  );
  let found = false;
  const visit = (node) => {
    // A TemplateExpression or NoSubstitutionTemplateLiteral whose text spans a
    // newline: the head/middle/tail segments carry it.
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      if (node.text.includes("\n")) found = true;
    } else if (ts.isTemplateExpression(node)) {
      const segments = [node.head, ...node.templateSpans.map((span) => span.literal)];
      if (segments.some((segment) => segment.text.includes("\n"))) found = true;
    }
    if (!found) node.forEachChild(visit);
  };
  visit(sourceFile);
  return found;
}

/** Compile every authored asset; returns the files written. */
export function emitAll() {
  const written = [];
  for (const entry of authoredResScripts()) {
    const output = transpile(
      readFileSync(entry.sourcePath, "utf8"),
      entry.source,
    );
    writeFileSync(entry.outputPath, output, "utf8");
    written.push({ ...entry, output });
  }
  return written;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  for (const entry of emitAll()) {
    process.stdout.write(
      `wrote ${entry.outputPath} (${entry.output.length} bytes from ${entry.source})\n`,
    );
  }
}
