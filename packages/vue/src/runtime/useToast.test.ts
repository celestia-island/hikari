import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_TOASTS_PER_SLOT,
  useToast,
} from "./useToast";

function clearAll() {
  const { toasts, remove } = useToast();
  for (const t of [...toasts]) remove(t.id);
}

describe("useToast stacking and dedupe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAll();
  });
  afterEach(() => {
    clearAll();
    vi.useRealTimers();
  });

  it("dedupes identical consecutive messages in the same slot", () => {
    const toast = useToast();
    const firstId = toast.error("backend unreachable");
    const secondId = toast.error("backend unreachable");

    expect(toast.toasts).toHaveLength(1);
    expect(toast.toasts[0]!.messages).toHaveLength(1);
    // Replace semantics: the second push returns the existing entry id.
    expect(secondId).toBe(firstId);
    expect(toast.toasts[0]!.messages[0]!.text).toBe("backend unreachable");
  });

  it("keeps distinct consecutive messages", () => {
    const toast = useToast();
    toast.error("first");
    toast.error("second");

    expect(toast.toasts[0]!.messages.map((m) => m.text)).toEqual([
      "first",
      "second",
    ]);
  });

  it("dedupes only consecutive duplicates", () => {
    const toast = useToast();
    toast.error("a");
    toast.error("b");
    toast.error("b");

    expect(toast.toasts[0]!.messages.map((m) => m.text)).toEqual(["a", "b"]);
  });

  it("caps messages per slot at MAX_TOASTS_PER_SLOT, dropping the oldest", () => {
    const toast = useToast();
    for (let i = 0; i < MAX_TOASTS_PER_SLOT + 3; i++) {
      toast.error(`msg-${i}`);
    }

    expect(toast.toasts[0]!.messages).toHaveLength(MAX_TOASTS_PER_SLOT);
    const texts = toast.toasts[0]!.messages.map((m) => m.text);
    expect(texts[0]).toBe("msg-3"); // 0..2 dropped (oldest)
    expect(texts[texts.length - 1]).toBe(`msg-${MAX_TOASTS_PER_SLOT + 2}`);
  });

  it("caps each slot independently", () => {
    const toast = useToast();
    for (let i = 0; i < MAX_TOASTS_PER_SLOT + 2; i++) toast.error(`e-${i}`);
    for (let i = 0; i < MAX_TOASTS_PER_SLOT + 2; i++) toast.success(`s-${i}`);

    const errorSlot = toast.toasts.find((t) => t.type === "error")!;
    const successSlot = toast.toasts.find((t) => t.type === "success")!;
    expect(errorSlot.messages).toHaveLength(MAX_TOASTS_PER_SLOT);
    expect(successSlot.messages).toHaveLength(MAX_TOASTS_PER_SLOT);
  });

  it("dedupe still restarts the auto-dismiss clock (loading never dismisses)", () => {
    const toast = useToast();
    toast.info("pulse");
    const first = toast.toasts[0]!;
    // info duration is 3000ms — after 1000ms a duplicate push keeps a
    // single entry; the slot is still present at 2500ms (timer restarted).
    vi.advanceTimersByTime(1000);
    toast.info("pulse");
    expect(toast.toasts[0]!.messages).toHaveLength(1);
    vi.advanceTimersByTime(2499);
    expect(toast.toasts.some((t) => t.type === "info")).toBe(true);
  });
});

describe("useToast inline actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAll();
  });
  afterEach(() => {
    clearAll();
    vi.useRealTimers();
  });

  it("carries the action on the slot", () => {
    const toast = useToast();
    const run = vi.fn();
    toast.show("Player removed", {
      type: "success",
      duration: 8000,
      action: { label: "Undo", onClick: run },
    });
    const slot = toast.toasts.find((t) => t.type === "success")!;
    expect(slot.action?.label).toBe("Undo");
    expect(slot.action?.onClick).toBe(run);
  });

  it("the latest push owns the action (a plain message clears it)", () => {
    const toast = useToast();
    toast.show("Player removed", {
      type: "success",
      action: { label: "Undo", onClick: () => {} },
    });
    toast.success("Saved");
    expect(toast.toasts.find((t) => t.type === "success")!.action).toBeUndefined();
  });

  it("re-passing the action keeps it on the shared slot", () => {
    const toast = useToast();
    const first = { label: "Undo", onClick: () => {} };
    const second = { label: "Retry", onClick: () => {} };
    toast.show("Player removed", { type: "success", action: first });
    toast.show("Player removed again", { type: "success", action: second });
    // Reactive slots wrap the object — compare by value, not identity.
    expect(toast.toasts.find((t) => t.type === "success")!.action).toEqual(second);
  });
});

