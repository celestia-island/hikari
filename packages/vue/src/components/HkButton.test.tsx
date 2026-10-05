import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HkButton from "./HkButton";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * HkButton contract tests:
 * - variant / size / block / loading class mapping on the root <button>
 * - the native disabled attribute is the click guard (disabled OR loading)
 * - loading renders the spinner INSTEAD of the icon and flags aria-busy
 * - default-slot text, aria-label (icon-only usage), suffix, shortcut kbd
 * - attr fallthrough: inheritAttrs is false, the component MUST spread
 *   $attrs itself (type / data-* / class merging)
 *
 * House style: raw createApp mounts on a shared container list torn down
 * after each case; DOM assertions via document queries.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

function button(c: HTMLElement): HTMLButtonElement {
  return c.querySelector("button")!;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkButton class mapping", () => {
  it("renders the default primary/md classes with default-slot text and type=button", () => {
    const c = mount(h(HkButton, () => "Deploy"));
    const btn = button(c);
    expect(btn).not.toBeNull();
    expect(btn.className).toBe("hk-btn hk-btn-primary hk-btn-md");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.textContent).toContain("Deploy");
  });

  it("maps variant and size props to modifier classes", () => {
    const c = mount(h(HkButton, { variant: "danger", size: "sm" }, () => "Delete"));
    const cls = button(c).className;
    expect(cls).toContain("hk-btn-danger");
    expect(cls).toContain("hk-btn-sm");
    expect(cls).not.toContain("hk-btn-primary");
    expect(cls).not.toContain("hk-btn-md");
  });

  it("maps the xs size with its leading icon box", () => {
    const xs = mount(h(HkButton, { size: "xs", icon: "RotateCw" }, () => "Reconnect"));
    const xsBtn = button(xs);
    expect(xsBtn.className).toContain("hk-btn-xs");
    const box = xsBtn.querySelector(".hk-btn-icon");
    expect(box, "xs renders the leading icon box").toBeTruthy();
    expect(box!.querySelector(".hk-icon"), "HIcon span renders").toBeTruthy();
  });

  it("adds the block modifier only when block is set", () => {
    const blocked = mount(h(HkButton, { block: true }, () => "wide"));
    expect(button(blocked).className).toContain("hk-btn-block");
    const plain = mount(h(HkButton, () => "narrow"));
    expect(button(plain).className).not.toContain("hk-btn-block");
  });
});

describe("HkButton click guard", () => {
  it("emits the declared click event on activation", async () => {
    let clicks = 0;
    const c = mount(h(HkButton, { onClick: () => { clicks += 1; } }, () => "go"));
    button(c).click();
    await Promise.resolve();
    expect(clicks).toBe(1);
  });

  it("suppresses the click emit while disabled", async () => {
    let clicks = 0;
    const c = mount(h(HkButton, { disabled: true, onClick: () => { clicks += 1; } }, () => "no"));
    // The guard is the NATIVE disabled attribute: the platform (and
    // happy-dom) fires no click listeners on a disabled button.
    expect(button(c).disabled).toBe(true);
    button(c).click();
    await Promise.resolve();
    expect(clicks).toBe(0);
  });

  it("disables the button and suppresses clicks while loading", async () => {
    let clicks = 0;
    const c = mount(h(HkButton, { loading: true, onClick: () => { clicks += 1; } }, () => "busy"));
    const btn = button(c);
    expect(btn.disabled).toBe(true); // loading implies disabled
    expect(btn.className).toContain("hk-btn-loading");
    expect(btn.getAttribute("aria-busy")).toBe("true");
    btn.click();
    await Promise.resolve();
    expect(clicks).toBe(0);
  });

  it("clears the loading state back to a clickable button (aria-busy drops off)", () => {
    const busy = mount(h(HkButton, { loading: true }, () => "x"));
    expect(busy.querySelector(".hk-btn-ring")).not.toBeNull();
    const idle = mount(h(HkButton, () => "x"));
    const btn = button(idle);
    expect(idle.querySelector(".hk-spinner")).toBeNull();
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute("aria-busy")).toBeNull();
    expect(btn.className).not.toContain("hk-btn-loading");
  });
});

