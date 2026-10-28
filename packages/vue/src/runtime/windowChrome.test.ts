import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CHROME_CLAIM_EVENT,
  CHROME_OWNER_ATTR,
  RESIZE_POLL_MS,
  WINDOW_IPC,
  claimWindowChrome,
  resolveWindowApi,
} from "./windowChrome";

/**
 * The `hk:chrome-claim` handoff primitive: one dispatched event + one document
 * marker, used by HkTitleBar / HkWindowControls to tell hikari's boot bar
 * (boot-chrome.js) that real window chrome exists now.
 */

afterEach(() => {
  document.documentElement.removeAttribute(CHROME_OWNER_ATTR);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function collect(): { claims: Array<{ by?: string }>; stop: () => void } {
  const claims: Array<{ by?: string }> = [];
  const listener = (event: Event) => {
    claims.push((event as CustomEvent<{ by?: string }>).detail ?? {});
  };
  window.addEventListener(CHROME_CLAIM_EVENT, listener);
  return {
    claims,
    stop: () => window.removeEventListener(CHROME_CLAIM_EVENT, listener),
  };
}

describe("claimWindowChrome", () => {
  it("marks the app as the chrome owner and names the claimer", () => {
    const { claims, stop } = collect();
    try {
      expect(claimWindowChrome("HkTitleBar")).toBe(true);

      expect(claims).toHaveLength(1);
      expect(claims[0]?.by).toBe("HkTitleBar");
      expect(document.documentElement.getAttribute(CHROME_OWNER_ATTR)).toBe("app");
    } finally {
      stop();
    }
  });

  it("exports the event name the boot bar listens for", () => {
    expect(CHROME_CLAIM_EVENT).toBe("hk:chrome-claim");
    expect(CHROME_OWNER_ATTR).toBe("data-hk-chrome");
  });

  it("still hands off when the engine has no CustomEvent constructor", () => {
    // Old/edge webviews: the constructor path throws, the bare Event path must
    // still tell the boot bar to stand down (it never reads the detail).
    class Exploding {
      constructor() {
        throw new TypeError("CustomEvent is not a constructor");
      }
    }
    vi.stubGlobal("CustomEvent", Exploding);

    const fired: Event[] = [];
    const listener = (event: Event) => void fired.push(event);
    window.addEventListener(CHROME_CLAIM_EVENT, listener);
    try {
      expect(claimWindowChrome("HkWindowControls")).toBe(true);
      expect(fired).toHaveLength(1);
      expect((fired[0] as CustomEvent).detail).toBeUndefined();
      expect(document.documentElement.getAttribute(CHROME_OWNER_ATTR)).toBe("app");
    } finally {
      window.removeEventListener(CHROME_CLAIM_EVENT, listener);
    }
  });

  it("keeps every claim independent (no latch, no crash)", () => {
    const { claims, stop } = collect();
    try {
      claimWindowChrome("HkTitleBar");
      claimWindowChrome("HkWindowControls");
      expect(claims.map((c) => c.by)).toEqual(["HkTitleBar", "HkWindowControls"]);
    } finally {
      stop();
    }
  });
});

describe("resolveWindowApi", () => {
  function globalWindow(overrides: Record<string, unknown> = {}) {
    return {
      label: "main",
      minimize: vi.fn(() => Promise.resolve()),
      toggleMaximize: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve()),
      isMaximized: vi.fn(() => Promise.resolve(true)),
      onResized: vi.fn(() => Promise.resolve(() => {})),
      ...overrides,
    };
  }

  it("returns null when the host injected no shell at all", () => {
    expect(resolveWindowApi()).toBeNull();
  });

  it("prefers the documented __TAURI__ window API", async () => {
    const win = globalWindow();
    vi.stubGlobal("__TAURI__", { window: { getCurrentWindow: () => win } });
    // A complete internals surface must NOT win over the documented API.
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn() });

    const api = resolveWindowApi();
    expect(api).not.toBeNull();
    expect(api!.kind).toBe("global");
    expect(api!.label).toBe("main");

    await api!.minimize();
    await api!.toggleMaximize();
    await api!.close();
    await expect(api!.isMaximized()).resolves.toBe(true);
    expect(win.minimize).toHaveBeenCalledTimes(1);
    expect(win.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(win.close).toHaveBeenCalledTimes(1);

    const handler = vi.fn();
    const off = await api!.onResized(handler);
    expect(win.onResized).toHaveBeenCalledWith(handler);
    expect(typeof off).toBe("function");
  });

  it("falls back to __TAURI_INTERNALS__ IPC when __TAURI__ is missing", async () => {
    // The reported 2026-10-28 boot: the documented API was late/absent while
    // the IPC surface was there. Components must still get real controls.
    const invoke = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal("__TAURI_INTERNALS__", {
      invoke,
      metadata: { currentWindow: { label: "main" } },
    });

    const api = resolveWindowApi();
    expect(api).not.toBeNull();
    expect(api!.kind).toBe("internals");
    expect(api!.label).toBe("main");

    await api!.minimize();
    expect(invoke).toHaveBeenLastCalledWith(WINDOW_IPC.minimize, {});
    await api!.toggleMaximize();
    expect(invoke).toHaveBeenLastCalledWith(WINDOW_IPC.toggleMaximize, {});
    await api!.close();
    expect(invoke).toHaveBeenLastCalledWith(WINDOW_IPC.close, {});
    await expect(api!.isMaximized()).resolves.toBe(true);
    expect(invoke).toHaveBeenLastCalledWith(WINDOW_IPC.isMaximized, {});
  });

  it("coerces the IPC maximized answer to a boolean", async () => {
    vi.stubGlobal("__TAURI_INTERNALS__", {
      invoke: vi.fn(() => Promise.resolve(undefined)),
    });
    await expect(resolveWindowApi()!.isMaximized()).resolves.toBe(false);
  });

  it("falls through an incomplete __TAURI__ window object", () => {
    vi.stubGlobal("__TAURI__", {
      window: { getCurrentWindow: () => ({ minimize: () => Promise.resolve() }) },
    });
    const invoke = vi.fn(() => Promise.resolve(false));
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke });
    expect(resolveWindowApi()!.kind).toBe("internals");

    // ...and with no IPC either, an incomplete global surface is just absent.
    vi.stubGlobal("__TAURI_INTERNALS__", {});
    expect(resolveWindowApi()).toBeNull();
  });

  it("survives a shell whose getCurrentWindow throws", () => {
    vi.stubGlobal("__TAURI__", {
      window: {
        getCurrentWindow: () => {
          throw new Error("ipc not ready");
        },
      },
    });
    expect(resolveWindowApi()).toBeNull();
  });

  it("polls instead of listening (Any-target listeners never see window resize)", async () => {
    // S2-4: Tauri 2 delivers window resize events to Window{label} /
    // WebviewWindow{label} targets, so a `listen("tauri://resize")` with the
    // default target receives nothing. The internals path polls instead, even
    // when an event API happens to be around.
    vi.useFakeTimers();
    const listen = vi.fn(() => Promise.resolve(() => {}));
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn(() => Promise.resolve(false)) });
    vi.stubGlobal("__TAURI__", { event: { listen } });

    const api = resolveWindowApi();
    expect(api!.kind).toBe("internals");

    const handler = vi.fn();
    const unlisten = await api!.onResized(handler);
    expect(listen).not.toHaveBeenCalled();

    vi.advanceTimersByTime(RESIZE_POLL_MS);
    expect(handler).toHaveBeenCalledTimes(1);

    unlisten();
    vi.advanceTimersByTime(RESIZE_POLL_MS * 2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("polls the maximized flag when the internals path has no event API", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn(() => Promise.resolve(false)) });

    const api = resolveWindowApi();
    const handler = vi.fn();
    const unlisten = await api!.onResized(handler);

    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(RESIZE_POLL_MS);
    expect(handler).toHaveBeenCalledTimes(1);

    unlisten();
    vi.advanceTimersByTime(RESIZE_POLL_MS * 3);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("rejects (never throws) when a shell call blows up", async () => {
    vi.stubGlobal("__TAURI_INTERNALS__", {
      invoke: () => {
        throw new Error("ipc gone");
      },
    });
    await expect(resolveWindowApi()!.close()).rejects.toThrow("ipc gone");
  });
});
