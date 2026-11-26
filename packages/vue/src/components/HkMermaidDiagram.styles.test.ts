import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for the subgraph cluster frame.
 *
 * Vitest stubs CSS, so the runtime suite can never see a lost rule: the
 * `passthrough` flag is pinned twice as DATA (the layout node carries it, the
 * board DOM node gets the class), but the declaration that gives it any
 * effect — `pointer-events: none` on that class — could be neutralised to
 * `auto` and leave every test green (measured: 25/25 green). That would put
 * the frame back in the pointer path, where it eats the pan drag.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

function compiled(file: string): string {
  return compile(resolve(componentDir, file), { style: "expanded" }).css;
}

/** The declaration block of the FIRST rule whose selector text contains
 *  `selector` (compiled CSS is flat enough; comments are not emitted). */
function ruleFor(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `${selector} present in the compiled sheet`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("mermaid cluster frame stylesheet contract", () => {
  it("keeps passthrough nodes out of the pointer path", () => {
    const css = compiled("HkBoard.scss");
    expect(ruleFor(css, ".hk-board-node--passthrough")).toMatch(/pointer-events:\s*none/);
  });

  it("paints the frame as a dashed wash behind its members", () => {
    const css = compiled("HkMermaidDiagram.scss");
    const frame = ruleFor(css, ".hk-mmd-group {");
    expect(frame).toMatch(/border:\s*1px dashed/);
    expect(frame).toMatch(/background:/);
    // The caption needs its own band; without it the label paints over the
    // first member row.
    expect(ruleFor(css, ".hk-mmd-group__label")).toMatch(/position:\s*absolute/);
  });
});

// The sample text above is documentation, not a fixture: keep the file from
// drifting into an unused import if the reader helper is refactored.
void readFileSync;