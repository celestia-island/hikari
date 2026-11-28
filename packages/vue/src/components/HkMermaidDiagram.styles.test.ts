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

/** Embedded diagrams let the outer card own the only frame. The complete
 * minimap stays in HkBoard's standard corner dock (its stylesheet contract is
 * pinned in minimapDock.styles.test.ts); there is no second toolbar painter.
 *
 * MUT:mermaid-flush-frame — restoring the inner border/radius catches the
 * compiled declaration assertions even though DOM-only tests cannot see CSS.
 */
describe("mermaid embedded frame contract", () => {
  it("removes the inner border and radius in flush mode", () => {
    const css = compiled("HkMermaidDiagram.scss");
    const flush = ruleFor(css, ".hk-mermaid--flush");
    expect(flush).toMatch(/border:\s*0/);
    expect(flush).toMatch(/border-radius:\s*0/);
    expect(css).not.toContain(".hk-mermaid__toolbar");
  });

  it("keeps the loading state at a useful panel height", () => {
    const css = compiled("HkMermaidDiagram.scss");
    expect(ruleFor(css, ".hk-mermaid--loading")).toMatch(/min-height:\s*160px/);
  });

  /// The shape sample's labels ellipsized inside boxes that were BIG ENOUGH:
  /// the node is a flex row, and a `flex-shrink: 1` label shrank to a third of
  /// the box (measured 2026-11-28: stadium's label box 31px inside a 104px
  /// node). Seven of eleven shapes clipped. The layout already sizes the box
  /// from the label, so the label must take its content width and stop at the
  /// box — never shrink below it.
  ///
  /// MUT: dropping `flex: 0 0 auto` / `width: max-content` brings every
  /// ellipsis back while the box stays correct, which no width assertion sees.
  it("the outline label takes its content width instead of shrinking", () => {
    // The compiled sheet names the descendant rule, so the needle is the
    // outline node class plus the label — unique among the sheet's rules.
    const css = compiled("HkMermaidDiagram.scss");
    // The label rule sits in the NODE block, so its compiled selector is the
    // bare class — the outline node already scopes it (a node is either an
    // outline or not, never both shapes at once).
    const body = ruleFor(css, ".hk-mmd-node__label {");
    // …and the outline's absolute strip really is absolute: an unscoped SVG
    // spends flex space and squeezes the label (the actual clipping cause).
    expect(ruleFor(css, ".hk-mmd-node__outline {")).toMatch(/position:\s*absolute/);
    expect(ruleFor(css, ".hk-mmd-node--outline {")).toMatch(/border:\s*none/);
    expect(body).toMatch(/flex:\s*0 0 auto/);
    expect(body).toMatch(/width:\s*max-content/);
    // The percentage cap stays: a genuinely longer label still ellipsizes.
    expect(body).toMatch(/max-width:\s*100%/);
  });
});
