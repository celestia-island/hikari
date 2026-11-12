import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CHROME_CLAIM_EVENT,
  CHROME_OWNER_ATTR,
  NO_UNLISTEN,
  RESIZE_FALLBACK_TICKS,
  RESIZE_POLL_MS,
  WINDOW_IPC,
  claimWindowChrome,
  resolveWindowApi,
  watchMaximizedState,
  type WindowApiLike,
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

  /**
   * THE 2026-11-12 REGRESSION, in the shape Tauri actually hands out.
   *
   * `getCurrentWindow()` returns a CLASS INSTANCE: the methods live on the
   * prototype and read `this.label`. Reading one off the instance
   * (`const fn = win.isMaximized; fn()`) loses the receiver and throws
   * "Cannot read properties of undefined (reading 'label')" — which is exactly
   * what the caption cluster swallowed, leaving a square glyph on a maximized
   * window. This fake throws the same way, so removing the receiver fix from
   * `globalWindowApi()` turns the assertions below RED.
   */
  class TauriWindowShell {
    label: string;
    maximized = false;
    resizeHandler: (() => void) | null = null;

    constructor(label: string) {
      this.label = label;
    }

    // Every method starts by reading `this.label`, exactly like Tauri 2.12.
    // The throw is NOT simulated: detached (`const f = w.isMaximized; f()`),
    // `this` is undefined and the engine itself raises
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
      this.resizeHandler = handler;
      return Promise.resolve(() => {
        this.resizeHandler = null;
      });
    }
  }

  function stubShell(): TauriWindowShell {
    const shell = new TauriWindowShell("main");
    vi.stubGlobal("__TAURI__", { window: { getCurrentWindow: () => shell } });
    return shell;
  }

  it("keeps the shell receiver: a prototype method still works after resolution", async () => {
    const shell = stubShell();
    shell.maximized = true;

    const api = resolveWindowApi();
    expect(api!.kind).toBe("global");
    await expect(api!.isMaximized()).resolves.toBe(true);

    // ...and follows the shell, in both directions.
    shell.maximized = false;
    await expect(api!.isMaximized()).resolves.toBe(false);
    shell.maximized = true;
    await expect(api!.isMaximized()).resolves.toBe(true);

    // The three commands keep their receiver too (this file used to be split:
    // they were thunks, isMaximized was detached).
    await expect(api!.minimize()).resolves.toBeUndefined();
    await expect(api!.toggleMaximize()).resolves.toBeUndefined();
    await expect(api!.close()).resolves.toBeUndefined();
    expect(shell.maximized).toBe(false); // toggleMaximize really ran
  });

  it("subscribes through the shell receiver, so resize events arrive", async () => {
    const shell = stubShell();
    const api = resolveWindowApi();

    let fired = 0;
    const off = await api!.onResized(() => void (fired += 1));
    expect(typeof off).toBe("function");
    expect(off).not.toBe(NO_UNLISTEN);
    shell.resizeHandler?.();
    expect(fired).toBe(1);

    off();
    expect(shell.resizeHandler).toBeNull();
  });

  /**
   * The sentinel contract `watchMaximizedState` relies on to decide whether its
   * bounded fallback poll is needed. If a path ever silently returns a DIFFERENT
   * dead handle, the fallback would disable itself — this pins both directions.
   */
  it("returns the documented NO_UNLISTEN sentinel when a path cannot subscribe", async () => {
    // Global path without onResized (Tauri builds that omit the event API).
    const win = globalWindow({
      onResized: undefined,
      isMaximized: vi.fn(() => Promise.resolve(true)),
    });
    vi.stubGlobal("__TAURI__", { window: { getCurrentWindow: () => win } });
    const globalApi = resolveWindowApi();
    expect(globalApi!.kind).toBe("global");
    await expect(globalApi!.onResized(() => {})).resolves.toBe(NO_UNLISTEN);

    // Internals path always polls, so it always hands back a REAL handle.
    vi.unstubAllGlobals();
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn(() => Promise.resolve(false)) });
    const internalsApi = resolveWindowApi();
    expect(internalsApi!.kind).toBe("internals");
    const off = await internalsApi!.onResized(() => {});
    expect(off).not.toBe(NO_UNLISTEN);
    expect(typeof off).toBe("function");
    off();
  });
});

