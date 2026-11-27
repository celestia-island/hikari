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
 * `auto` and leave every other test green. That would put the frame back in
 * the pointer path, where it eats the pan drag. This compiles the sheets and
 * asserts the contract, the same shape HkFilterPanel/DockBar already use.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

function compiled(file: string): string {
  return compile(resolve(componentDir, file), { style: "expanded" }).css;
}

/** The declaration block of the FIRST rule whose selector text contains
 *  `selector`. Each caller passes a needle unique to its rule (the frame's
 *  carries the literal brace), so the first-brace scan cannot land on a
 *  neighbouring `__label` block. */
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

/**
 * Graph node labels must be allowed the width the LAYOUT already gave them.
 *
 * `mermaid/layout.ts` sizes a node from its own text
 * (`labelWidth + 2 * NODE_PAD_X`), so the box is exactly big enough for the
 * label. A percentage cap on the label can therefore only ever CLIP it —
 * and one did: `max-width: 72%` ellipsized every graph label, which is what
 * a real docs page showed on 2026-11-27 (`markdown` → `markd…`, `HTML` →
 * `HT…`; measured on docs.celestia.world, 10 of 11 labels clipped, and all
 * 11 clean once the cap was lifted at runtime).
 *
 * The diamond keeps its cap: its label band is inscribed in the rhombus
 * waist, which is ALREADY narrower than the cap band (waist ≈ 0.675·box vs
 * band 0.72·box), so the cap is latent — it neither binds the label nor
 * protects the waist today, and is kept only as a guard for a future change
 * of the diamond's sizing slope.
 *
 * MUT: restoring `max-width: 72%` on the base label rule turns this RED.
 */
describe("mermaid graph label width contract", () => {
  it("lets rect/rounded/circle labels use the box the layout sized for them", () => {
    const css = compiled("HkMermaidDiagram.scss");
    expect(ruleFor(css, ".hk-mmd-node__label")).toMatch(/max-width:\s*100%/);
  });

  it("keeps the narrow band for the diamond waist", () => {
    const css = compiled("HkMermaidDiagram.scss");
    const diamond = ruleFor(css, ".hk-mmd-node--diamond .hk-mmd-node__label");
    expect(diamond).toMatch(/max-width:\s*72%/);
  });
});
