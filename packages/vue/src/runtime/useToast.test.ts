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
