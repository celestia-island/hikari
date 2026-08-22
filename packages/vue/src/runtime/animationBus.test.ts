import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onFrame, type AnimationHandle } from "./animationBus";

// ── Fake-RAF harness ──────────────────────────────────────────────────
// The bus arms the next frame by calling requestAnimationFrame(tick); the
// harness captures that callback and lets each test drive tick() with an
// explicit timestamp, so deltas are fully deterministic.

let rafCallback: FrameRequestCallback | null = null;
let rafId = 0;
const handles: AnimationHandle[] = [];

function stubRaf() {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCallback = cb;
    return ++rafId;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    rafCallback = null;
  });
}

/** Run the bus for one frame at `now` (ms). The bus re-arms the next
 *  frame itself when entries remain. */
function fireRaf(now: number) {
  const cb = rafCallback;
  rafCallback = null;
  cb?.(now);
}

function tracked(handle: AnimationHandle): AnimationHandle {
  handles.push(handle);
  return handle;
}

beforeEach(() => {
  stubRaf();
});

afterEach(() => {
  for (const h of handles.splice(0)) h.disconnect();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  rafCallback = null;
  rafId = 0;
});

describe("animationBus per-entry delta", () => {
  it("hands normal-priority callbacks the elapsed time since their own last run", () => {
    // 60Hz-style ticks at 16.7ms; the 33ms normal budget fires the callback
    // every 2nd tick. The delta must be ≈2 ticks (0.033s) — NOT the shared
    // per-tick delta (0.0167s) that previously ran animations at half speed.
    const deltas: number[] = [];
    tracked(onFrame((ctx) => { deltas.push(ctx.delta); }, "normal"));

    fireRaf(0);
    fireRaf(16.7);
    fireRaf(33.4);
    fireRaf(50.1);
    fireRaf(66.8);
    fireRaf(83.5);

    expect(deltas.length).toBeGreaterThanOrEqual(2);
    for (const d of deltas) {
      expect(d).toBeCloseTo(0.033, 2);
      expect(d).not.toBeCloseTo(0.0167, 3);
    }
  });

  it("clamps the per-entry delta so a hiccup spike cannot teleport motion", () => {
    const deltas: number[] = [];
    tracked(onFrame((ctx) => { deltas.push(ctx.delta); }, "normal"));

    fireRaf(0);
    fireRaf(33.4); // normal firing: dt ≈ 0.033
    fireRaf(533.4); // 500ms gap since last run — must clamp at 0.1

    expect(deltas[0]).toBeCloseTo(0.033, 2);
    expect(deltas[1]).toBeCloseTo(0.1, 6);
    expect(deltas[1]).toBeLessThanOrEqual(0.1);
  });

  it("keeps the raw per-tick delta for sync entries", () => {
    const deltas: number[] = [];
    tracked(onFrame((ctx) => { deltas.push(ctx.delta); }, "sync"));

    fireRaf(100); // first tick: delta is 0 by bus convention
    fireRaf(116.7);
    fireRaf(133.4);

    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBeCloseTo(0.0167, 3);
    expect(deltas[2]).toBeCloseTo(0.0167, 3);
  });

  it("clamps idle-priority deltas to MAX_DELTA after a full 2000ms budget", () => {
    // Fake ONLY timers, not rAF — the harness drives rAF explicitly and
    // vitest's default fake-timers config would override the stub.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const deltas: number[] = [];
    tracked(onFrame((ctx) => { deltas.push(ctx.delta); }, "idle"));

    // Idle entries arm via setTimeout(IDLE_FRAME_BUDGET) → rAF → tick.
    vi.advanceTimersByTime(2000);
    fireRaf(2000);
    vi.advanceTimersByTime(2000);
    fireRaf(4000);

    expect(deltas).toEqual([0.1, 0.1]);
  });
});
