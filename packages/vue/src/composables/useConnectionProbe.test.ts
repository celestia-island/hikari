import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, type Ref } from "vue";

import { useConnectionProbe, type ProbeResult } from "./useConnectionProbe";

/** The probe is a mount-scoped composable (onMounted drives the first
 *  fetch); each test rides a minimal component harness. Fake timers own
 *  both the clock (latency, countdown ladder) and the interval bus. */

interface Deferred {
  promise: Promise<Response>;
  resolve: (r: Response) => void;
  reject: (e: unknown) => void;
}

function deferredResponse(): Deferred {
  let resolve!: (r: Response) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function okResponse(): Response {
  return { ok: true } as Response;
}

function mountProbe() {
  let out!: { result: Ref<ProbeResult>; retryNow: () => void };
  const app = createApp(
    defineComponent({
      setup() {
        out = useConnectionProbe();
        return () => h("div");
      },
    }),
  );
  const container = document.createElement("div");
  document.body.appendChild(container);
  app.mount(container);
  return {
    probe: () => out,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("useConnectionProbe continuous observation", () => {
  it("keeps polling after a successful probe — parked-forever was the bug", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve(okResponse()));
    vi.stubGlobal("fetch", fetchMock);
    const { probe, unmount } = mountProbe();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(probe().result.value.state).toBe("connected");

      // The scheduled re-check fires 15s later — the light KEEPS
      // observing instead of recording the initial verdict forever.
      await vi.advanceTimersByTimeAsync(15_000);
      expect(fetchMock, "healthy backend keeps being polled").toHaveBeenCalledTimes(2);
      expect(probe().result.value.state).toBe("connected");
      expect(probe().result.value.connected).toBe(true);
    } finally {
      unmount();
    }
  });

  it("a healthy re-check stays GREEN in flight — no reconnecting blink, no flash", async () => {
    vi.useFakeTimers();
    const first = deferredResponse();
    const second = deferredResponse();
    // Route by call order: first mount fetch, then the scheduled re-check.
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls += 1;
      return calls === 1 ? first.promise : second.promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { probe, unmount } = mountProbe();
    try {
      first.resolve(okResponse());
      await vi.advanceTimersByTimeAsync(0);
      expect(probe().result.value.state).toBe("connected");

      // Fire the scheduled re-check and let it hang mid-fetch: the OLD
      // behavior flipped the state to "reconnecting" here (yellow blink
      // + recovery flash every interval). Quiet re-checks must not.
      await vi.advanceTimersByTimeAsync(15_000);
      await Promise.resolve(); // enter the awaiting fetch
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(probe().result.value.state, "in-flight re-check is quiet").toBe("connected");
      expect(probe().result.value.connected).toBe(true);

      second.resolve(okResponse());
      await vi.advanceTimersByTimeAsync(0);
      expect(probe().result.value.state).toBe("connected");
    } finally {
      unmount();
    }
  });

  it("a re-check that fails drops into the retry ladder and recovers", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(okResponse()); // mount: healthy
    fetchMock.mockRejectedValueOnce(new Error("backend died")); // re-check: dead
    fetchMock.mockResolvedValueOnce(okResponse()); // ladder retry: back
    vi.stubGlobal("fetch", fetchMock);
    const { probe, unmount } = mountProbe();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(probe().result.value.state).toBe("connected");

      await vi.advanceTimersByTimeAsync(15_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      // The failure is REAL and must show: red, disconnected, ladder
      // armed (attempt 1 of the retryTotal, countdown to the next try).
      expect(probe().result.value.connected).toBe(false);
      expect(probe().result.value.state).toBe("disconnected");
      expect(probe().result.value.attemptNumber).toBe(1);
      expect(probe().result.value.countdown).toBeGreaterThan(0);

      // Ladder retry succeeds: green again, and the attempt counter
      // RESET — a lifetime odometer would read "Retrying N/3" with N
      // grown by every healthy poll.
      await vi.advanceTimersByTimeAsync(15_000);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(probe().result.value.connected).toBe(true);
      expect(probe().result.value.state).toBe("connected");
      expect(probe().result.value.attemptNumber).toBe(0);
    } finally {
      unmount();
    }
  });

  it("stops observing once unmounted", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve(okResponse()));
    vi.stubGlobal("fetch", fetchMock);
    const { probe, unmount } = mountProbe();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    unmount();
    await vi.advanceTimersByTimeAsync(45_000);
    expect(fetchMock, "no polls after unmount").toHaveBeenCalledTimes(2);
    expect(probe().result.value.state).toBe("connected");
  });

  it("an in-flight probe settling AFTER unmount arms no zombie loop", async () => {
    vi.useFakeTimers();
    const hang = deferredResponse();
    const fetchMock = vi.fn(() => hang.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { probe, unmount } = mountProbe();
    // The race (R2 catch, 2026-10-11): the mount fetch is still in
    // flight when the component unmounts; its late SUCCESS used to arm
    // a fresh 15s slot on a dead component — a poll loop that never
    // stopped (4+ fetches per 45s, forever). The disposed guard must
    // swallow the arming; the late state write itself is harmless.
    unmount();
    hang.resolve(okResponse());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock, "no post-unmount polls, ever").toHaveBeenCalledTimes(1);
    expect(probe().result.value.connected, "late write is harmless").toBe(true);
  });
});
