// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-Flash) and the ZCode agent (model GLM-5.3), directed and reviewed
// by langyo — SySL-1.0 §2.3 disclosure.

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLOSE_ACK_COMMAND,
  CLOSE_REQUEST_EVENT,
  DEFAULT_FORCE_CLOSE_AFTER_MS,
  ackCloseRequest,
  useCloseRequest,
} from "./closeGuard";

/**
 * The close-request handshake runtime half.
 *
 * The ack-before-handler ordering is the whole contract: a shell arms a
 * force-close watchdog before emitting `hk:close-requested`, so the frontend
 * must prove it is alive BEFORE its (potentially blocking) quit dialog runs.
 * These tests mock only the two Tauri surfaces the module talks to — the
 * `__TAURI_INTERNALS__` IPC path and the documented `__TAURI__.event.listen`
 * fallback — and pin the exact wire shapes `@tauri-apps/api/event` uses.
 */

/** Let every queued microtask (and one macrotask) settle. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("constants", () => {
  it("pins the protocol strings the shell and the frontend share", () => {
    expect(CLOSE_REQUEST_EVENT).toBe("hk:close-requested");
    expect(CLOSE_ACK_COMMAND).toBe("plugin:hikari-host|ack_close");
    expect(DEFAULT_FORCE_CLOSE_AFTER_MS).toBe(5000);
  });
});

describe("ackCloseRequest", () => {
  it("resolves false outside a Tauri webview (never throws)", async () => {
    await expect(ackCloseRequest()).resolves.toBe(false);
  });

  it("invokes the ack command with an empty argument object", async () => {
    const invoke = vi.fn(() => Promise.resolve());
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke });

    await expect(ackCloseRequest()).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(CLOSE_ACK_COMMAND, {});
  });

  it("resolves false when the command rejects or throws synchronously", async () => {
    const rejecting = vi.fn(() => Promise.reject(new Error("old shell")));
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke: rejecting });
    await expect(ackCloseRequest()).resolves.toBe(false);

    const throwing = vi.fn(() => {
      throw new Error("ipc gone");
    });
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke: throwing });
    await expect(ackCloseRequest()).resolves.toBe(false);
  });
});

describe("useCloseRequest: internals event path", () => {
  interface Harness {
    order: string[];
    invoke: ReturnType<typeof vi.fn>;
    transformCallback: ReturnType<typeof vi.fn>;
    unregister: ReturnType<typeof vi.fn>;
    listener: () => ((event: unknown) => void) | null;
  }

  function internalsHarness(): Harness {
    const order: string[] = [];
    let listener: ((event: unknown) => void) | null = null;
    const invoke = vi.fn((command: string) => {
      if (command === CLOSE_ACK_COMMAND) {
        order.push("ack");
        return Promise.resolve();
      }
      if (command === "plugin:event|listen") return Promise.resolve(42);
      return Promise.resolve();
    });
    const transformCallback = vi.fn((callback: (event: unknown) => void) => {
      listener = callback;
      return 7;
    });
    const unregister = vi.fn();
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke, transformCallback });
    vi.stubGlobal("__TAURI_EVENT_PLUGIN_INTERNALS__", {
      unregisterListener: unregister,
    });
    return {
      order,
      invoke,
      transformCallback,
      unregister,
      listener: () => listener,
    };
  }

  it("acks BEFORE the host handler, using the Tauri 2 event protocol", async () => {
    const harness = internalsHarness();
    const handler = vi.fn(() => void harness.order.push("handler"));

    const off = useCloseRequest(handler);
    await settle();

    // Listen face: transformCallback + plugin:event|listen with the Any target.
    expect(harness.transformCallback).toHaveBeenCalledTimes(1);
    expect(harness.invoke).toHaveBeenCalledWith("plugin:event|listen", {
      event: CLOSE_REQUEST_EVENT,
      target: { kind: "Any" },
      handler: 7,
    });

    const listener = harness.listener();
    expect(listener).not.toBeNull();
    listener!({ event: CLOSE_REQUEST_EVENT, id: 1, payload: null });

    // The ack hit the shell before the handler ran (the ordering the watchdog
    // depends on). The listener delivered the event once.
    expect(harness.order).toEqual(["ack", "handler"]);
    expect(harness.invoke).toHaveBeenCalledWith(CLOSE_ACK_COMMAND, {});
    expect(handler).toHaveBeenCalledTimes(1);

    off();
  });

  it("unlistens on both sides and is idempotent", async () => {
    const harness = internalsHarness();
    const off = useCloseRequest(() => undefined);
    await settle();

    off();
    await settle();
    expect(harness.invoke).toHaveBeenCalledWith("plugin:event|unlisten", {
      event: CLOSE_REQUEST_EVENT,
      eventId: 42,
    });
    // Mirrors @tauri-apps/api/event: drop the JS callback first.
    expect(harness.unregister).toHaveBeenCalledWith(CLOSE_REQUEST_EVENT, 42);

    // A second dispose must not unlisten twice.
    off();
    await settle();
    const unlistenCalls = harness.invoke.mock.calls.filter(
      (call) => call[0] === "plugin:event|unlisten",
    );
    expect(unlistenCalls).toHaveLength(1);
  });

  it("releases the listener when disposed before the subscription resolves", async () => {
    let resolveListen: ((eventId: number) => void) | null = null;
    const invoke = vi.fn((command: string) => {
      if (command === "plugin:event|listen") {
        return new Promise<number>((resolve) => {
          resolveListen = resolve;
        });
      }
      return Promise.resolve();
    });
    vi.stubGlobal("__TAURI_INTERNALS__", {
      invoke,
      transformCallback: vi.fn(() => 5),
    });

    const off = useCloseRequest(() => undefined);
    off(); // before plugin:event|listen resolves
    resolveListen!(9);
    await settle();

    expect(invoke).toHaveBeenCalledWith("plugin:event|unlisten", {
      event: CLOSE_REQUEST_EVENT,
      eventId: 9,
    });
  });

  it("stays safe when the shell refuses the subscription", async () => {
    const invoke = vi.fn((command: string) => {
      if (command === "plugin:event|listen") {
        return Promise.reject(new Error("no event plugin"));
      }
      return Promise.resolve();
    });
    vi.stubGlobal("__TAURI_INTERNALS__", {
      invoke,
      transformCallback: vi.fn(() => 3),
    });

    const off = useCloseRequest(() => undefined);
    await settle();
    expect(off).toBeTypeOf("function");
    off(); // must not throw
  });

  it("runs the handler even when the ack command fails", async () => {
    let listener: ((event: unknown) => void) | null = null;
    const order: string[] = [];
    const invoke = vi.fn((command: string) => {
      if (command === CLOSE_ACK_COMMAND) {
        order.push("ack");
        return Promise.reject(new Error("older shell without ack"));
      }
      return Promise.resolve(command === "plugin:event|listen" ? 1 : undefined);
    });
    vi.stubGlobal("__TAURI_INTERNALS__", {
      invoke,
      transformCallback: vi.fn((callback: (event: unknown) => void) => {
        listener = callback;
        return 1;
      }),
    });
    vi.stubGlobal("__TAURI_EVENT_PLUGIN_INTERNALS__", {
      unregisterListener: vi.fn(),
    });

    useCloseRequest(() => void order.push("handler"));
    await settle();
    listener!({});
    expect(order).toEqual(["ack", "handler"]);
  });
});

describe("useCloseRequest: documented global fallback", () => {
  it("uses __TAURI__.event.listen when the internals surface is incomplete", async () => {
    let listener: ((event: unknown) => void) | null = null;
    const unlisten = vi.fn();
    const listen = vi.fn((_event: string, callback: (event: unknown) => void) => {
      listener = callback;
      return Promise.resolve(unlisten);
    });
    const invoke = vi.fn(() => Promise.resolve());
    // An internals surface WITHOUT transformCallback: not enough to listen.
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke });
    vi.stubGlobal("__TAURI__", { event: { listen } });

    const handler = vi.fn();
    const off = useCloseRequest(handler);
    await settle();

    expect(listen).toHaveBeenCalledWith(CLOSE_REQUEST_EVENT, expect.any(Function));
    listener!({});
    expect(handler).toHaveBeenCalledTimes(1);
    // The ack still rides the internals invoke surface.
    expect(invoke).toHaveBeenCalledWith(CLOSE_ACK_COMMAND, {});

    off();
    await settle();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});

describe("useCloseRequest: no shell / SSR", () => {
  it("returns a safe no-op outside a Tauri webview", () => {
    const handler = vi.fn();
    const off = useCloseRequest(handler);
    expect(off).toBeTypeOf("function");
    expect(() => off()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns a safe no-op during SSR (no window)", async () => {
    vi.stubGlobal("window", undefined);
    const off = useCloseRequest(() => undefined);
    expect(() => off()).not.toThrow();
    await expect(ackCloseRequest()).resolves.toBe(false);
  });
});