describe("HkButton content slots", () => {
  it("renders the leading icon only when NOT loading", () => {
    const idle = mount(h(HkButton, { icon: "close" }, () => "x"));
    expect(idle.querySelector(".hk-btn-icon")).not.toBeNull();
    expect(idle.querySelector(".hk-spinner")).toBeNull();

    // Loading swaps the icon out for the spinner — never both.
    const busy = mount(h(HkButton, { icon: "close", loading: true }, () => "x"));
    expect(busy.querySelector(".hk-btn-icon")).toBeNull();
    expect(busy.querySelector(".hk-btn-ring")).not.toBeNull();
  });

  it("renders the suffix icon slot", () => {
    const c = mount(h(HkButton, { suffix: "close" }, () => "Open"));
    expect(c.querySelector(".hk-btn-suffix")).not.toBeNull();
  });

  it("renders the shortcut kbd and its marker class", () => {
    const c = mount(h(HkButton, { shortcut: "Ctrl+Enter" }, () => "Send"));
    const btn = button(c);
    expect(btn.className).toContain("hk-btn-has-shortcut");
    const kbd = c.querySelector("kbd.hk-kbd")!;
    expect(kbd).not.toBeNull();
    expect(kbd.textContent).toContain("Ctrl");
    expect(kbd.textContent).toContain("Enter");
  });

  it("exposes aria-label for icon-only usage", () => {
    const c = mount(h(HkButton, { icon: "close", ariaLabel: "Close inspector" }));
    expect(button(c).getAttribute("aria-label")).toBe("Close inspector");
  });
});

describe("HkButton icon-only square contract", () => {
  it("flags the icon-only square class for a glyph with no label", () => {
    const iconOnly = mount(h(HkButton, { icon: "close", ariaLabel: "Close" }));
    const btn = button(iconOnly);
    expect(btn.className).toContain("hk-btn-icon-only");
    expect(iconOnly.querySelector(".hk-btn-icon")).not.toBeNull();

    const suffixOnly = mount(h(HkButton, { suffix: "close", ariaLabel: "Next" }));
    expect(button(suffixOnly).className).toContain("hk-btn-icon-only");

    // Glyph + text stays a normal text button — no square collapse.
    const withText = mount(h(HkButton, { icon: "close" }, () => "Close"));
    expect(button(withText).className).not.toContain("hk-btn-icon-only");
  });

  it("keeps the square footprint while an icon-only button loads", () => {
    const c = mount(h(HkButton, { icon: "close", loading: true, ariaLabel: "Busy" }));
    // The spinner replaces the glyph, but the button still carries no
    // label — the square footprint must hold through the swap.
    expect(button(c).className).toContain("hk-btn-icon-only");
  });

  it("keeps the block class alongside the icon-only square class", () => {
    // CSS precedence lives in the SCSS contract test below; this pins the
    // class composition so both rules can actually apply.
    const c = mount(h(HkButton, { icon: "close", block: true, ariaLabel: "Go" }));
    const cls = button(c).className;
    expect(cls).toContain("hk-btn-block");
    expect(cls).toContain("hk-btn-icon-only");
  });

  it("does not square-collapse when a shortcut chip rides along", () => {
    // The HKbd chip is an extra flex child — the fixed square width would
    // visibly clip it, so icon + shortcut stays a padded button.
    const c = mount(h(HkButton, { icon: "close", shortcut: "Ctrl+W", ariaLabel: "Close" }));
    expect(button(c).className).not.toContain("hk-btn-icon-only");
  });
});

