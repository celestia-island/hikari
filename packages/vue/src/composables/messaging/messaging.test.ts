import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToast } from "@celestia-island/hikari";
import { registerNativeBridge, registerTransport, useMessaging } from "./index";
import type { MessagePayload, MessageTransport } from "./types";

function flushToasts() {
  const { toasts, remove } = useToast();
  while (toasts.length > 0) remove(toasts[0].id);
}

function makeStubTransport(name: MessageTransport["name"]): MessageTransport & {
  calls: MessagePayload[];
} {
  const calls: MessagePayload[] = [];
  return {
    name,
    available: () => true,
    send: (p) => calls.push(p),
    calls,
  };
}

describe("useMessaging", () => {
  beforeEach(() => {
    flushToasts();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("severity helpers", () => {
    it("error() routes through the toast transport by default", () => {
      const { toasts } = useToast();
      const { error } = useMessaging();
      error("boom");
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe("error");
      expect(toasts[0].messages[0].text).toBe("boom");
      expect(toasts[0].duration).toBe(30_000);
      expect(toasts[0].copyable).toBe(true);
    });

    it("warning() shares the 30s long-lived duration", () => {
      const { toasts } = useToast();
      const { warning } = useMessaging();
      warning("careful");
      expect(toasts[0].type).toBe("warning");
      expect(toasts[0].duration).toBe(30_000);
    });

    it("success/info keep the short duration", () => {
      const { toasts } = useToast();
      const { success, info } = useMessaging();
      success("yep");
      expect(toasts[0].duration).toBe(3_000);
      info("hi");
      expect(toasts[1].duration).toBe(3_000);
    });

    it("notify() accepts an explicit duration override", () => {
      const { toasts } = useToast();
      const { notify } = useMessaging();
      notify("manual", { severity: "error", duration: 1_000 });
      expect(toasts[0].duration).toBe(1_000);
    });
  });

  describe("transport allow-list", () => {
    it("respects transports: ['toast'] to suppress other channels", () => {
      const stub = makeStubTransport("native");
      const unregister = registerTransport(stub);
      const { notify } = useMessaging();
      notify("hi", { severity: "info", transports: ["toast"] });
      expect(stub.calls).toHaveLength(0);
      unregister();
    });

    it("still routes to whitelisted transports", () => {
      const stub = makeStubTransport("native");
      const unregister = registerTransport(stub);
      const { notify } = useMessaging();
      notify("hi", { severity: "info", transports: ["toast", "native"] });
      expect(stub.calls).toHaveLength(1);
      unregister();
    });
  });

  describe("registerTransport", () => {
    it("is idempotent on name and replaces the prior transport", () => {
      const a = makeStubTransport("native");
      const b = makeStubTransport("native");
      const unA = registerTransport(a);
      const unB = registerTransport(b);
      const { notify } = useMessaging();
      notify("x", { severity: "info", transports: ["native"] });
      expect(a.calls).toHaveLength(0);
      expect(b.calls).toHaveLength(1);
      unB();
      unA();
    });

    it("unregister handle removes the transport", () => {
      const stub = makeStubTransport("native");
      const unregister = registerTransport(stub);
      const { notify } = useMessaging();
      notify("x", { severity: "info", transports: ["native"] });
      expect(stub.calls).toHaveLength(1);
      stub.calls.length = 0;
      unregister();
      notify("y", { severity: "info", transports: ["native"] });
      expect(stub.calls).toHaveLength(0);
    });

    it("skips transports that report unavailable", () => {
      const unavailableStub: MessageTransport = {
        name: "native",
        available: () => false,
        send: vi.fn(),
      };
      const unregister = registerTransport(unavailableStub);
      const { notify } = useMessaging();
      notify("x", { severity: "info", transports: ["native"] });
      expect(unavailableStub.send).not.toHaveBeenCalled();
      unregister();
    });

    it("isolates a transport failure — other transports still fire", () => {
      const exploding: MessageTransport = {
        name: "native",
        available: () => true,
        send: () => {
          throw new Error("boom");
        },
      };
      const un = registerTransport(exploding);
      const { toasts } = useToast();
      const { notify } = useMessaging();
      expect(() => notify("x", { severity: "info" })).not.toThrow();
      // Toast transport should still have fired despite the native throw.
      expect(toasts.length).toBeGreaterThan(0);
      un();
    });
  });

  describe("registerNativeBridge", () => {
    it("no-ops when window.__nativeBridge is absent", () => {
      const w = window as unknown as { __nativeBridge?: unknown };
      const original = w.__nativeBridge;
      delete w.__nativeBridge;
      try {
        const unregister = registerNativeBridge();
        expect(typeof unregister).toBe("function");
        // With no native bridge registered, a message restricted to the
        // "native" allow-list must not be delivered to ANY transport —
        // including the always-present toast surface.
        const { toasts } = useToast();
        const { notify } = useMessaging();
        notify("native hi", { severity: "info", transports: ["native"] });
        expect(toasts).toHaveLength(0);
        unregister();
      } finally {
        if (original !== undefined) w.__nativeBridge = original;
      }
    });

    it("registers a discovered bridge under the 'native' name", () => {
      const calls: MessagePayload[] = [];
      const bridge = {
        name: "custom" as const,
        available: () => true,
        send: (p: MessagePayload) => calls.push(p),
      };
      const w = window as unknown as { __nativeBridge?: unknown };
      const original = w.__nativeBridge;
      w.__nativeBridge = bridge;
      try {
        const unregister = registerNativeBridge();
        const { notify } = useMessaging();
        notify("native hi", { severity: "warning", transports: ["native"] });
        expect(bridge.name).toBe("native");
        expect(calls).toHaveLength(1);
        expect(calls[0].severity).toBe("warning");
        unregister();
      } finally {
        if (original !== undefined) w.__nativeBridge = original;
        else delete w.__nativeBridge;
      }
    });
  });

  describe("browser transport gating", () => {
    it("does not throw when Notification is unavailable (SSR-like)", () => {
      const w = window as unknown as { Notification?: unknown };
      const original = w.Notification;
      delete w.Notification;
      try {
        const { toasts } = useToast();
        const { error } = useMessaging();
        expect(() => error("no Notification API")).not.toThrow();
        // Toast still covers the user.
        expect(toasts).toHaveLength(1);
      } finally {
        if (original !== undefined) w.Notification = original;
      }
    });

    it("defaults requireInteraction to true only for errors", async () => {
      const created: Array<{ title: string; requireInteraction: boolean }> = [];
      const w = window as unknown as {
        Notification?: typeof Notification;
      };
      const Original = w.Notification;
      class FakeNotification {
        static permission: NotificationPermission = "granted";
        static requestPermission = vi.fn().mockResolvedValue("granted");
        title: string;
        options?: NotificationOptions;
        onclick: (() => void) | null = null;
        close() {}
        constructor(title: string, options?: NotificationOptions) {
          this.title = title;
          this.options = options;
          created.push({ title, requireInteraction: !!options?.requireInteraction });
        }
      }
      w.Notification = FakeNotification as unknown as typeof Notification;
      try {
        // Exercise the browser transport's `send()` directly to assert the
        // severity-driven requireInteraction default (the public routing
        // layer is covered elsewhere).
        const { browserTransport } = await import("./browserTransport");
        browserTransport.send({
          id: 1,
          severity: "error",
          message: "boom",
          timestamp: Date.now(),
          pageHidden: true,
        });
        browserTransport.send({
          id: 2,
          severity: "warning",
          message: "careful",
          timestamp: Date.now(),
          pageHidden: true,
        });
        expect(created).toHaveLength(2);
        expect(created[0].requireInteraction).toBe(true); // error → sticky
        expect(created[1].requireInteraction).toBe(false); // warning → transient
      } finally {
        if (Original !== undefined) w.Notification = Original;
      }
    });
  });
});
