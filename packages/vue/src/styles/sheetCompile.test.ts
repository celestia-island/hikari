import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as sass from "sass";
import { describe, expect, it } from "vitest";

/**
 * Every shipped sheet must compile (2026-09-17).
 *
 * Regression: hikari #564 ("Highlight the timeline step on hover instead of
 * scaling it") left a stray `}` at the end of `HkTimeline.scss`. The sheet
 * was uncompilable from the moment it merged and nothing noticed, because
 *   · the entry sheet (`styles/index.scss`) does not `@use` component sheets,
 *   · component tests import the TSX, never the SCSS,
 *   · and the one contract that DOES compile sheets
 *     (`components/textClip.contract.test.ts`) only compiles the ones it
 *     reviews — HkTimeline is not among them.
 * So the first thing to compile it would have been a downstream app.
 *
 * This guard compiles every `.scss` under `src/` with the same sass a
 * consumer uses (144 sheets, ~1s), which is cheap enough to run always.
 * A failure names the file and sass's own message.
 */

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function sheetsIn(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sheetsIn(path));
    else if (entry.endsWith(".scss")) out.push(path);
  }
  return out;
}

function compile(file: string): string | null {
  try {
    sass.compile(file, {
      loadPaths: [srcDir, join(srcDir, "styles"), join(srcDir, "styles", "theme")],
      // `@import` and the JS-API bridge are deprecated, not errors: the
      // legacy Gen-1 sheets still use them and that is not this guard's job.
      silenceDeprecations: ["import", "global-builtin", "legacy-js-api"],
    });
    return null;
  } catch (error) {
    return String((error as Error).message).split("\n")[0];
  }
}

describe("every shipped stylesheet compiles", () => {
  const sheets = sheetsIn(srcDir);

  it("walks the whole source tree (positive control)", () => {
    // A mis-rooted walk would make the sweep below pass vacuously.
    expect(sheets.length, "sheets found under src/").toBeGreaterThan(100);
  });

  it("reports failures (instrument self-test)", () => {
    expect(compile(resolve(srcDir, "styles", "index.scss")), "the entry sheet compiles").toBeNull();
    // The instrument must be able to see the defect class it guards: sass
    // rejects an unbalanced block, and this is exactly the error #564 shipped.
    expect(() => sass.compileString(".hk-probe { color: red;\n}\n}")).toThrow(/unmatched/i);
  });

  it("compiles every sheet, naming the ones that fail", () => {
    const failures = sheets
      .map((file) => ({ file: relative(srcDir, file), error: compile(file) }))
      .filter((row): row is { file: string; error: string } => row.error !== null);
    expect(failures, failures.map((f) => `${f.file}: ${f.error}`).join("\n")).toEqual([]);
  });
});