// SCSS geometry contract (house pattern, cf. HkNumberInput.affix.test.ts):
// the square is a CSS fact — padding fully collapsed + self-declared
// border-box (survives hosts without a reset) + the block prop winning
// over the square width. Textual assertions because happy-dom does not
// lay out.
describe("HkButton icon-only SCSS contract", () => {
  const scss = readFileSync(join(here, "HkButton.scss"), "utf-8");

  it("self-declares the collapsed square geometry", () => {
    const rule = scss.match(/\.hk-btn-icon-only\s*{[^}]*}/)?.[0] ?? "";
    expect(rule, "icon-only rule must exist").toBeTruthy();
    expect(rule).toContain("padding: 0");
    expect(rule).toContain("box-sizing: border-box");
  });

  it("lets the block prop win over the square width", () => {
    const rule = scss.match(/\.hk-btn-block\.hk-btn-icon-only\s*{[^}]*}/)?.[0] ?? "";
    expect(rule, "block override rule must exist").toBeTruthy();
    expect(rule).toContain("width: 100%");
  });

  it("shrinks the xs glyph box and scales the HIcon span with it", () => {
    const rule = scss.match(/\.hk-btn-xs \.hk-btn-icon,\n\.hk-btn-xs \.hk-btn-suffix\s*{[^}]*}/)?.[0] ?? "";
    expect(rule, "xs glyph-box rule must exist").toBeTruthy();
    expect(rule).toContain("inline-size: 0.8125rem");
    expect(rule).toContain("inline-size: 100%");
  });

  it("locks each size variant width to its min-height", () => {
    const cases: Array<[string, string]> = [
      ["xs", "1.375rem"],
      ["sm", "1.75rem"],
      ["md", "2.5rem"],
      ["lg", "2.75rem"],
    ];
    for (const [size, width] of cases) {
      const rule = scss.match(new RegExp(`\\.hk-btn-${size}\\.hk-btn-icon-only\\s*{[^}]*}`))?.[0] ?? "";
      expect(rule, `${size} icon-only rule must exist`).toBeTruthy();
      expect(rule).toContain(`width: ${width}`);
      const minH = scss.match(new RegExp(`\\.hk-btn-${size}\\s*{[^}]*}`))?.[0] ?? "";
      expect(minH).toContain(`min-height: ${width}`);
    }
  });
});

describe("HkButton attr fallthrough (inheritAttrs: false)", () => {
  it("spreads extra attrs and honors an explicit type", () => {
    const c = mount(h(HkButton, { type: "submit", "data-test": "probe" }, () => "Save"));
    const btn = button(c);
    expect(btn.getAttribute("type")).toBe("submit");
    expect(btn.getAttribute("data-test")).toBe("probe");
  });

  it("merges a fallthrough class onto its own class list", () => {
    const c = mount(h(HkButton, { class: "extra-class" }, () => "x"));
    const cls = button(c).className;
    expect(cls).toContain("hk-btn");
    expect(cls).toContain("extra-class");
  });
});

describe("HkButton label prop + responsive collapse contract", () => {
  it("renders the label prop in a .hk-btn-label span and keeps the button textual", () => {
    const c = mount(h(HkButton, { icon: "gauge", label: "Test all" }));
    const btn = button(c);
    const label = c.querySelector(".hk-btn-label");
    expect(label).not.toBeNull();
    expect(label!.textContent).toBe("Test all");
    // icon + label = a text button at wide viewports, never icon-only.
    expect(btn.className).not.toContain("hk-btn-icon-only");
    // The label prop is the accessible name unless one is given.
    expect(btn.getAttribute("aria-label")).toBe("Test all");
  });

  it("prefers the label prop over the default slot and an explicit ariaLabel over the label", () => {
    const c = mount(h(HkButton, { label: "From prop" }, () => "From slot"));
    expect(c.querySelector(".hk-btn-label")!.textContent).toBe("From prop");
    expect(c.textContent).not.toContain("From slot");

    const named = mount(h(HkButton, { label: "Visible", ariaLabel: "Custom" }));
    expect(button(named).getAttribute("aria-label")).toBe("Custom");
  });

  it("emits the collapse modifier class from collapseLabel", () => {
    const c = mount(h(HkButton, { icon: "gauge", label: "Probe", collapseLabel: "sm" }));
    expect(button(c).className).toContain("hk-btn-label-collapse-sm");
  });

  it("suppresses the collapse class with block or shortcut (nothing to collapse into)", () => {
    const blocked = mount(
      h(HkButton, { icon: "gauge", label: "Probe", collapseLabel: "sm", block: true }),
    );
    expect(button(blocked).className).not.toContain("hk-btn-label-collapse");

    const withShortcut = mount(
      h(HkButton, { icon: "gauge", label: "Probe", collapseLabel: "sm", shortcut: "Ctrl+B" }),
    );
    expect(button(withShortcut).className).not.toContain("hk-btn-label-collapse");
  });

  it("keeps label-prop buttons out of the icon-only square class", () => {
    // The narrow-end square is the SCSS media query's job; the class
    // must not flip at mount time or the wide viewport would square a
    // labeled button.
    const c = mount(h(HkButton, { icon: "gauge", label: "Probe", collapseLabel: "sm" }));
    expect(button(c).className).not.toContain("hk-btn-icon-only");
  });
});

