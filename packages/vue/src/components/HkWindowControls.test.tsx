import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";

import { WINDOW_IPC } from "../runtime/windowChrome";

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

describe("HkWindowControls window-chrome claim", () => {
  // Only a cluster that ACTUALLY renders may take the window over from
  // hikari's boot bar: claiming while rendering nothing would remove the only
  // usable controls in the window.
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

  it("claims the window when the cluster really renders", () => {
    stubTauriWindow();
    const { claims, stop } = collect();
    try {
      const t = mountControls({ variant: "standard" });

      expect(claims.map((c) => c.by)).toEqual(["HkWindowControls"]);
      expect(document.documentElement.getAttribute("data-hk-chrome")).toBe("app");
      t.app.unmount();
    } finally {
      stop();
      cleanup();
    }
  });

  it("does not claim when no variant was given (it renders nothing)", () => {
    stubTauriWindow();
    const { claims, stop } = collect();
    try {
      const t = mountControls({});
      expect(claims).toHaveLength(0);
      expect(document.documentElement.hasAttribute("data-hk-chrome")).toBe(false);
      t.app.unmount();
    } finally {
      stop();
      cleanup();
    }
  });

  it("does not claim off-desktop (no Tauri window API)", () => {
    const { claims, stop } = collect();
    try {
      const t = mountControls({ variant: "flush" });
      expect(claims).toHaveLength(0);
      expect(document.documentElement.hasAttribute("data-hk-chrome")).toBe(false);
      t.app.unmount();
    } finally {
      stop();
      cleanup();
    }
  });

  it("does not claim on Apple platforms (the OS owns the traffic lights)", () => {
    stubTauriWindow();
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    });
    const { claims, stop } = collect();
    try {
      const t = mountControls({ variant: "standard" });
      expect(claims).toHaveLength(0);
      expect(document.documentElement.hasAttribute("data-hk-chrome")).toBe(false);
      t.app.unmount();
    } finally {
      stop();
      cleanup();
    }
  });

  it("renders and claims when only __TAURI_INTERNALS__ exists (late __TAURI__)", async () => {
    // The 2026-10-28 report: the documented API was late/absent at boot. The
    // cluster must still paint three real controls and hand the window over,
    // otherwise the boot bar never retires and two caption strips overlap.
    const invoke = vi.fn(() => Promise.resolve(false));
    vi.stubGlobal("__TAURI_INTERNALS__", {
      invoke,
      metadata: { currentWindow: { label: "main" } },
    });
    const { claims, stop } = collect();
    try {
      const t = mountControls({ variant: "standard" });
      const buttons = t.container.querySelectorAll<HTMLButtonElement>(
        ".hk-window-controls__btn",
      );
      expect(buttons).toHaveLength(3);
      expect(claims.map((c) => c.by)).toEqual(["HkWindowControls"]);
      expect(document.documentElement.getAttribute("data-hk-chrome")).toBe("app");

      buttons[0]!.click();
      buttons[1]!.click();
      buttons[2]!.click();
      await Promise.resolve();

      expect(invoke).toHaveBeenCalledWith(WINDOW_IPC.minimize, {});
      expect(invoke).toHaveBeenCalledWith(WINDOW_IPC.toggleMaximize, {});
      expect(invoke).toHaveBeenCalledWith(WINDOW_IPC.close, {});
      t.app.unmount();
    } finally {
      stop();
      cleanup();
    }
  });

  it("claims once, not once per render", async () => {
    // The maximized glyph re-renders the cluster; the takeover already happened.
    vi.stubGlobal("__TAURI__", {
      window: {
        getCurrentWindow: () => ({
          minimize: () => Promise.resolve(),
          toggleMaximize: () => Promise.resolve(),
          close: () => Promise.resolve(),
          isMaximized: () => Promise.resolve(true),
          onResized: () => Promise.resolve(() => {}),
        }),
      },
    });
    const { claims, stop } = collect();
    try {
      const t = mountControls({ variant: "standard" });
      await nextTick();
      await nextTick();
      await nextTick();

      // Proof the re-render happened: the maximize button now offers Restore.
      expect(t.container.querySelector('[aria-label="Restore"]')).not.toBeNull();
      expect(claims).toHaveLength(1);
      t.app.unmount();
    } finally {
      stop();
      cleanup();
    }
  });
});
