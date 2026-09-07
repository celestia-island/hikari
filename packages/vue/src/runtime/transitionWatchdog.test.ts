import { afterEach, describe, expect, it, vi } from "vitest";

import { armTransitionClassWatchdog, stripTransitionClasses } from "./transitionWatchdog";

afterEach(() => {
  vi.useRealTimers();
});

function makeEl(...classes: string[]): HTMLElement {
  const el = document.createElement("div");
  el.className = classes.join(" ");
  return el;
}

describe("stripTransitionClasses", () => {
  it("removes every name-prefixed transition class and keeps the rest", () => {
    const el = makeEl(
      "hk-modal-overlay",
      "hk-modal-overlay-enter-from",
      "hk-modal-overlay-enter-active",
      "other-class",
    );
    stripTransitionClasses(el, "hk-modal-overlay");
    expect(el.className).toBe("hk-modal-overlay other-class");
  });

  it("never strips a class merely containing the name mid-word", () => {
    const el = makeEl("hk-modal-overlay-v2");
    stripTransitionClasses(el, "hk-modal-overlay");
    expect(el.className).toBe("hk-modal-overlay-v2");
  });

  it("is a no-op on a class-less element", () => {
    const el = makeEl("hk-modal-overlay");
    stripTransitionClasses(el, "hk-modal-overlay");
    expect(el.className).toBe("hk-modal-overlay");
  });
});

describe("armTransitionClassWatchdog", () => {
  it("strips stuck transition classes once the budget lapses while open", () => {
    vi.useFakeTimers();
    const el = makeEl(
      "hk-modal-overlay",
      "hk-modal-overlay-enter-from",
      "hk-modal-overlay-enter-active",
    );
    armTransitionClassWatchdog(el, "hk-modal-overlay", () => true);
    vi.advanceTimersByTime(599);
    expect(el.classList.contains("hk-modal-overlay-enter-from")).toBe(true);
    vi.advanceTimersByTime(2);
    expect(el.className).toBe("hk-modal-overlay");
  });

  it("leaves the element alone once the surface closed (leave owns it)", () => {
    vi.useFakeTimers();
    const el = makeEl("hk-modal-overlay", "hk-modal-overlay-enter-from");
    armTransitionClassWatchdog(el, "hk-modal-overlay", () => false);
    vi.advanceTimersByTime(1000);
    expect(el.classList.contains("hk-modal-overlay-enter-from")).toBe(true);
  });

  it("disarming cancels the strip (a normal enter finalized)", () => {
    vi.useFakeTimers();
    const el = makeEl("hk-modal-overlay", "hk-modal-overlay-enter-active");
    const disarm = armTransitionClassWatchdog(el, "hk-modal-overlay", () => true);
    disarm();
    vi.advanceTimersByTime(1000);
    expect(el.classList.contains("hk-modal-overlay-enter-active")).toBe(true);
  });

  it("does nothing when no transition class is stuck", () => {
    vi.useFakeTimers();
    const el = makeEl("hk-modal-overlay");
    armTransitionClassWatchdog(el, "hk-modal-overlay", () => true);
    vi.advanceTimersByTime(1000);
    expect(el.className).toBe("hk-modal-overlay");
  });
});
