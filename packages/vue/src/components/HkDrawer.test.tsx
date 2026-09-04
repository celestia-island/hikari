import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkDrawer from "./HkDrawer";

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
