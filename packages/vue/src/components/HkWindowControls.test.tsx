import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";

import { RESIZE_POLL_MS, WINDOW_IPC } from "../runtime/windowChrome";

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

  it("swallows a rejected is_maximized (no unhandled rejection during boot)", async () => {
    // S2-6: the family's res/fatal-fallback.js raises the full-screen
    // "Application failed to load" landing on `unhandledrejection` — during
    // boot that is worse than a missing glyph, and the internals path polls,
    // so an unhandled rejection would repeat every 500ms.
    const invoke = vi.fn((command: string) =>
      command === WINDOW_IPC.isMaximized
        ? Promise.reject(new Error("window.is_maximized not allowed"))
        : Promise.resolve(false),
    );
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke });

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => void unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    const t = mountControls({ variant: "standard" });
    try {
      await new Promise((resolve) => setTimeout(resolve, 20));
      // The cluster still renders and the rejection never escaped.
      expect(
        t.container.querySelectorAll(".hk-window-controls__btn"),
      ).toHaveLength(3);
      expect(unhandled).toHaveLength(0);
    } finally {
      t.app.unmount();
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("swallows rejected minimize/close (no unhandled rejection, no fake state)", async () => {
    // S2-1 (R3): `void win.minimize()` without a rejection handler meant an
    // ACL refusal became an unhandledrejection — which the family's
    // res/fatal-fallback.js turns into the full-screen boot-failure landing —
    // while the button kept looking perfectly usable.
    const invoke = vi.fn((command: string) =>
      command === WINDOW_IPC.isMaximized
        ? Promise.resolve(false)
        : Promise.reject(new Error(`${command} not allowed`)),
    );
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke });

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => void unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    const t = mountControls({ variant: "standard" });
    try {
      const buttons = t.container.querySelectorAll<HTMLButtonElement>(
        ".hk-window-controls__btn",
      );
      buttons[0]!.click(); // minimize
      buttons[2]!.click(); // close
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(invoke).toHaveBeenCalledWith(WINDOW_IPC.minimize, {});
      expect(invoke).toHaveBeenCalledWith(WINDOW_IPC.close, {});
      expect(unhandled).toHaveLength(0);
    } finally {
      t.app.unmount();
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("stops the maximized poll when unmounted before onResized resolves (S2-7)", async () => {
    vi.useFakeTimers();
    try {
      const invoke = vi.fn((_command: string) => Promise.resolve(false));
      vi.stubGlobal("__TAURI_INTERNALS__", { invoke });

      const t = mountControls({ variant: "standard" });
      // Unmount while the awaited onResized() promise is still unresolved.
      t.app.unmount();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const isMaximizedCalls = () =>
        invoke.mock.calls.filter((call) => call[0] === WINDOW_IPC.isMaximized)
          .length;
      const afterUnmount = isMaximizedCalls();
      vi.advanceTimersByTime(5000);
      // An orphaned 500ms interval would keep polling a dead component.
      expect(isMaximizedCalls()).toBe(afterUnmount);
    } finally {
      vi.useRealTimers();
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

/**
 * THE 2026-11-12 USER REPORT: "最大化之后这个最大化图标居然没有任何变化" —
 * a maximized window whose caption button kept drawing the square and kept
 * announcing "Maximize".
 *
 * The fake shell below is a CLASS INSTANCE, exactly like Tauri 2's `Window`:
 * its methods live on the prototype and read `this.label`. Detaching one
 * (`const fn = win.isMaximized`) throws — that is the defect the resolver had.
 */
describe("HkWindowControls maximized glyph (the reported defect)", () => {
  class TauriWindowShell {
    label: string;
    maximized: boolean;
    resizeHandler: (() => void) | null = null;
    resizedSubscribed = 0;

    constructor(maximized = false) {
      this.label = "main";
      this.maximized = maximized;
    }

    // Every method reads `this.label` first, exactly like Tauri 2.12 — so a
    // detached call raises the engine's own
    // "Cannot read properties of undefined (reading 'label')".
    minimize(): Promise<void> {
      void this.label;
      return Promise.resolve();
    }

    toggleMaximize(): Promise<void> {
      void this.label;
      this.maximized = !this.maximized;
      return Promise.resolve();
    }

    close(): Promise<void> {
      void this.label;
      return Promise.resolve();
    }

    isMaximized(): Promise<boolean> {
      void this.label;
      return Promise.resolve(this.maximized);
    }

    onResized(handler: () => void): Promise<() => void> {
      void this.label;
      this.resizedSubscribed += 1;
      this.resizeHandler = handler;
      return Promise.resolve(() => {
        this.resizeHandler = null;
      });
    }
  }

  function stubShell(maximized = false): TauriWindowShell {
    const shell = new TauriWindowShell(maximized);
    vi.stubGlobal("__TAURI__", { window: { getCurrentWindow: () => shell } });
    return shell;
  }

  function maximizeButton(container: HTMLElement): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Maximize"]');
    if (!button) throw new Error("no maximize button rendered");
    return button;
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
    await nextTick();
  }

  it("draws Restore as soon as the shell reports a maximized window", async () => {
    stubShell(true);
    const t = mountControls({ variant: "standard" });
    await settle();

    expect(t.container.querySelector('[aria-label="Restore"]')).not.toBeNull();
    expect(t.container.querySelector('[aria-label="Maximize"]')).toBeNull();
    t.app.unmount();
  });

  it("flips the glyph after the user clicks maximize (the reported case)", async () => {
    const shell = stubShell(false);
    const t = mountControls({ variant: "standard" });
    await settle();

    // Before the click: the square, labelled Maximize.
    expect(t.container.querySelector('[aria-label="Maximize"]')).not.toBeNull();

    maximizeButton(t.container).click();
    await settle();

    // The fake shell really toggled, and the DOM followed it.
    expect(shell.maximized).toBe(true);
    const restore = t.container.querySelector('[aria-label="Restore"]');
    expect(restore).not.toBeNull();
    expect(t.container.querySelector('[aria-label="Maximize"]')).toBeNull();
    t.app.unmount();
  });

  it("follows a resize event that arrives without a click", async () => {
    const shell = stubShell(false);
    const t = mountControls({ variant: "standard" });
    await settle();
    expect(t.container.querySelector('[aria-label="Maximize"]')).not.toBeNull();

    // The OS maximized the window (double-click the title bar, a snap, a
    // window-manager shortcut): only the resize event announces it.
    shell.maximized = true;
    expect(shell.resizeHandler).not.toBeNull();
    shell.resizeHandler!();
    await settle();

    expect(t.container.querySelector('[aria-label="Restore"]')).not.toBeNull();
    t.app.unmount();
  });

  it("keeps the glyph when the shell has no resize event to offer (bounded poll)", async () => {
    vi.useFakeTimers();
    try {
      const shell = stubShell(false);
      // A shell whose subscription silently yields nothing callable: the only
      // way the glyph can follow is the bounded fallback poll.
      (shell as unknown as { onResized: unknown }).onResized = () =>
        Promise.resolve(undefined);

      const t = mountControls({ variant: "standard" });
      await settle();
      expect(t.container.querySelector('[aria-label="Maximize"]')).not.toBeNull();

      shell.maximized = true;
      vi.advanceTimersByTime(RESIZE_POLL_MS);
      await settle();

      expect(t.container.querySelector('[aria-label="Restore"]')).not.toBeNull();
      t.app.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops watching on unmount (no writes, no timers left behind)", async () => {
    vi.useFakeTimers();
    try {
      const shell = stubShell(false);
      (shell as unknown as { onResized: unknown }).onResized = () =>
        Promise.resolve(undefined);
      const t = mountControls({ variant: "standard" });
      await settle();
      const subscribed = shell.resizedSubscribed;

      t.app.unmount();
      // The fallback poll must die with the component...
      shell.maximized = true;
      vi.advanceTimersByTime(RESIZE_POLL_MS * 10);
      await settle();
      // ...and no re-subscription churn happened behind our back.
      expect(shell.resizedSubscribed).toBe(subscribed);
    } finally {
      vi.useRealTimers();
    }
  });
});
