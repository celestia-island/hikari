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
    expect(busy.querySelector(".hk-spinner")).not.toBeNull();
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
    expect(busy.querySelector(".hk-spinner")).not.toBeNull();
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

  it("locks each size variant width to its min-height", () => {
    const cases: Array<[string, string]> = [
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
