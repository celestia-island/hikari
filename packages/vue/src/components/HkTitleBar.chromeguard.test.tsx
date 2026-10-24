import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkTitleBar from "./HkTitleBar";
import { popChromeGuard, pushChromeGuard } from "../runtime/chromeGuard";

/**
 * HkTitleBar window-chrome guard tests (runtime/chromeGuard).
 *
 * The modal-open policy is a cross-component contract: HkModal pushes
 * the guard, the bar flips into its guarded rendering. These tests pin
 * the bar's side of it — the data marker, the caption buttons that must
 * survive, the custom actions that must die (and the ids that may
 * live) — plus a compiled-stylesheet guard for the pointer-events
 * sweep, because vitest stubs CSS and a runtime test can never notice
 * the rule going missing.
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

function barOf(container: HTMLElement) {
  return container.querySelector<HTMLElement>(".hk-titlebar")!;
}

function captionButtons(container: HTMLElement, label: string) {
  return [...container.querySelectorAll<HTMLButtonElement>(".hk-titlebar-btn")].filter(
    (b) => b.getAttribute("aria-label") === label,
  );
}

describe("HkTitleBar chrome guard", () => {
  it("marks the bar data-chrome-guarded only while the guard is active", async () => {
    const host = mount(h(HkTitleBar, { title: "App" }));
    const bar = () => barOf(host);
    expect(bar().hasAttribute("data-chrome-guarded")).toBe(false);

    pushChromeGuard();
    await nextTick();
    expect(bar().hasAttribute("data-chrome-guarded")).toBe(true);

    popChromeGuard();
    await nextTick();
    expect(bar().hasAttribute("data-chrome-guarded")).toBe(false);
  });

  it("keeps the caption buttons alive under the guard", async () => {
    const host = mount(h(HkTitleBar, { title: "App" }));
    pushChromeGuard();
    await nextTick();

    for (const label of ["Minimize", "Maximize", "Close"]) {
      const buttons = captionButtons(host, label);
      expect(buttons.length).toBe(1);
      expect(buttons[0].disabled).toBe(false);
      // The stylesheet sweep must exempt them: the marker is the
      // selector's only handle on a host-authored bar too.
      expect(buttons[0].hasAttribute("data-window-control")).toBe(true);
    }

    popChromeGuard();
  });

  it("disables unkept custom actions under the guard and restores them after", async () => {
    const host = mount(
      h(HkTitleBar, {
        title: "App",
        customActions: [{ id: "gear", label: "Settings", icon: "⚙" }],
      }),
    );
    const gear = () => host.querySelector<HTMLButtonElement>('.hk-titlebar-btn[aria-label="Settings"]')!;
    expect(gear().disabled).toBe(false);

    pushChromeGuard();
    await nextTick();
    expect(gear().disabled).toBe(true);
    expect(gear().getAttribute("aria-disabled")).toBe("true");

    popChromeGuard();
    await nextTick();
    expect(gear().disabled).toBe(false);
    expect(gear().hasAttribute("aria-disabled")).toBe(false);
  });

  it("keeps a custom action clickable when a window listed its id", async () => {
    const host = mount(
      h(HkTitleBar, {
        title: "App",
        customActions: [
          { id: "gear", label: "Settings", icon: "⚙" },
          { id: "bell", label: "Alerts", icon: "🔔" },
        ],
      }),
    );
    pushChromeGuard(["gear"]);
    await nextTick();

    const gear = host.querySelector<HTMLButtonElement>('.hk-titlebar-btn[aria-label="Settings"]')!;
    const bell = host.querySelector<HTMLButtonElement>('.hk-titlebar-btn[aria-label="Alerts"]')!;
    expect(gear.disabled).toBe(false);
    expect(gear.hasAttribute("data-keep-when-guarded")).toBe(true);
    expect(bell.disabled).toBe(true);
    expect(bell.hasAttribute("data-keep-when-guarded")).toBe(false);

    popChromeGuard();
    await nextTick();
    expect(gear.hasAttribute("data-keep-when-guarded")).toBe(false);
  });
});

describe("HkTitleBar chrome guard stylesheet contract", () => {
  const css = compile(resolve(componentDir, "HkTitleBar.scss"), {
    style: "expanded",
  }).css;

  it("sweeps pointer events off non-caption controls under the guard", () => {
    expect(css).toMatch(/\.hk-titlebar\[data-chrome-guarded\]/);
    // The sweep must key on the caption-button markers, not on class
    // names a host cannot reproduce for its own slotted controls.
    expect(css).toMatch(/button:not\(\[data-window-control\]\):not\(\[data-keep-when-guarded\]\)/);
    expect(css).toMatch(/pointer-events:\s*none/);
  });

  it("keeps form controls and tabs in the sweep", () => {
    // Hosts park view switches (role=tab) and stray inputs in the bar;
    // the sweep's control list is the contract, so pin it. (sass emits
    // attribute values unquoted: [role=tab].)
    expect(css).toMatch(/\[role=.?tab.?\]/);
    expect(css).toMatch(/input:not\(\[disabled\]\)/);
    expect(css).toMatch(/a\[href\]/);
  });

  it("dims guarded-off custom actions without hover feedback", () => {
    expect(css).toMatch(/\.hk-titlebar-btn:disabled/);
    expect(css).toMatch(/\.hk-titlebar-btn:disabled:hover[\s\S]*?background:\s*transparent/);
  });
});
