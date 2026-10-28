import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, defineComponent, h } from "vue";

import HkIconButton from "./HkIconButton";

/**
 * HkIconButton contract tests:
 * - extra attrs (aria-label / title / data-*) fall through onto the root
 *   <button> (the component sets inheritAttrs:false and MUST spread
 *   $attrs itself — regression guard for silent dead attributes)
 * - the declared `click` emit keeps firing alongside the fallthrough
 * - disabled + size classes compose with the fallthrough attrs.
 *
 * House style: no @vue/test-utils dependency — raw createApp mounts on a
 * shared container list torn down after each case.
 */

const mounts: Array<ReturnType<typeof createApp>> = [];

function mountComp(render: () => ReturnType<typeof h>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(defineComponent({ setup: () => render }));
  mounts.push(app);
  app.mount(container);
  return container;
}

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
});

describe("HkIconButton", () => {
  it("falls through extra attrs (aria-label / title) onto the root button", () => {
    const c = mountComp(() =>
      h(HkIconButton, {
        "aria-label": "Close inspector",
        title: "Close inspector",
        "data-test": "probe",
      }, { icon: () => h("span", "x") }),
    );
    const btn = c.querySelector("button")!;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-label")).toBe("Close inspector");
    expect(btn.getAttribute("title")).toBe("Close inspector");
    expect(btn.getAttribute("data-test")).toBe("probe");
  });

  it("keeps the declared click emit working alongside attr fallthrough", async () => {
    let clicks = 0;
    const c = mountComp(() =>
      h(HkIconButton, {
        "aria-label": "go",
        onClick: () => { clicks += 1; },
      }, { icon: () => h("span") }),
    );
    (c.querySelector("button")! as HTMLButtonElement).click();
    await Promise.resolve();
    expect(clicks).toBe(1);
  });

  it("renders disabled and the size class together with fallthrough attrs", () => {
    const c = mountComp(() =>
      h(HkIconButton, {
        size: 16,
        disabled: true,
        "aria-label": "sync",
      }),
    );
    const btn = c.querySelector("button")! as HTMLButtonElement;
    expect(btn.classList.contains("hk-icon-button-16")).toBe(true);
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-label")).toBe("sync");
  });

  // Unified window-close wave: children passed as the DEFAULT slot render
  // as the icon (named `icon` slot still wins; no children at all keeps the
  // placeholder circle). Without the default-slot branch, natural JSX usage
  // `<HIconButton><HIcon name="X"/></HIconButton>` silently rendered the
  // fallback circle instead of the consumer's glyph.
  it("renders default-slot children as the icon", () => {
    const c = mountComp(() =>
      h(HkIconButton, { "aria-label": "close" }, { default: () => h("span", { class: "glyph-probe" }, "✕") }),
    );
    expect(c.querySelector(".glyph-probe")).not.toBeNull();
    // The placeholder circle only renders when NEITHER slot is provided.
    expect(c.querySelector("circle")).toBeNull();
  });

  it("prefers the named icon slot over default children", () => {
    const c = mountComp(() =>
      h(HkIconButton, { "aria-label": "close" }, {
        icon: () => h("span", { class: "named-probe" }),
        default: () => h("span", { class: "default-probe" }),
      }),
    );
    expect(c.querySelector(".named-probe")).not.toBeNull();
    expect(c.querySelector(".default-probe")).toBeNull();
  });

  it("keeps the placeholder circle when no slot content is given", () => {
    const c = mountComp(() => h(HkIconButton, { "aria-label": "probe" }));
    expect(c.querySelector("circle")).not.toBeNull();
  });

  // Named-icon contract (2026-09-10): the icon prop resolves through HIcon
  // (functional keys ride the host material pack) — slot content still
  // wins over it, and the placeholder circle only shows with neither.
  it("renders the icon prop through HIcon, below slot precedence", () => {
    const propOnly = mountComp(() => h(HkIconButton, { icon: "close", "aria-label": "close" }));
    expect(propOnly.querySelector(".hk-icon")).not.toBeNull();
    expect(propOnly.querySelector("circle")).toBeNull();

    const propAndSlot = mountComp(() =>
      h(HkIconButton, { icon: "close", "aria-label": "close" }, { icon: () => h("span", { class: "slot-probe" }) }),
    );
    expect(propAndSlot.querySelector(".slot-probe")).not.toBeNull();
    expect(propAndSlot.querySelector(".hk-icon")).toBeNull();
  });
});

