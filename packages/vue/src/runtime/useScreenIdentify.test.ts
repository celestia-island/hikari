import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readHkRuntime } from "./registry";
import {
  SCREEN_IDENTIFY_DEFAULT_MS,
  SCREEN_IDENTIFY_TICK_MS,
  dismissScreenIdentify,
  showScreenIdentify,
  useScreenIdentify,
} from "./useScreenIdentify";

/**
 * The identify context (2026-11-05 upstream of chest's overlay):
 * - a show flashes the payload for the default dwell and auto-hides;
 * - the remaining time ticks down (the card prints whole seconds);
 * - a second show RESTARTS the dwell instead of stacking;
 * - durationMs <= 0 holds the card open until dismissed (no countdown);
 * - every ref handed out is read-only and the runtime registry answers
 *   "is a flash up, for which screen, how long left?".
 */

const identify = useScreenIdentify();

beforeEach(() => {
  vi.useFakeTimers();
  dismissScreenIdentify();
});

afterEach(() => {
  dismissScreenIdentify();
  vi.useRealTimers();
});

describe("useScreenIdentify", () => {
  it("starts idle with no payload and no countdown", () => {
    expect(identify.active.value).toBe(false);
    expect(identify.remainingMs.value).toBe(0);
    expect(identify.secondsLeft.value).toBe(0);
    expect(identify.name.value).toBeUndefined();
  });

  it("flashes the payload for the default dwell and auto-hides", () => {
    showScreenIdentify({ number: 3, name: "Screen AB12" });
    expect(identify.active.value).toBe(true);
    expect(identify.number.value).toBe(3);
    expect(identify.name.value).toBe("Screen AB12");
    expect(identify.remainingMs.value).toBe(SCREEN_IDENTIFY_DEFAULT_MS);
    expect(identify.secondsLeft.value).toBe(3);

    vi.advanceTimersByTime(SCREEN_IDENTIFY_DEFAULT_MS);
    expect(identify.active.value).toBe(false);
    expect(identify.remainingMs.value).toBe(0);
    expect(identify.secondsLeft.value).toBe(0);
  });

  it("ticks the remaining time down and rolls the seconds", () => {
    showScreenIdentify({ number: 1 });
    vi.advanceTimersByTime(SCREEN_IDENTIFY_TICK_MS);
    expect(identify.remainingMs.value).toBe(SCREEN_IDENTIFY_DEFAULT_MS - SCREEN_IDENTIFY_TICK_MS);

    vi.advanceTimersByTime(1000);
    expect(identify.secondsLeft.value).toBe(2);
    vi.advanceTimersByTime(1000);
    expect(identify.secondsLeft.value).toBe(1);
  });

  it("keeps the seconds clamped to at least 1 while active", () => {
    // The digit unmounts with the card at dwell end; a mid-frame 0.4s
    // remainder must not render "0" on a card that is still up.
    showScreenIdentify({ number: 2 });
    vi.advanceTimersByTime(SCREEN_IDENTIFY_DEFAULT_MS - 250);
    expect(identify.active.value).toBe(true);
    expect(identify.secondsLeft.value).toBe(1);
  });

  it("restarts the dwell on a second show instead of stacking cards", () => {
    showScreenIdentify({ number: 1 });
    vi.advanceTimersByTime(2000);
    showScreenIdentify({ number: 2, name: "Second" });
    expect(identify.number.value).toBe(2);
    expect(identify.name.value).toBe("Second");
    expect(identify.remainingMs.value).toBe(SCREEN_IDENTIFY_DEFAULT_MS);

    // The FIRST deadline must be gone: 1000ms from the first show is
    // 1s into the second flash, not the end of it.
    vi.advanceTimersByTime(1000);
    expect(identify.active.value).toBe(true);
    vi.advanceTimersByTime(SCREEN_IDENTIFY_DEFAULT_MS - 1000);
    expect(identify.active.value).toBe(false);
  });

  it("honours a custom dwell", () => {
    showScreenIdentify({ number: 1, durationMs: 1000 });
    expect(identify.remainingMs.value).toBe(1000);
    vi.advanceTimersByTime(999);
    expect(identify.active.value).toBe(true);
    vi.advanceTimersByTime(1);
    expect(identify.active.value).toBe(false);
  });

  it("holds the card open when durationMs <= 0 (no countdown)", () => {
    showScreenIdentify({ number: 9, durationMs: 0 });
    expect(identify.active.value).toBe(true);
    expect(identify.remainingMs.value).toBe(0);
    expect(identify.secondsLeft.value).toBe(0);
    vi.advanceTimersByTime(SCREEN_IDENTIFY_DEFAULT_MS * 10);
    expect(identify.active.value).toBe(true);

    dismissScreenIdentify();
    expect(identify.active.value).toBe(false);
  });

  it("dismisses immediately and clears the payload name", () => {
    showScreenIdentify({ number: 4, name: "Named" });
    dismissScreenIdentify();
    expect(identify.active.value).toBe(false);
    expect(identify.remainingMs.value).toBe(0);
    expect(identify.name.value).toBeUndefined();
    // The lingering number is harmless (inactive); dismiss is idempotent.
    dismissScreenIdentify();
    expect(identify.active.value).toBe(false);
  });

  it("reports its live state through the runtime registry", () => {
    expect(readHkRuntime("screenIdentify")).toMatchObject({ active: false });
    showScreenIdentify({ number: 5, name: "Kiosk", durationMs: 1000 });
    expect(readHkRuntime("screenIdentify")).toMatchObject({
      active: true,
      number: 5,
      name: "Kiosk",
      remainingMs: 1000,
    });
    vi.advanceTimersByTime(500);
    expect(readHkRuntime("screenIdentify")).toMatchObject({ remainingMs: 500 });
    dismissScreenIdentify();
    expect(readHkRuntime("screenIdentify")).toMatchObject({ active: false });
  });
});