describe("useToast keyed slots", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAll();
  });
  afterEach(() => {
    clearAll();
    vi.useRealTimers();
  });

  it("a keyed push owns its own slot, not the shared type slot", () => {
    const toast = useToast();
    toast.error("transient boom"); // the shared error lane
    toast.show("machine incomplete", {
      type: "error",
      key: "shell.machine-status",
      duration: 0,
    });

    expect(toast.toasts).toHaveLength(2);
    const keyed = toast.toasts.find((t) => t.key === "shell.machine-status")!;
    expect(keyed.type).toBe("error");
    expect(keyed.messages.map((m) => m.text)).toEqual(["machine incomplete"]);
    expect(toast.toasts.find((t) => t.key === undefined)!.messages.map((m) => m.text))
      .toEqual(["transient boom"]);
  });

  it("an unkeyed push never lands in the keyed slot", () => {
    const toast = useToast();
    toast.show("machine incomplete", {
      type: "warning",
      key: "shell.machine-status",
      duration: 0,
    });
    toast.warning("careful"); // transient warning — the shared lane

    const keyed = toast.toasts.find((t) => t.key === "shell.machine-status")!;
    expect(keyed.messages).toHaveLength(1);
    expect(toast.toasts).toHaveLength(2);
  });

  it("re-pushes with the same key update the same keyed slot", () => {
    const toast = useToast();
    toast.show("machine incomplete", { type: "warning", key: "k", duration: 0 });
    const firstId = toast.show("machine incomplete", { type: "warning", key: "k", duration: 0 });
    const slot = toast.toasts.find((t) => t.key === "k")!;
    expect(slot.messages).toHaveLength(1); // identical text dedupes
    expect(firstId).toBe(slot.messages[0]!.id);

    toast.show("machine incomplete: wsl missing", { type: "warning", key: "k", duration: 0 });
    expect(toast.toasts.find((t) => t.key === "k")!.messages.map((m) => m.text)).toEqual([
      "machine incomplete",
      "machine incomplete: wsl missing",
    ]);
    expect(toast.toasts).toHaveLength(1);
  });

  it("a sticky keyed slot never expires and does not poison later unkeyed slots", () => {
    const toast = useToast();
    // The sticky status surface: duration 0 — no timer, ever.
    toast.show("machine incomplete", {
      type: "warning",
      key: "shell.machine-status",
      duration: 0,
    });
    // A LATER transient warning in the shared lane keeps its own lifetime.
    toast.warning("careful");
    vi.advanceTimersByTime(31_000);

    expect(toast.toasts).toHaveLength(1);
    const keyed = toast.toasts[0]!;
    expect(keyed.key).toBe("shell.machine-status");
    expect(keyed.duration).toBe(0);
  });

  it("an unkeyed slot created first does not retire the keyed sticky slot", () => {
    const toast = useToast();
    toast.warning("careful"); // creates the shared warning lane (30s)
    toast.show("machine incomplete", {
      type: "warning",
      key: "shell.machine-status",
      duration: 0,
    });
    vi.advanceTimersByTime(31_000);

    // The transient lane expired; the keyed sticky slot (own timer = none)
    // is untouched by the shared lane's clock.
    expect(toast.toasts).toHaveLength(1);
    expect(toast.toasts[0]!.key).toBe("shell.machine-status");
  });

  it("the keyed slot keeps its action across same-type transient pushes", () => {
    const toast = useToast();
    const run = vi.fn();
    toast.show("machine incomplete", {
      type: "warning",
      key: "shell.machine-status",
      duration: 0,
      action: { label: "Open settings", onClick: run },
    });
    toast.warning("careful"); // a plain push clears the SHARED slot's action
    toast.warning("careful again");

    const keyed = toast.toasts.find((t) => t.key === "shell.machine-status")!;
    expect(keyed.action?.label).toBe("Open settings");
    expect(toast.toasts.find((t) => t.key === undefined)!.action).toBeUndefined();
  });

  it("remove(message id) retires only the keyed slot", () => {
    const toast = useToast();
    toast.error("transient boom");
    const msgId = toast.show("machine incomplete", {
      type: "error",
      key: "shell.machine-status",
      duration: 0,
    });
    toast.remove(msgId);

    expect(toast.toasts).toHaveLength(1);
    expect(toast.toasts[0]!.messages[0]!.text).toBe("transient boom");
  });

  it("remove(slot id) retires the keyed slot too", () => {
    const toast = useToast();
    toast.show("machine incomplete", { type: "warning", key: "shell.machine-status", duration: 0 });
    const slot = toast.toasts.find((t) => t.key === "shell.machine-status")!;
    toast.remove(slot.id);

    expect(toast.toasts.find((t) => t.key === "shell.machine-status")).toBeUndefined();
  });

  it("the same key under a different type opens its own (key, type) slot", () => {
    const toast = useToast();
    toast.show("machine incomplete", { type: "warning", key: "shell.machine-status", duration: 0 });
    toast.show("machine broken", { type: "error", key: "shell.machine-status", duration: 0 });

    const slots = toast.toasts.filter((t) => t.key === "shell.machine-status");
    expect(slots.map((t) => t.type).sort()).toEqual(["error", "warning"]);
    // Each keeps its own tone and its own message list — no cross-tone merge.
    expect(slots.find((t) => t.type === "warning")!.messages.map((m) => m.text))
      .toEqual(["machine incomplete"]);
    expect(slots.find((t) => t.type === "error")!.messages.map((m) => m.text))
      .toEqual(["machine broken"]);
  });

  it("the per-slot cap applies to a keyed slot as well", () => {
    const toast = useToast();
    for (let i = 0; i < MAX_TOASTS_PER_SLOT + 2; i++) {
      toast.show(`status-${i}`, { type: "info", key: "k", duration: 0 });
    }
    const slot = toast.toasts.find((t) => t.key === "k")!;
    expect(slot.messages).toHaveLength(MAX_TOASTS_PER_SLOT);
    expect(slot.messages[0]!.text).toBe("status-2");
  });

  it("a later same-key push cannot un-stick a sticky keyed slot", () => {
    const toast = useToast();
    toast.show("machine incomplete", { type: "warning", key: "k", duration: 0 });
    // Even a push that PASSES a duration cannot rewrite the slot's clock:
    // duration is fixed at creation (the caller owns the slot's lifetime).
    toast.show("machine incomplete: wsl missing", { type: "warning", key: "k", duration: 30_000 });
    vi.advanceTimersByTime(31_000);

    const slot = toast.toasts.find((t) => t.key === "k")!;
    expect(slot, "still sticky — the 30s push did not arm a timer").toBeTruthy();
    expect(slot.duration).toBe(0);
  });
});
