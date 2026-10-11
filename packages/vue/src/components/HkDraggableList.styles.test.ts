import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Sheet contract for the locked-row handle lane (DOM twin:
 * HkDraggableList.test.tsx).
 *
 * - a locked row HIDES its grip but keeps the 20px lane reserved
 *   (`visibility: hidden` under [data-hidden]) — mixed lists keep the
 *   grip column aligned;
 * - a list whose every row is locked (root [data-all-locked]) can never
 *   reorder, so the lane collapses outright (`display: none`) instead of
 *   reserving an empty gutter that reads as "missing grips" (user report
 *   2026-10-11 on chest's 2FA factors list).
 *
 * Assertions run on the COMPILED sheet, not the source text, so a
 * declaration cannot hide behind SCSS nesting, and comments are stripped
 * first so a commented-out guard cannot keep a hollow test green.
 */
const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

function listCss(): string {
  const file = resolve(componentDir, "HkDraggableList.scss");
  return compile(file, { style: "expanded", loadPaths: [componentDir] }).css.replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

function ruleBody(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return m ? m[1]! : null;
}

describe("HkDraggableList handle-lane sheet", () => {
  const css = listCss();

  it("compiles", () => {
    expect(css.length).toBeGreaterThan(0);
    // Sanity anchors so a renamed file cannot hollow this guard.
    expect(css).toContain(".hk-draggable-list-item");
    expect(css).toContain(".hk-draggable-list-handle");
  });

  it("keeps a locked row's lane reserved — hidden, not removed", () => {
    const body = ruleBody(css, ".hk-draggable-list-handle[data-hidden]");
    expect(body, "the [data-hidden] rule must exist").not.toBeNull();
    expect(body).toContain("visibility: hidden");
    expect(body).not.toContain("display: none");
  });

  it("collapses the lane entirely when every row is locked", () => {
    const body = ruleBody(
      css,
      ".hk-draggable-list[data-all-locked] .hk-draggable-list-handle",
    );
    expect(body, "the [data-all-locked] collapse rule must exist").not.toBeNull();
    expect(body).toContain("display: none");
  });
});