/**
 * Static pin for the header-chrome glyph step (user report 2026-09-29:
 * the search / refresh / filter glyphs in the top-right clusters read
 * visibly smaller than HkThemeToggle's sun beside them). The `.svg` rule
 * in HkIconButton.scss forces ANY slotted glyph to
 * `--hi-icon-button-icon-size`, so the 28 step must map that var to the
 * sm token (16px — the theme toggle's own glyph size). happy-dom has no
 * cascade here that a DOM test could measure, so — tokenInventory style —
 * the declarations themselves are the contract; a deliberate remap is
 * expected to update this file.
 */
describe("HkIconButton glyph step", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const vars = readFileSync(join(here, "HkIconButtonVars.scss"), "utf8");

  it("maps the 28 header step to the sm glyph (16px), matching the theme toggle", () => {
    const block = vars.slice(vars.indexOf(".hk-icon-button-28"), vars.indexOf(".hk-icon-button-32"));
    expect(block).toContain("--hi-icon-button-size: 28px;");
    expect(block).toContain("--hi-icon-button-icon-size: var(--hi-icon-size-sm);");
    expect(block).not.toContain("var(--hi-icon-size-xs)");
  });

  it("keeps the dense steps (16/24) on the xs glyph", () => {
    const block16 = vars.slice(vars.indexOf(".hk-icon-button-16"), vars.indexOf(".hk-icon-button-24"));
    const block24 = vars.slice(vars.indexOf(".hk-icon-button-24"), vars.indexOf(".hk-icon-button-28"));
    expect(block16).toContain("var(--hi-icon-size-xs)");
    expect(block24).toContain("var(--hi-icon-size-xs)");
  });
});

describe("HkIconButton status dot", () => {
  it("renders no dot by default", () => {
    const c = mountComp(() =>
      h(HkIconButton, { "aria-label": "Filter" }, { icon: () => h("span", "x") }),
    );
    expect(c.querySelector(".hk-icon-button-dot")).toBeNull();
  });

  it("dot renders inside the button with the tone class and stays decorative", () => {
    const c = mountComp(() =>
      h(HkIconButton, { dot: true, "aria-label": "Filter" }, { icon: () => h("span", "x") }),
    );
    const dot = c.querySelector(".hk-icon-button-dot")!;
    expect(dot).not.toBeNull();
    // Tone channels ride HkCornerBadge's variant classes (one grammar).
    expect(dot.classList.contains("hk-corner-badge-success")).toBe(true);
    // Decorative by default: the button's own label carries the state.
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(dot.getAttribute("role")).toBeNull();
    // Inside the button's own silhouette — never a detached wrapper mark.
    expect(dot.closest("button")).not.toBeNull();
    expect(dot.closest(".hk-corner-badge-anchor")).toBeNull();
  });

  it("dotVariant switches the tone class", () => {
    const c = mountComp(() =>
      h(HkIconButton, { dot: true, dotVariant: "error", "aria-label": "Fail" }, { icon: () => h("span", "x") }),
    );
    expect(c.querySelector(".hk-icon-button-dot")!.classList.contains("hk-corner-badge-error")).toBe(true);
  });

  it("dotLabel promotes the dot to a named mark", () => {
    const c = mountComp(() =>
      h(HkIconButton, { dot: true, dotLabel: "Filter engaged", "aria-label": "Filter" }, { icon: () => h("span", "x") }),
    );
    const dot = c.querySelector(".hk-icon-button-dot")!;
    expect(dot.getAttribute("aria-hidden")).toBeNull();
    expect(dot.getAttribute("role")).toBe("img");
    expect(dot.getAttribute("aria-label")).toBe("Filter engaged");
  });
});

/**
 * Compiled-stylesheet guard for the button-owned status dot (R3-style
 * contract, HkCornerBadge.styles.test.ts pattern): the button is the
 * anchor layer (position: relative) and the dot is an absolutely
 * positioned INSET mark with pointer-events off — the declarations are
 * the contract where happy-dom has no cascade.
 */
describe("HkIconButton status dot stylesheet contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const scss = readFileSync(join(here, "HkIconButton.scss"), "utf8");

  it("the button is the dot's anchor layer (position: relative)", () => {
    const start = scss.indexOf(".hk-icon-button {");
    const close = scss.indexOf("}", start);
    expect(scss.slice(start, close + 1)).toContain("position: relative");
  });

  it("the dot is an absolute inset mark with pointer-events off and a round cutout ring", () => {
    const start = scss.indexOf(".hk-icon-button-dot {");
    const close = scss.indexOf("}", start);
    const rule = scss.slice(start, close + 1);
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("right: var(--hk-icon-button-dot-inset");
    expect(rule).toContain("bottom: var(--hk-icon-button-dot-inset");
    expect(rule).toContain("pointer-events: none");
    expect(rule).toContain("border-radius: 50%");
    expect(rule).toContain("box-shadow: 0 0 0 1.5px");
  });
});
