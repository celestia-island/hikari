import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import { readHkRuntime } from "../runtime/registry";
import HkStatusTray from "./HkStatusTray";

/**
 * HkStatusTray behaviour: the gamepad cluster + clock surface, its size and
 * cadence knobs, the reduced-motion contract it now owns itself, and the
 * teardown of both intervals.
 *
 * The "md equals the shipped CSS" contract lives next door in
 * `HkStatusTray.size.test.ts` (it reads the sheets, not the DOM).
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

/** Advance fake time AND let Vue flush the re-render it caused: the
 *  interval callbacks write refs, and the DOM follows on the scheduler's
 *  microtask (not on the timer that fired). */
async function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  await nextTick();
}

function unmountAll() {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
}

/** Shape of the single `[data-active]` glyph, or null when none is active. */
function activeShape(container: HTMLElement): string | null {
  return container.querySelector(".s-status-bar-btn[data-active]")?.getAttribute("data-shape") ?? null;
}

function activeCount(container: HTMLElement): number {
  return container.querySelectorAll(".s-status-bar-btn[data-active]").length;
}

function clockText(container: HTMLElement): string {
  return container.querySelector(".s-status-bar-time")?.textContent ?? "";
}

/** Live intervalBus slot count — the registry's own read facet. */
function liveIntervalSlots(): number {
  const meta = readHkRuntime("intervalBus") as { slots?: number } | undefined;
  return meta?.slots ?? 0;
}

/** Stub the reduced-motion media query before mount (the component reads it
 *  in `onMounted`). The minimal object on purpose: `.matches` only, so the
 *  component's optional `addEventListener` path is exercised as absent. */
function stubReducedMotion(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches } as unknown as MediaQueryList);
}

beforeEach(() => {
  vi.useFakeTimers();
  // A fixed, unambiguous wall clock: 24h formatting of 10:20:30 is
  // locale-stable, unlike midnight (which some locales render as 24:00).
  vi.setSystemTime(new Date(2024, 4, 5, 10, 20, 30));
});

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("HkStatusTray", () => {
  it("renders the four gamepad glyphs in shape order plus one HH:MM:SS clock", async () => {
    const container = mount(h(HkStatusTray, {}));
    await nextTick();

    const buttons = [...container.querySelectorAll(".s-status-bar-btn")];
    expect(buttons.map((b) => b.getAttribute("data-shape"))).toEqual([
      "triangle",
      "circle",
      "x",
      "square",
    ]);
    expect(buttons).toHaveLength(4);

    expect(container.querySelector(".s-status-bar-system-tray")).not.toBeNull();
    expect(container.querySelector(".s-status-bar-gamepad")).not.toBeNull();
    expect(container.querySelectorAll(".s-status-bar-time")).toHaveLength(1);
    expect(clockText(container)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(clockText(container)).toBe("10:20:30");

    // Exactly one glyph is lit, and it is the first one on a fresh mount.
    expect(activeCount(container)).toBe(1);
    expect(activeShape(container)).toBe("triangle");
  });

  it("rotates one glyph per second by default (cycleMs = 1000)", async () => {
    const container = mount(h(HkStatusTray, {}));
    await nextTick();

    await advance(999);
    expect(activeShape(container)).toBe("triangle");

    await advance(1);
    expect(activeShape(container)).toBe("circle");
    await advance(1000);
    expect(activeShape(container)).toBe("x");
    await advance(1000);
    expect(activeShape(container)).toBe("square");
    await advance(1000);
    expect(activeShape(container)).toBe("triangle");
  });

  it("honours a custom cycleMs instead of the 1s default", async () => {
    const container = mount(h(HkStatusTray, { cycleMs: 250 }));
    await nextTick();

    await advance(250);
    expect(activeShape(container)).toBe("circle");
    expect(clockText(container)).toBe("10:20:30"); // 250ms < 1s: clock unmoved

    await advance(750);
    expect(clockText(container)).toBe("10:20:31");
    expect(activeShape(container)).toBe("triangle"); // 1000ms = 4 beats of 250ms
  });

  it("parks the glyph rotation under reduced motion while the clock keeps ticking", async () => {
    stubReducedMotion(true);
    const container = mount(h(HkStatusTray, {}));
    await nextTick();
    const first = clockText(container);

    await advance(5000);

    // Animation is off: the first glyph stays lit for the whole window …
    expect(activeShape(container)).toBe("triangle");
    expect(activeCount(container)).toBe(1);
    // … and the clock (data, not animation) still advances.
    expect(clockText(container)).not.toBe(first);
    expect(clockText(container)).toBe("10:20:35");
  });

  it("keeps rotating when reduced motion is NOT set (negative control)", async () => {
    stubReducedMotion(false);
    const container = mount(h(HkStatusTray, {}));
    await nextTick();

    await advance(1000);
    expect(activeShape(container)).toBe("circle");
  });

  it("disconnects both intervals on unmount", async () => {
    const before = liveIntervalSlots();

    const container = mount(h(HkStatusTray, {}));
    await nextTick();
    // Clock + glyph rotation.
    expect(liveIntervalSlots()).toBe(before + 2);

    unmountAll();
    expect(liveIntervalSlots()).toBe(before);

    // Nothing is left to fire: advancing time after teardown is inert (a
    // surviving slot would throw on the unmounted refs / keep the bus warm).
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();
    expect(liveIntervalSlots()).toBe(before);
    expect(container.isConnected).toBe(false);
  });
});
