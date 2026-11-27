import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import HkDrawer from "./HkDrawer";
import { usePopupManager } from "../runtime/usePopupManager";

const here = dirname(fileURLToPath(import.meta.url));

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(async () => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  // Let any suppressed traversal land so it cannot leak into the next test.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe("HkDrawer back-guard (window-first back priority)", () => {
  async function settle(): Promise<void> {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }

  /** Wait until pred() holds (history navigation settles asynchronously). */
  async function until(pred: () => boolean, ms = 500): Promise<void> {
    const deadline = Date.now() + ms;
    while (!pred() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await nextTick();
    }
  }

  function mountDrawer(open: { value: boolean }, closable = true, extra: Record<string, unknown> = {}) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkDrawer, {
            modelValue: open.value,
            closable,
            ...extra,
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    return app;
  }

  it("pushes a history entry on open and back closes the drawer, not the page", async () => {
    const open = ref(true);
    const app = mountDrawer(open);
    await settle();

    expect((window.history.state as Record<string, unknown>)?.__hkBack).toEqual(expect.any(String));

    window.history.back();
    await until(() => open.value === false);
    await until(() => window.history.state === null);
    app.unmount();
  });

  it("renders the unified icon-button close with the X glyph when titled", async () => {
    const open = ref(true);
    // The header (and thus the close) renders only with a title/header —
    // pass one so the chrome exists to assert on.
    const app = mountDrawer(open, true, { title: "Inspector" });
    await settle();

    const closeBtn = document.body.querySelector<HTMLButtonElement>(".hk-drawer-close")!;
    expect(closeBtn).not.toBeNull();
    expect(closeBtn.classList.contains("hk-window-close")).toBe(true);
    // Unified close glyph: shared icon-button renders the registry X
    // (default-slot branch, never the fallback placeholder circle).
    expect(closeBtn.querySelector(".hk-icon")).not.toBeNull();
    expect(closeBtn.querySelector("circle")).toBeNull();
    app.unmount();
  });

  it("a non-closable drawer never owns history", async () => {
    const open = ref(true);
    const app = mountDrawer(open, false);
    await settle();

    expect((window.history.state as Record<string, unknown>)?.__hkBack).toBeUndefined();
    app.unmount();
  });
});

describe("HkDrawer window-stack close channel", () => {
  function mount(open: { value: boolean }, closable: boolean, title: string) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkDrawer, {
            modelValue: open.value,
            closable,
            title,
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          }, { default: () => h("div", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    return app;
  }

  it("closes through the popup manager when the stack navigates back", async () => {
    const manager = usePopupManager();
    const below = manager.register("modal", true, "Below");
    try {
      const open = ref(true);
      mount(open, true, "Details");
      await nextTick();

      expect(manager.closeAbove(below.id)).toBe(1);
      await nextTick();
      expect(open.value).toBe(false);
    } finally {
      manager.unregister(below.id);
    }
  });

  it("cannot close a non-closable drawer", async () => {
    const manager = usePopupManager();
    const below = manager.register("modal", true, "Below");
    try {
      const open = ref(true);
      mount(open, false, "Locked");
      await nextTick();

      // Asked, but the drawer refuses — exactly as it does for Escape.
      expect(manager.closeAbove(below.id)).toBe(1);
      await nextTick();
      expect(open.value).toBe(true);
    } finally {
      manager.unregister(below.id);
    }
  });
});

describe("HkDrawer Escape precedence", () => {
  async function settle(): Promise<void> {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }

  it("lets a nested control own Escape while a bare Escape still closes", async () => {
    const open = ref(true);
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkDrawer, {
            modelValue: open.value,
            closable: true,
            title: "Inspector",
            "onUpdate:modelValue": (v: boolean) => { open.value = v; },
          }, {
            default: () => h("div", {
              class: "escape-owner",
              onKeydown: (e: KeyboardEvent) => {
                if (e.key === "Escape") e.preventDefault();
              },
            }, "nested control"),
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await settle();

    const owner = document.body.querySelector<HTMLElement>(".hk-drawer-panel .escape-owner");
    expect(owner, "the slot content renders inside the panel").not.toBeNull();

    // `cancelable: true` is load-bearing: preventDefault() on a non-cancelable
    // synthetic event is a no-op, and the drawer would then close as if
    // nothing had consumed the key.
    owner!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    await settle();
    expect(open.value, "a consumed Escape must not close the drawer").toBe(true);

    // A bare Escape (nothing below consumed it) still closes.
    const panel = document.body.querySelector<HTMLElement>(".hk-drawer-panel")!;
    panel.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    await settle();
    expect(open.value).toBe(false);
  });
});

/**
 * The CONTAINER-PADDING contract on the drawer body (2026-11-27).
 *
 * `HkFaceShell`'s mobile nav drawer relies on `padding="none"` so the nav
 * panel fills the drawer — and the panel's overlay scroll rail, which rides
 * the panel's own edge, hugs the drawer edge instead of floating inside it.
 * The shell-level test can only assert the PROP it passes; this pin holds
 * the other half of the chain, so a regression in HkDrawer's plumbing (the
 * prop no longer reaching `--hk-pad`, or the body rule no longer reading
 * it) fails here rather than silently re-insetting every shell's nav.
 *
 * MUT: dropping `hkPadStyle(props.padding)` from the panel style, or
 * changing `--hk-pad` in HkDrawer.scss's body padding rule, turns this RED.
 */
describe("HkDrawer container padding contract", () => {
  const scss = readFileSync(resolve(here, "./HkDrawer.scss"), "utf8");

  function bodyRule(): string {
    const css = scss.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const at = css.indexOf(".hk-drawer-body {");
    expect(at, "the .hk-drawer-body rule must exist").toBeGreaterThan(-1);
    let depth = 0;
    for (let i = css.indexOf("{", at); i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) return css.slice(at, i + 1);
      }
    }
    return "";
  }

  it("the body's padding reads --hk-pad FIRST (the padding prop's arm)", () => {
    // Order is the contract: an unset --hk-pad must fall back to the theme
    // token and then the historical 1rem, but when a host passes
    // padding="none" the token must win outright.
    expect(bodyRule()).toMatch(/padding:\s*var\(\s*--hk-pad\b/);
  });

  it('maps padding="none" onto the token as 0', async () => {
    const open = ref(true);
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp({
      render: () =>
        h(HkDrawer, { modelValue: open.value, padding: "none" }, { default: () => h("div", "content") }),
    });
    mounts.push(app);
    app.mount(container);
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
    const panel = document.querySelector<HTMLElement>(".hk-drawer-panel");
    expect(panel, "the drawer panel renders").not.toBeNull();
    // The custom property is what the body rule consumes; asserting it on
    // the PANEL (its declaring element) proves the prop→token hop without
    // depending on a CSS engine happy-dom does not run.
    expect(panel!.style.getPropertyValue("--hk-pad").trim()).toBe("0");
  });
});
