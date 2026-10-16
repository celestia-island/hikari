import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for the shared container-padding token
 * (--hk-pad, runtime/containerPad) across every wired container sheet.
 *
 * The whole facility rests on each container's padding rule consuming
 * `var(--hk-pad, <legacy default>)` — the token is SET per instance
 * (inline, via the `padding` prop) and CONSUMED by these rules, so
 * there is never a specificity contest. Vitest stubs CSS, so the
 * component suites can never catch a rule regressed back to a literal:
 * this file compiles the six sheets for real and pins the exact
 * declarations.
 *
 * The legacy fallbacks here ARE the historical visuals: popover glass
 * 4px (menu voice) / bare panel 0, card body 1rem (unpadded 0),
 * stat card 12/16, modal body --hk-modal-padding-body (1.5rem), drawer
 * body --hk-drawer-body-padding (1rem), alert base/sm/lg shorthands.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

function compileSheet(name: string): string {
  return compile(resolve(componentDir, name), { style: "expanded" }).css;
}

function ruleFor(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `${selector} present in the compiled sheet`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(start, close + 1);
}

describe("container pad token — wired sheets", () => {
  it("HkPopover: bare panel falls back to 0, glass chrome to the 4px menu inset", () => {
    const css = compileSheet("HkPopover.scss");
    expect(ruleFor(css, ".hk-popover-panel {")).toContain(
      "padding: var(--hk-pad, 0)",
    );
    expect(css).toContain(
      "padding: var(--hk-pad, var(--space-4, 0.25rem))",
    );
  });

  it("HkCard: body 1rem, unpadded 0, the scrollable pad wrapper 1rem", () => {
    const css = compileSheet("HkCard.scss");
    expect(ruleFor(css, ".hk-card-body {")).toContain(
      "padding: var(--hk-pad, var(--space-16))",
    );
    expect(ruleFor(css, ".hk-card-body-unpadded {")).toContain(
      "padding: var(--hk-pad, 0)",
    );
    expect(ruleFor(css, ".hk-card-body-pad {")).toContain(
      "padding: var(--hk-pad, var(--space-16))",
    );
  });

  it("HkStatCard: the 12/16 surface inset", () => {
    const css = compileSheet("HkStatCard.scss");
    expect(ruleFor(css, ".hk-stat-card {")).toContain(
      "padding: var(--hk-pad, var(--space-12, 0.75rem) var(--space-16, 1rem))",
    );
  });

  it("HkModal: every scroll-pad track reads the token over the theme value", () => {
    const css = compileSheet("HkModal.scss");
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(css).toContain(
        `--hk-scroll-pad-${side}: var(--hk-pad, var(--hk-modal-padding-body, 1.5rem))`,
      );
    }
  });

  it("HkDrawer: the body reads the token over the theme value", () => {
    const css = compileSheet("HkDrawer.scss");
    expect(css).toContain(
      "padding: var(--hk-pad, var(--hk-drawer-body-padding, var(--space-16, 1rem)))",
    );
  });

  it("HkAlert: the base and both sized shorthands read the token", () => {
    const css = compileSheet("HkAlert.scss");
    expect(ruleFor(css, ".hk-alert {")).toContain(
      "padding: var(--hk-pad, var(--space-12, 12px) var(--space-16, 16px))",
    );
    expect(ruleFor(css, ".hk-alert-sm {")).toContain(
      "padding: var(--hk-pad, var(--space-8, 8px) var(--space-12, 12px))",
    );
    expect(ruleFor(css, ".hk-alert-lg {")).toContain(
      "padding: var(--hk-pad, var(--space-16, 16px) var(--space-24, 24px))",
    );
  });
});
