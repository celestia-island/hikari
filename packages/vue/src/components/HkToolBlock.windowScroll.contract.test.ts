/**
 * Source contract: ONE SCROLLBAR PER WINDOW — tool panes (2026-09-08
 * audit follow-up). The tool block's code panes and the shared JSON tree
 * keep a bounded widget viewport in chat cards and on pages (the exempt
 * content-widget class, like markdown code blocks), but INSIDE a window
 * surface's own scroller (modal body, select sheet, popout, popover
 * sheet/panel, drawer body) that cap lit a second scrollbar under the
 * window's — one per pane in pane lists like the chest todo-log modal.
 * There the window's scrollbar is the only one and the pane grows with
 * its content.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const toolScss = readFileSync(join(here, "HkToolBlock.scss"), "utf-8");
const treeScss = readFileSync(join(here, "HkJsonTree.scss"), "utf-8");
const toolTsx = readFileSync(join(here, "HkToolBlock.tsx"), "utf-8");

/** Window-surface scrollers — the ONE-scrollbar owners. */
const SCROLLERS = [
  ".hk-modal-body-scroll",
  ".hk-select-sheet-list",
  ".hk-select-popout",
  ".hk-popover-panel",
  ".hk-drawer-body",
] as const;

const PANES = [".s-tool-code", ".s-tool-code-block", ".s-tool-json-tree"] as const;

/** Extract ONE balanced `{...}` declaration block following `selector`
 *  (a naive `[^}]*` would stop at the first nested `}` — see the
 *  HkAffixPicker single-scroll contract for the established pattern). */
function cssBlock(src: string, selector: string): string {
  const at = src.indexOf(selector);
  if (at < 0) return "";
  const open = src.indexOf("{", at);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return "";
}

describe("tool pane single-scrollbar-per-window contract", () => {
  it("keeps the bounded widget viewport outside windows", () => {
    expect(cssBlock(toolScss, ".s-tool-code ")).toContain("max-height: 240px");
    expect(cssBlock(toolScss, ".s-tool-code-block ")).toContain("max-height: 240px");
    expect(cssBlock(treeScss, ".s-tool-json-tree ")).toContain("max-height: 320px");
  });

  it("drops the cap inside every window surface scroller", () => {
    for (const pane of PANES) {
      for (const scroller of SCROLLERS) {
        // The uncap rule lives next to the pane's own file: tool panes in
        // HkToolBlock.scss, the tree in HkJsonTree.scss. Search BOTH — a
        // rule moved between the files must not fail the pin, a rule
        // deleted anywhere must fail it.
        const body =
          cssBlock(toolScss, `${scroller} ${pane}`) ||
          cssBlock(treeScss, `${scroller} ${pane}`);
        expect(body, `${scroller} ${pane} uncap rule exists`).toBeTruthy();
        expect(body, `${scroller} ${pane} uncaps via max-height: none`).toContain(
          "max-height: none",
        );
      }
    }
  });

  it("no window-scroller context ever re-caps a pane with a length", () => {
    for (const scss of [toolScss, treeScss]) {
      for (const scroller of SCROLLERS) {
        // Any scroller-descendant rule for a pane carrying a px/vh/rem
        // max-height would reintroduce the nested scrollbar.
        const re = new RegExp(
          `${scroller.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} [^{]*\\{[^}]*max-height:\\s*(?!none)[\\d.]`,
        );
        expect(scss.match(re), `${scroller} descendant px cap`).toBeNull();
      }
    }
  });

  it("the deferred overlay pass still targets the three panes (rails self-hide when uncapped)", () => {
    expect(toolTsx).toContain('".s-tool-code, .s-tool-code-block, .s-tool-json-tree"');
  });
});
