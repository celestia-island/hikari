import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToast } from "../../runtime/useToast";
import { mirrorToBrowserIfHidden } from "./browserTransport";
import { toastTransport } from "./toastTransport";

type NotificationCtor = new (title: string, options?: NotificationOptions) => Notification;

class FakeNotification implements Partial<Notification> {
  static instances: FakeNotification[] = [];
  static permission: NotificationPermission = "granted";
  onclick: Notification["onclick"] = null;
  onclose: Notification["onclose"] = null;
  onerror: Notification["onerror"] = null;
  onshow: Notification["onshow"] = null;
  tag: string;
  title: string;
  body: string;
  constructor(title: string, options?: NotificationOptions & { body?: string }) {
    this.title = title;
    this.tag = options?.tag ?? "";
    this.body = options?.body ?? "";
    FakeNotification.instances.push(this);
  }
  close(): void { /* recorded by instances list */ }
  addEventListener(): void { /* noop */ }
  removeEventListener(): void { /* noop */ }
  dispatchEvent(): boolean { return false; }
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("toast → browser mirroring (P59-W5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeNotification.instances = [];
    FakeNotification.permission = "granted";
    vi.stubGlobal("Notification", FakeNotification as unknown as NotificationCtor);
    setHidden(false);
    const toast = useToast();
    for (const t of [...toast.toasts]) toast.remove(t.id);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setHidden(false);
  });

  it("direct toast errors mirror to a browser notification while hidden", () => {
    setHidden(true);
    const toast = useToast();
    toast.error("backend unreachable");
    expect(FakeNotification.instances).toHaveLength(1);
    expect(FakeNotification.instances[0]!.title).toContain("backend unreachable");
  });

  it("visible pages never mirror (the toast is the surface)", () => {
    const toast = useToast();
    toast.error("backend unreachable");
    expect(FakeNotification.instances).toHaveLength(0);
    expect(toast.toasts.length).toBeGreaterThan(0);
  });

  it("info/loading severities never mirror", () => {
    setHidden(true);
    const toast = useToast();
    toast.info("tick");
    toast.loading("loading…");
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("messaging-routed payloads do not double-notify while hidden", async () => {
    setHidden(true);
    // Full router path: useMessaging fires toast + browser transports for
    // actionable payloads when hidden; the toast transport must not mirror
    // a second notification on top of the router's browser fire.
    const { useMessaging } = await import("./index");
    const msg = useMessaging();
    msg.error("routed error");
    // One notification: the router's browser-transport fire. A mirrored
    // copy from the toast push would make this 2.
    expect(FakeNotification.instances).toHaveLength(1);
    expect(FakeNotification.instances[0]!.title).toContain("routed error");
    // And the toast still landed (the returning user sees it).
    const toast = useToast();
    expect(toast.toasts.some((t) => t.messages.some((m) => m.text === "routed error"))).toBe(true);
  });

  it("mirror no-ops without granted permission", () => {
    FakeNotification.permission = "denied";
    setHidden(true);
    const toast = useToast();
    toast.error("backend unreachable");
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("mirrorToBrowserIfHidden is a silent no-op while visible", () => {
    mirrorToBrowserIfHidden("error", "x", 1000, true);
    expect(FakeNotification.instances).toHaveLength(0);
  });
});
