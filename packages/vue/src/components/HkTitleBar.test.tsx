import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import { setLocale } from "../i18n/context";

import HkTitleBar from "./HkTitleBar";

/**
 * HkTitleBar maximized-state contract tests.
 *
 * The `maximized` prop drives three things; all are contract-tested here
 * because the failure mode is silent (a wrong glyph, a hover fill that
 * rounds away from a square frame corner):
 *
 *   1. the root carries `data-maximized` only while maximized — the
 *      stylesheet keys the close-button radius override off it,
 *   2. the maximize button swaps its glyph/title with the same prop, and
 *   3. the compiled sheet squares the close corner under `[data-maximized]`.
 *
 * The compiled-stylesheet guard exists because vitest stubs CSS, so a
 * runtime test can never notice the rule going missing (the HkAboutModal
 * styles test hit exactly that class of regression).
 *
 * (Repo test convention: raw createApp + container queries, no
 * @vue/test-utils dependency.)
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkTitleBar", () => {
  it("marks the root data-maximized only while maximized", () => {
    const windowed = mount(h(HkTitleBar, { title: "App", maximized: false }));
    expect(windowed.querySelector(".hk-titlebar")?.hasAttribute("data-maximized")).toBe(false);

    const maximized = mount(h(HkTitleBar, { title: "App", maximized: true }));
    expect(maximized.querySelector(".hk-titlebar")?.hasAttribute("data-maximized")).toBe(true);
  });

  it("follows the prop reactively, adding and removing the marker", async () => {
    // Hosts toggle `maximized` live (resize listener → ref); the marker
    // must come and go with it, not just latch on mount.
    const maximized = ref(false);
    const host = mount(
      h(() => h(HkTitleBar, { title: "App", maximized: maximized.value })),
    );
    const bar = () => host.querySelector<HTMLElement>(".hk-titlebar")!;
    expect(bar().hasAttribute("data-maximized")).toBe(false);

    maximized.value = true;
    await nextTick();
    expect(bar().hasAttribute("data-maximized")).toBe(true);

    maximized.value = false;
    await nextTick();
    expect(bar().hasAttribute("data-maximized")).toBe(false);
  });

  it("swaps the maximize glyph with the same prop", () => {
    const windowed = mount(h(HkTitleBar, { title: "App", maximized: false }));
    expect(windowed.querySelector('[title="Maximize"]')).toBeTruthy();

    const maximized = mount(h(HkTitleBar, { title: "App", maximized: true }));
    expect(maximized.querySelector('[title="Restore"]')).toBeTruthy();
  });

  it("localizes the caption tooltips through the preset i18n keys", async () => {
    // The bar is window chrome: its captions must follow the host's
    // setLocale (the strings live in the preset locale bundles, not in
    // props). en is the fallback locale a host that never calls
    // setLocale gets — pinned here because the assertions above rely on
    // the literals.
    const windowed = mount(h(HkTitleBar, { title: "App", maximized: false }));
    expect(windowed.querySelector('[title="Close"]')).toBeTruthy();
    expect(windowed.querySelector('[title="Minimize"]')).toBeTruthy();

    await setLocale("zh-Hans");
    await nextTick();
    expect(windowed.querySelector('[title="最小化"]')).toBeTruthy();
    expect(windowed.querySelector('[title="最大化"]')).toBeTruthy();
    expect(windowed.querySelector('[title="关闭"]')).toBeTruthy();

    await setLocale("en");
    await nextTick();
    expect(windowed.querySelector('[title="Maximize"]')).toBeTruthy();
    expect(windowed.querySelector('[title="关闭"]')).toBeNull();
  });
});

describe("HkTitleBar window-chrome claim", () => {
  // The bar IS the app's title bar, so mounting it must stand hikari's boot bar
  // (boot-chrome.js) down — otherwise two caption bars overlap for the rest of
  // the session. Tests use a raw window listener: that is the whole contract.
  function collect(): { claims: Array<{ by?: string }>; stop: () => void } {
    const claims: Array<{ by?: string }> = [];
    const listener = (event: Event) => {
      claims.push((event as CustomEvent<{ by?: string }>).detail ?? {});
    };
    window.addEventListener("hk:chrome-claim", listener);
    return {
      claims,
      stop: () => window.removeEventListener("hk:chrome-claim", listener),
    };
  }

  function cleanup(): void {
    document.documentElement.removeAttribute("data-hk-chrome");
  }

  it("claims the window on mount and marks the app as the chrome owner", () => {
    const { claims, stop } = collect();
    try {
      mount(h(HkTitleBar, { title: "App" }));

      expect(claims).toHaveLength(1);
      expect(claims[0]?.by).toBe("HkTitleBar");
      expect(document.documentElement.getAttribute("data-hk-chrome")).toBe("app");
    } finally {
      stop();
      cleanup();
    }
  });

  it("never claims twice for one mount (a re-render is not a new takeover)", async () => {
    const { claims, stop } = collect();
    try {
      const maximized = ref(false);
      mount(h(() => h(HkTitleBar, { title: "App", maximized: maximized.value })));
      expect(claims).toHaveLength(1);

      maximized.value = true;
      await nextTick();
      maximized.value = false;
      await nextTick();

      expect(claims).toHaveLength(1);
    } finally {
      stop();
      cleanup();
    }
  });

  it("leaves the existing props/emits contract untouched", () => {
    const emitted: string[] = [];
    const host = mount(
      h(HkTitleBar, {
        title: "App",
        onMinimize: () => emitted.push("minimize"),
        onClose: () => emitted.push("close"),
      }),
    );
    host.querySelector<HTMLButtonElement>('[title="Minimize"]')!.click();
    host.querySelector<HTMLButtonElement>('[title="Close"]')!.click();
    expect(emitted).toEqual(["minimize", "close"]);
  });
});

describe("HkTitleBar stylesheet contract", () => {
  const css = compile(resolve(componentDir, "HkTitleBar.scss"), {
    style: "expanded",
  }).css;

  /**
   * Body of one compiled rule, by exact selector (Sass drops the quotes
   * around an attribute value: `[data-maximized]`).
   *
   * The selector is anchored to its own line: expanded Sass puts every
   * selector of a rule (comma lists included) on its own line, so this
   * skips compound rules that merely END with the selector (e.g. the
   * `[data-maximized]` override) while still requiring exactly one match —
   * a second copy, say inside a media query, would stay invisible to a
   * looser scan while still winning the cascade.
   */
  function ruleBody(sheet: string, selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = [
      ...sheet.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g")),
    ];
    expect(matches, `${selector} compiles exactly once`).toHaveLength(1);
    return matches[0]?.[1] ?? "";
  }

  it("squares the close button corner while maximized, both directions", () => {
    // The (0,3,0) compound must survive compilation and out-rank the base
    // radius rule and its RTL mirror; reading the compiled declarations
    // (not the SCSS source) means a rule that failed to compile fails here.
    const body = ruleBody(css, ".hk-titlebar[data-maximized] .hk-titlebar-btn-close");
    expect(body).toContain("border-radius: 0");
  });

  it("keeps the windowed radius var wired to the close button", () => {
    const scss = readFileSync(resolve(componentDir, "HkTitleBar.scss"), "utf8");
    expect(scss).toContain("--hk-tb-radius-close:");
    const body = ruleBody(css, ".hk-titlebar .hk-titlebar-btn-close");
    expect(body).toContain("border-radius: var(--hk-tb-radius-close)");
  });

  it("inks the close fill from its own token, never the theme's on-solid", () => {
    // The fill is a fixed danger red; the ink must be fixed with it. The
    // theme-derived --hi-color-text-on-danger painted a dark X on dark red
    // under the default dark preset (the wowsp/momoi field report).
    const scss = readFileSync(resolve(componentDir, "HkTitleBar.scss"), "utf8");
    expect(scss).toContain("--hk-tb-close-ink:");
    const hover = ruleBody(css, ".hk-titlebar .hk-titlebar-btn-close:hover");
    expect(hover).toContain("color: var(--hk-tb-close-ink)");
    expect(hover).not.toContain("--hi-color-text-on-danger");
    const active = ruleBody(css, ".hk-titlebar .hk-titlebar-btn-close:active");
    expect(active).toContain("color: var(--hk-tb-close-ink)");
  });

  it("outranks host element rules with caption-scoped buttons", () => {
    // (0,3,0) beats a host's `button:hover:not(:disabled)` at (0,2,1);
    // the close-specific rules stay later in the sheet, so they still win.
    const hover = ruleBody(css, ".hk-titlebar .hk-titlebar-btn:hover");
    expect(hover).toContain("background: var(--hk-tb-hover)");
    const closeHoverAt = css.indexOf(".hk-titlebar .hk-titlebar-btn-close:hover");
    const hoverAt = css.indexOf(".hk-titlebar .hk-titlebar-btn:hover");
    expect(closeHoverAt).toBeGreaterThan(hoverAt);
  });

  it("sizes the caption icon through its token", () => {
    const scss = readFileSync(resolve(componentDir, "HkTitleBar.scss"), "utf8");
    expect(scss).toContain("--hk-tb-icon-size:");
    const body = ruleBody(css, ".hk-titlebar-icon");
    expect(body).toContain("width: var(--hk-tb-icon-size)");
    expect(body).toContain("height: var(--hk-tb-icon-size)");
  });
});