// SCSS geometry contract for the responsive collapse (same textual style
// as the icon-only contract above — happy-dom does not lay out): every
// collapse breakpoint × size pair must exist, must collapse below the
// useBreakpoint px scale (sm 640 / md 768 / lg 1024 / xl 1280), and must
// land on the exact icon-only square width of its size.
describe("HkButton label-collapse SCSS contract", () => {
  const scss = readFileSync(join(here, "HkButton.scss"), "utf-8");

  const breakpoints: Array<[string, string]> = [
    ["sm", "639.98px"],
    ["md", "767.98px"],
    ["lg", "1023.98px"],
    ["xl", "1279.98px"],
  ];
  const squares: Array<[string, string]> = [
    ["xs", "1.375rem"],
    ["sm", "1.75rem"],
    ["md", "2.5rem"],
    ["lg", "2.75rem"],
  ];

  it("collapses every breakpoint × size pair to the icon-only square", () => {
    for (const [bp, query] of breakpoints) {
      for (const [size, square] of squares) {
        const rule = scss.match(
          new RegExp(
            `\\.hk-btn-label-collapse-${bp}\\.hk-btn-${size}\\s*{\\s*@media \\(max-width: ${query}\\) {`,
          ),
        )?.[0];
        expect(rule, `${bp}×${size} collapse rule must exist`).toBeTruthy();
      }
    }
  });

  it("hides the label and lands on the exact square inside each media block", () => {
    // The per-pair rules @include one shared mixin; the geometry lives in
    // its definition (the compiled CSS materializes it per media block).
    const start = scss.indexOf("@mixin hk-btn-collapse-geometry($square) {");
    expect(start, "collapse mixin must exist").toBeGreaterThan(-1);
    // Slice to the mixin's closing brace (nested rules make a [^}] scan
    // stop early, so index from the header to the documented tail line).
    const end = scss.indexOf("width: $square;", start);
    const mixin = scss.slice(start, end + "width: $square;".length);
    expect(mixin).toContain(".hk-btn-label");
    expect(mixin).toContain("display: none;");
    expect(mixin).toContain("padding: 0;");
    expect(mixin).toContain("box-sizing: border-box;");
    expect(mixin).toContain("width: $square");

    const smBlock = scss.match(
      /\.hk-btn-label-collapse-sm\.hk-btn-sm\s*{\s*@media \(max-width: 639\.98px\) {([^}]*)}/,
    )?.[1];
    expect(smBlock, "sm×sm collapse body must exist").toBeTruthy();
    expect(smBlock).toContain("@include hk-btn-collapse-geometry(1.75rem)");
  });

  it("mirrors the useBreakpoint scale breakpoints in order", () => {
    // Keep the SCSS table honest against the runtime scale document —
    // the px values appear in ascending breakpoint order.
    const queries = [...scss.matchAll(/@media \(max-width: (\d+(?:\.\d+)?px)\)/g)].map(
      (m) => m[1],
    );
    expect(queries).toEqual([
      "639.98px",
      "639.98px",
      "639.98px",
      "639.98px",
      "767.98px",
      "767.98px",
      "767.98px",
      "767.98px",
      "1023.98px",
      "1023.98px",
      "1023.98px",
      "1023.98px",
      "1279.98px",
      "1279.98px",
      "1279.98px",
      "1279.98px",
    ]);
  });
});
