import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

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
    const body = ruleBody(css, ".hk-titlebar-btn-close");
    expect(body).toContain("border-radius: var(--hk-tb-radius-close)");
  });
});
