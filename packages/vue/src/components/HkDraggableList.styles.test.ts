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

describe("HkDraggableList content-lane fill sheet", () => {
  const css = listCss();

  it("stretches a single-root row across the lane", () => {
    const body = ruleBody(css, ".hk-draggable-list-content > :only-child");
    expect(body, "the :only-child fill rule must exist").not.toBeNull();
    expect(body).toContain("flex: 1");
    expect(body).toContain("min-width: 0");
  });

  // The fill must stay keyed on :only-child: fragment rows (several
  // siblings sharing the lane) are host-owned layout and must not match.
  it("never stretches fragment rows — the rule keys on :only-child alone", () => {
    const fillRules = css.match(/\.hk-draggable-list-content\s*>\s*[^{]+\{/g) ?? [];
    expect(fillRules.length).toBe(1);
    expect(fillRules[0]).toContain(":only-child");
  });
});

describe("HkDraggableList actions-lane sheet", () => {
  const css = listCss();

  it("keeps the actions lane fixed at its natural width", () => {
    const body = ruleBody(css, ".hk-draggable-list-actions");
    expect(body, "the actions-lane rule must exist").not.toBeNull();
    expect(body).toContain("display: flex");
    expect(body).toContain("align-items: center");
    expect(body).toContain("flex-shrink: 0");
    // Multiple host buttons in one lane need the lane's own gap so they
    // never fuse into one cluster against the row edge.
    expect(body).toContain("gap:");
  });

  // The right-edge pinning is STRUCTURAL, not a margin patch: the item
  // row is a flex row and the content lane keeps flex: 1, so the lane
  // needs nothing beyond shrink-resistance. A margin-left: auto here
  // would paper over a future content-lane regression instead of
  // letting the fill sheet fail loudly — pin by ownership, not by patch.
  it("pins by the content lane's flex: 1, not a margin patch", () => {
    const body = ruleBody(css, ".hk-draggable-list-actions");
    expect(body).not.toContain("margin-left: auto");
    const content = ruleBody(css, ".hk-draggable-list-content");
    expect(content).toContain("flex: 1");
  });
});

describe("HkDraggableList horizontal-axis sheet", () => {
  /** axis="horizontal" (DOM twin: the horizontal-axis cases in
   *  HkDraggableList.test.tsx) lays the SAME list as one never-wrapping
   *  row. Only geometry changes: the drop line moves to the item's
   *  leading/trailing edge — the horizontal twin of the top/bottom inset
   *  — and the items become shrinkable so the single line always holds. */
  const css = listCss();

  // ruleBody selectors are written in the COMPILED form: sass expanded
  // output drops attribute-value quotes ([data-axis=horizontal]).

  it("lays the horizontal list out as one never-wrapping row", () => {
    const body = ruleBody(css, ".hk-draggable-list[data-axis=horizontal]");
    expect(body, "the horizontal-axis layout rule must exist").not.toBeNull();
    expect(body).toContain("flex-direction: row");
    expect(body).toContain("flex-wrap: nowrap");
  });

  it("lets an over-full row shrink its items so the one line holds", () => {
    const body = ruleBody(
      css,
      ".hk-draggable-list[data-axis=horizontal] .hk-draggable-list-item",
    );
    expect(body, "the horizontal item rule must exist").not.toBeNull();
    expect(body).toContain("min-width: 0");
  });

  it("marks the drop edge on the leading/trailing side, not top/bottom", () => {
    const before = ruleBody(
      css,
      ".hk-draggable-list[data-axis=horizontal] .hk-draggable-list-item[data-placeholder=before]",
    );
    expect(before, "the horizontal before rule must exist").not.toBeNull();
    expect(before).toContain("inset 2px 0 0 0");
    expect(before).not.toContain("inset 0 2px");
    expect(before).not.toContain("inset 0 -2px");

    const after = ruleBody(
      css,
      ".hk-draggable-list[data-axis=horizontal] .hk-draggable-list-item[data-placeholder=after]",
    );
    expect(after, "the horizontal after rule must exist").not.toBeNull();
    expect(after).toContain("inset -2px 0 0 0");
    expect(after).not.toContain("inset 0 2px");
    expect(after).not.toContain("inset 0 -2px");
  });

  it("keeps the vertical drop edges on top/bottom for the default axis", () => {
    // First source match = the plain vertical rule (the horizontal twin
    // comes later and under a descendant selector); its body must carry
    // the top/bottom inset and never the horizontal one.
    const before = ruleBody(css, ".hk-draggable-list-item[data-placeholder=before]");
    expect(before, "the vertical before rule must exist").not.toBeNull();
    expect(before).toContain("inset 0 2px 0 0");
    expect(before).not.toContain("inset 2px 0 0 0");

    const after = ruleBody(css, ".hk-draggable-list-item[data-placeholder=after]");
    expect(after, "the vertical after rule must exist").not.toBeNull();
    expect(after).toContain("inset 0 -2px 0 0");
    expect(after).not.toContain("inset -2px 0 0 0");
  });
});
