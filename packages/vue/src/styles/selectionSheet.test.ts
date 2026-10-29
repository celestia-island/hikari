import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as sass from "sass";
import { describe, expect, it } from "vitest";

/**
 * Selection policy guard (2026-10-29 user direction).
 *
 * `selection.scss` flips the selection model from a blacklist (component
 * sheets opting out piecemeal; anything a sheet forgot shipped selectable)
 * to a whitelist: the root denies, editable controls / the `.hk-selectable`
 * content hook / pre-code conventions select again, and hikari's own
 * content-bearing components self-declare their re-enables in their sheets
 * (toast message, markdown body, diff code, json-tree rows, table opt-out).
 *
 * The contract under test, per half:
 *   - the canonical composition loads the sheet SECOND (right after the
 *     reset, before any theme/component sheet can override);
 *   - the compiled policy carries the root deny and every whitelist tier
 *     (assertions run on the COMPILED sheet — compressed drops both
 *     comment styles, so raw-text matching cannot pass on a commented-out
 *     rule);
 *   - the component re-enables really exist in the compiled component
 *     sheets, with the chrome halves still denied.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));
const srcDir = resolve(stylesDir, "..");

function read(path: string): string {
  return readFileSync(resolve(stylesDir, path), "utf8").replace(/\r\n/g, "\n");
}

function compile(path: string): string {
  return sass.compile(resolve(stylesDir, path), {
    loadPaths: [srcDir, join(srcDir, "components"), join(srcDir, "styles"), join(srcDir, "styles", "theme")],
    style: "compressed",
    silenceDeprecations: ["import", "global-builtin", "legacy-js-api"],
  }).css;
}

describe("selection policy sheet", () => {
  it("loads second in the canonical composition (right after the reset)", () => {
    const uses = read("index.scss")
      .split("\n")
      .filter((line) => line.startsWith('@use "./'))
      .map((line) => line.match(/^@use "([^"]+)"/)?.[1]);
    expect(uses[0]).toBe("./reset.scss");
    expect(uses[1]).toBe("./selection.scss");
  });

  it("denies selection at the root", () => {
    const css = compile("selection.scss");
    expect(css).toMatch(/html\s*\{[^}]*?-webkit-user-select:\s*none/);
    expect(css).toMatch(/html\s*\{[^}]*?user-select:\s*none/);
  });

  it("whitelists the editable controls, the content hook and code conventions", () => {
    const css = compile("selection.scss");
    // One grouped rule re-enables every tier; each selector must be in it.
    expect(css).toMatch(/input[^{]*textarea[^{]*select[^{]*\{[^}]*?-webkit-user-select:\s*text/);
    for (const selector of [
      "input",
      "textarea",
      "select",
      // Compressed output drops unnecessary attribute-quote characters.
      "contenteditable=false",
      ".hk-selectable",
      "pre",
      "code",
      "kbd",
      "samp",
    ]) {
      expect(css, `whitelist misses ${selector}`).toContain(selector);
    }
    expect(css).toMatch(/-webkit-user-select:\s*text/);
    expect(css).toMatch(/[^-]user-select:\s*text/);
  });

  it("re-enables the toast family message text (content, not chrome)", () => {
    const css = compile("../components/HkToast.scss");
    expect(css).toMatch(/\.hk-toast-message[^{]*\{[^}]*?-webkit-user-select:\s*text/);
    // The shell stays denied — only the message subtree selects.
    expect(css).toMatch(/\.hk-toast-item\s*\{[^}]*?user-select:\s*none/);
    const cssBlocking = compile("../components/HkBlockingToast.scss");
    expect(cssBlocking).toMatch(/\.hk-blocking-toast-title[^{]*\{[^}]*?user-select:\s*text/);
    expect(cssBlocking).toMatch(/\.hk-blocking-toast-message[^{]*\{[^}]*?user-select:\s*text/);
    const cssBox = compile("../components/HkMessageBox.scss");
    expect(cssBox).toMatch(/\.hk-message-box-text[^{]*\{[^}]*?user-select:\s*text/);
  });

  it("re-enables the markdown body and the diff code, keeping the diff gutter denied", () => {
    const css = compile("../components/HkMarkdownRenderer.scss");
    expect(css).toMatch(/\.hk-markdown\s*\{[^}]*?user-select:\s*text/);
    const cssDiff = compile("../components/HkDiffViewer.scss");
    expect(cssDiff).toMatch(/\.hk-diff-viewer__code[^{]*\{[^}]*?user-select:\s*text/);
    expect(cssDiff).toMatch(/\.hk-diff-viewer__no[^{]*\{[^}]*?user-select:\s*none/);
    expect(cssDiff).toMatch(/\.hk-diff-viewer__sign[^{]*\{[^}]*?user-select:\s*none/);
  });

  it("re-enables json-tree rows inside the denied pane chrome", () => {
    const css = compile("../components/HkJsonTree.scss");
    expect(css).toMatch(/\.s-jt-row[^{]*\{[^}]*?user-select:\s*text/);
    expect(css).toMatch(/\.s-tool-json-tree[^{]*\{[^}]*?user-select:\s*none/);
  });

  it("keeps the table contract two-sided under the deny-by-default root", () => {
    // 2026-10-18 contract: copy-cells (default) denies cells with the
    // click-to-copy cursor; the opt-out now needs an explicit mirror —
    // absence of a deny no longer means selectable once the root denies.
    const css = compile("../components/HkTable.scss");
    expect(css).toMatch(/\.hk-table\[data-copy-cells\] \.hk-table-cell\{[^}]*?user-select:\s*none/);
    expect(css).toMatch(
      /\.hk-table:not\(\[data-copy-cells\]\) \.hk-table-cell\{[^}]*?user-select:\s*text/,
    );
  });
});
