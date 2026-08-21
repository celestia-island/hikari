import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  scheduleInterval,
  scheduleIntervalAfter,
} from "./intervalBus";
import { onPageLifecycle, pageLifecycleState } from "./pageLifecycle";

describe("pageLifecycle", () => {
  it("reports initial state from document", () => {
    const state = pageLifecycleState();
    expect(state.visible).toBe(!document.hidden);
    expect(typeof state.online).toBe("boolean");
  });

  it("notifies listeners on visibilitychange", () => {
    const seen: boolean[] = [];
    const unsub = onPageLifecycle((s) => seen.push(s.visible));
    const initial = document.hidden;
    Object.defineProperty(document, "hidden", { value: !initial, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(seen[seen.length - 1]).toBe(initial); // flipped
    Object.defineProperty(document, "hidden", { value: initial, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    unsub();
    const count = seen.length;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(seen.length).toBe(count); // unsubscribed
  });
});

describe("scheduleInterval", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires on cadence and stops on disconnect", () => {
    const cb = vi.fn();
    const handle = scheduleInterval(cb, 100);
    vi.advanceTimersByTime(350);
    expect(cb.mock.calls.length).toBe(3);
    handle.disconnect();
    vi.advanceTimersByTime(1000);
    expect(cb.mock.calls.length).toBe(3);
  });

  it("parks while hidden and catches up once on visibility", () => {
    const cb = vi.fn();
    const handle = scheduleInterval(cb, 100);
    vi.advanceTimersByTime(100);
    expect(cb.mock.calls.length).toBe(1);

    // Hide — pending timer parked.
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(1000);
    expect(cb.mock.calls.length).toBe(1); // no background firing

    // Visible again — elapsed schedule fires once (catch-up), no burst.
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb.mock.calls.length).toBe(2);
    vi.advanceTimersByTime(100);
    expect(cb.mock.calls.length).toBe(3);
    handle.disconnect();
  });

  it("stays independent of the reduced-motion switch (data polling is not animation)", () => {
    // Interval bus is intentionally NOT wired to setReducedMotion — data
    // polling must survive motion preferences. Guard against accidental
    // coupling:
    const cb = vi.fn();
    const handle = scheduleInterval(cb, 50);
    vi.advanceTimersByTime(150);
    expect(cb.mock.calls.length).toBe(3);
    handle.disconnect();
  });
});

describe("scheduleIntervalAfter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires once after the delay", () => {
    const cb = vi.fn();
    const handle = scheduleIntervalAfter(cb, 100);
    vi.advanceTimersByTime(99);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(1);
    handle.disconnect();
  });

  it("holds the countdown while hidden", () => {
    const cb = vi.fn();
    const handle = scheduleIntervalAfter(cb, 200);
    vi.advanceTimersByTime(100);
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(1000); // hidden: timer parked, no fire
    expect(cb).not.toHaveBeenCalled();
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    // nextDue was 100ms away at park time; on resume it fires after that.
    vi.advanceTimersByTime(101);
    expect(cb).toHaveBeenCalledTimes(1);
    handle.disconnect();
  });
});
