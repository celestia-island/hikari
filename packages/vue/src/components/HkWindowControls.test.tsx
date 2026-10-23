import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, type App } from "vue";

import HkWindowControls, { isApplePlatform } from "./HkWindowControls";

const containers: HTMLElement[] = [];

function mountControls(props: Record<string, unknown> = {}): {
  app: App;
  container: HTMLElement;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const Wrapper = defineComponent({
    render: () => h(HkWindowControls as never, props),
  });
  const app = createApp(Wrapper);
  app.mount(container);
  return { app, container };
}

afterEach(() => {
  for (const c of containers.splice(0)) c.remove();
  vi.unstubAllGlobals();
});

/** A fake __TAURI__ window API so the render gates pass off-desktop. */
function stubTauriWindow(): void {
  vi.stubGlobal("__TAURI__", {
    window: {
      getCurrentWindow: () => ({
        minimize: () => Promise.resolve(),
        toggleMaximize: () => Promise.resolve(),
        close: () => Promise.resolve(),
        isMaximized: () => Promise.resolve(false),
        onResized: () => Promise.resolve(() => {}),
      }),
    },
  });
}

describe("HkWindowControls (two deliberate modes, explicit None)", () => {
  it("renders the three buttons in standard mode", () => {
    stubTauriWindow();
    const t = mountControls({ variant: "standard" });
    const btns = t.container.querySelectorAll<HTMLButtonElement>(
      ".hk-window-controls__btn",
    );
    expect(btns).toHaveLength(3);
    expect(t.container.querySelector(".hk-window-controls--flush")).toBeNull();
    t.app.unmount();
  });

  it("renders the flush modifier in flush mode", () => {
    stubTauriWindow();
    const t = mountControls({ variant: "flush" });
    expect(t.container.querySelector(".hk-window-controls--flush")).not.toBeNull();
    expect(
      t.container.querySelectorAll(".hk-window-controls__btn"),
    ).toHaveLength(3);
    t.app.unmount();
  });

  it("renders NOTHING without a variant (the explicit-None contract)", () => {
    stubTauriWindow();
    const t = mountControls({});
    expect(t.container.querySelector(".hk-window-controls")).toBeNull();
    t.app.unmount();
  });

  it("renders nothing for an invalid variant (validator escape)", () => {
    stubTauriWindow();
    const t = mountControls({ variant: "rounded" });
    expect(t.container.querySelector(".hk-window-controls")).toBeNull();
    t.app.unmount();
  });

  it("renders nothing on Apple platforms (the OS owns the traffic lights)", () => {
    stubTauriWindow();
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" });
    expect(isApplePlatform()).toBe(true);
    const t = mountControls({ variant: "standard" });
    expect(t.container.querySelector(".hk-window-controls")).toBeNull();
    t.app.unmount();
  });

  it("renders nothing without a Tauri window API (browser preview)", () => {
    const t = mountControls({ variant: "standard" });
    expect(t.container.querySelector(".hk-window-controls")).toBeNull();
    t.app.unmount();
  });
});