/**
 * `watchMaximizedState` — the ONE read path for the caption glyph.
 *
 * The reported bug (2026-11-12) was not just a detached receiver: it was that
 * each consumer hand-rolled "read once + subscribe + hope". These tests pin the
 * replacement contract so a future consumer cannot get it wrong again.
 */
describe("watchMaximizedState", () => {
  /** A complete fake api whose subscription behaviour each test chooses. */
  function apiWith(options: {
    maximized?: boolean;
    onResized?: (handler: () => void) => Promise<() => void>;
    isMaximized?: () => Promise<boolean>;
  } = {}) {
    const calls = { isMaximized: 0, onResized: 0 };
    const api: WindowApiLike = {
      kind: "global",
      label: "main",
      minimize: () => Promise.resolve(),
      toggleMaximize: () => Promise.resolve(),
      close: () => Promise.resolve(),
      isMaximized: () => {
        calls.isMaximized += 1;
        return options.isMaximized
          ? options.isMaximized()
          : Promise.resolve(!!options.maximized);
      },
      onResized: (handler: () => void) => {
        calls.onResized += 1;
        return options.onResized
          ? options.onResized(handler)
          : Promise.resolve(() => {});
      },
    };
    return { api, calls };
  }

  it("reports the current state immediately (first paint is already right)", async () => {
    const { api } = apiWith({ maximized: true });
    const seen: boolean[] = [];
    const stop = watchMaximizedState(api, (value) => void seen.push(value));
    try {
      await Promise.resolve();
      await Promise.resolve();
      expect(seen).toEqual([true]);
    } finally {
      stop();
    }
  });

  it("follows the shell when a resize event fires", async () => {
    let handler: (() => void) | null = null;
    let maximized = false;
    const { api, calls } = apiWith({
      onResized: (fn) => {
        handler = fn;
        return Promise.resolve(() => void (handler = null));
      },
      isMaximized: () => Promise.resolve(maximized),
    });

    const seen: boolean[] = [];
    const stop = watchMaximizedState(api, (value) => void seen.push(value));
    await Promise.resolve();
    await Promise.resolve();
    expect(calls.onResized).toBe(1);

    // The OS maximized the window: only the resize event announces it.
    const resize = handler as (() => void) | null;
    expect(resize).not.toBeNull();
    maximized = true;
    resize!();
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([false, true]);
    stop();
  });

  it("does NOT poll while the shell publishes events (no needless IPC)", async () => {
    vi.useFakeTimers();
    const { api, calls } = apiWith();
    const stop = watchMaximizedState(api, () => {});
    await Promise.resolve();
    await Promise.resolve();
    const afterSubscription = calls.isMaximized;
    expect(calls.onResized).toBe(1);

    vi.advanceTimersByTime(RESIZE_POLL_MS * 20);
    expect(calls.isMaximized).toBe(afterSubscription);
    stop();
  });

  it("does NOT arm a second poll on the internals path (it already polls)", async () => {
    // The internals path brings its own 500ms poll as `onResized`, and it hands
    // back a REAL unlisten. A fallback poll here would double the IPC traffic.
    vi.useFakeTimers();
    const invoke = vi.fn((_command: string) => Promise.resolve(false));
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke });

    const api = resolveWindowApi();
    expect(api!.kind).toBe("internals");
    const reads = () =>
      invoke.mock.calls.filter((call) => call[0] === WINDOW_IPC.isMaximized).length;

    const stop = watchMaximizedState(api, () => {});
    await Promise.resolve();
    await Promise.resolve();

    // One tick = exactly ONE read (the internals poll), not two.
    const before = reads();
    vi.advanceTimersByTime(RESIZE_POLL_MS);
    expect(reads() - before).toBe(1);
    stop();
  });

  it("falls back to a BOUNDED poll when the shell refuses to subscribe", async () => {
    vi.useFakeTimers();
    const { api, calls } = apiWith({
      onResized: () => Promise.reject(new Error("no event permission")),
    });
    const stop = watchMaximizedState(api, () => {});
    await Promise.resolve();
    await Promise.resolve();
    const before = calls.isMaximized;

    vi.advanceTimersByTime(RESIZE_POLL_MS * 3);
    expect(calls.isMaximized - before).toBe(3);

    // ...and it gives up instead of polling a broken shell forever.
    vi.advanceTimersByTime(RESIZE_POLL_MS * (RESIZE_FALLBACK_TICKS + 5));
    const afterBudget = calls.isMaximized;
    vi.advanceTimersByTime(RESIZE_POLL_MS * 10);
    expect(calls.isMaximized).toBe(afterBudget);
    stop();
  });

  it("falls back when the shell throws synchronously instead of returning a promise", async () => {
    vi.useFakeTimers();
    const { api, calls } = apiWith();
    api.onResized = () => {
      throw new Error("boom");
    };
    const stop = watchMaximizedState(api, () => {});
    await Promise.resolve();
    const before = calls.isMaximized;
    vi.advanceTimersByTime(RESIZE_POLL_MS * 2);
    expect(calls.isMaximized - before).toBe(2);
    stop();
  });

  it("falls back when the subscription resolves with something that is not a function", async () => {
    vi.useFakeTimers();
    const { api, calls } = apiWith();
    api.onResized = () => Promise.resolve(undefined as never);
    const stop = watchMaximizedState(api, () => {});
    await Promise.resolve();
    await Promise.resolve();
    const before = calls.isMaximized;
    vi.advanceTimersByTime(RESIZE_POLL_MS);
    expect(calls.isMaximized - before).toBe(1);
    stop();
  });

  it("stops everything on dispose (resize handler and fallback poll)", async () => {
    vi.useFakeTimers();
    let handler: (() => void) | null = null;
    let offCalls = 0;
    const { api, calls } = apiWith({
      onResized: () => {
        return Promise.resolve(() => {
          offCalls += 1;
          handler = null;
        });
      },
    });
    api.onResized = (fn: () => void) => {
      handler = fn;
      return Promise.resolve(() => {
        offCalls += 1;
        handler = null;
      });
    };

    const seen: boolean[] = [];
    const stop = watchMaximizedState(api, (value) => void seen.push(value));
    await Promise.resolve();
    await Promise.resolve();
    stop();
    expect(offCalls).toBe(1);
    expect(handler).toBeNull();

    const afterDispose = calls.isMaximized;
    vi.advanceTimersByTime(RESIZE_POLL_MS * 5);
    expect(calls.isMaximized).toBe(afterDispose);
    expect(seen).toHaveLength(1);
  });

  it("disposes an unmatched subscription that resolves after teardown", async () => {
    let release: ((off: () => void) => void) | null = null;
    let offCalls = 0;
    const { api } = apiWith();
    api.onResized = () =>
      new Promise<() => void>((resolve) => {
        release = (off) => resolve(off);
      });

    const stop = watchMaximizedState(api, () => {});
    stop();
    release!(() => void (offCalls += 1));
    await Promise.resolve();
    await Promise.resolve();
    // A subscription that arrives after teardown must be released, not leaked.
    expect(offCalls).toBe(1);
  });

  it("never leaves an unhandled rejection behind (boot-fatal on this family)", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => void unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    vi.useFakeTimers();
    const { api } = apiWith({
      isMaximized: () => Promise.reject(new Error("window.is_maximized not allowed")),
      onResized: () => Promise.reject(new Error("no listen permission")),
    });
    const stop = watchMaximizedState(api, () => {});
    try {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(RESIZE_POLL_MS * 3);
      // Fake timers: the rejection has to be observed through microtasks only
      // (a real setTimeout here would never fire inside advanceTimersByTime).
      for (let i = 0; i < 12; i += 1) vi.advanceTimersByTime(0);
      await Promise.resolve();
      expect(unhandled).toHaveLength(0);
    } finally {
      stop();
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("never lets a THROWING reporter surface as an unhandled rejection", async () => {
    // N1 (verification round 2026-11-12): a throw inside the FULFILLMENT arm is
    // not caught by the sibling rejection arm — without the guard it escapes as
    // a real unhandledRejection, and res/fatal-fallback.js turns one into the
    // full-screen boot-failure landing. The reporter here is exactly the shape
    // a consumer can hand over (writing into a torn-down ref, say).
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => void unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    let maximized = false;
    // The resize handle rides an object holder: closure-variable narrowing
    // would pin the local to `null` for the control-flow analyzer and turn the
    // later call site into `never`.
    const channel: { resize: (() => void) | null } = { resize: null };
    const { api } = apiWith({
      isMaximized: () => Promise.resolve(maximized),
      onResized: (fn) => {
        channel.resize = fn;
        return Promise.resolve(() => void (channel.resize = null));
      },
    });
    const seen: boolean[] = [];
    const stop = watchMaximizedState(api, (value) => {
      seen.push(value);
      throw new Error("report blew up");
    });
    try {
      await Promise.resolve();
      await Promise.resolve();
      expect(seen).toEqual([false]);
      expect(unhandled).toHaveLength(0);

      // The watcher itself survives the consumer's throw: the next resize event
      // still delivers an observation.
      maximized = true;
      channel.resize!();
      await Promise.resolve();
      await Promise.resolve();
      expect(seen).toEqual([false, true]);
      expect(unhandled).toHaveLength(0);
    } finally {
      stop();
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("treats a SYNCHRONOUSLY throwing shell read like a rejected read", () => {
    // N2 (same round): only reachable with a foreign WindowApiLike — the
    // library's own resolver wraps every call in call() — but the helper is
    // public now, so a throwing isMaximized must degrade, not propagate.
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => void unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    const { api } = apiWith({ maximized: true });
    const throwing = (): never => {
      throw new Error("ipc gone");
    };
    api.isMaximized = throwing;
    const seen: boolean[] = [];
    const handle: { stop: (() => void) | null } = { stop: null };
    try {
      expect(() => {
        handle.stop = watchMaximizedState(api, (value) => void seen.push(value));
      }).not.toThrow();
      expect(seen).toEqual([]);
    } finally {
      handle.stop?.();
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("survives a HOSTILE unlisten handle on dispose and on late resolution", async () => {
    const hostile = (): Promise<() => void> =>
      Promise.resolve(() => {
        throw new Error("unlisten blew up");
      });
    // Late resolution after teardown: the release call must not throw.
    const { api: lateApi } = apiWith();
    lateApi.onResized = hostile;
    const stopLate = watchMaximizedState(lateApi, () => {});
    stopLate();
    await Promise.resolve();
    await Promise.resolve();

    // Live subscription torn down through the dispose handle.
    const { api } = apiWith();
    api.onResized = hostile;
    const stop = watchMaximizedState(api, () => {});
    await Promise.resolve();
    await Promise.resolve();
    expect(() => stop()).not.toThrow();
  });

  it("returns a callable no-op handle when there is no shell at all", () => {
    const stop = watchMaximizedState(null, () => {});
    expect(typeof stop).toBe("function");
    expect(() => stop()).not.toThrow();
    expect(() => stop()).not.toThrow(); // idempotent
  });
});
