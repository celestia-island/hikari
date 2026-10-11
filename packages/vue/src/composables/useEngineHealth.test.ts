import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, type Ref } from "vue";

import { useEngineHealth, type EngineHealth } from "./useEngineHealth";

/** useEngineHealth is mount-scoped (onMounted drives the first fetch);
 *  each test rides a minimal component harness. Fake timers own the
 *  30s refresh loop. */

interface Deferred {
  promise: Promise<Response>;
  resolve: (r: Response) => void;
}

function deferredJsonResponse(): Deferred {
  let resolve!: (r: Response) => void;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function okBody(body: Record<string, unknown>): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

function mountHealth() {
  let out!: {
    health: Ref<EngineHealth | null>;
    loading: Ref<boolean>;
    error: Ref<string | null>;
    refresh: () => Promise<void>;
  };
  const app = createApp(
    defineComponent({
      setup() {
        out = useEngineHealth();
        return () => h("div");
      },
    }),
  );
  const container = document.createElement("div");
  document.body.appendChild(container);
  app.mount(container);
  return {
    api: () => out,
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

describe("useEngineHealth refresh loop", () => {
  it("recovers the engine row after a transient mount-time failure", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    fetchMock.mockRejectedValueOnce(new Error("transient")); // mount: fails
    fetchMock.mockResolvedValueOnce(okBody({ engine_version: "9.8.7", build_hash: "abc1234" }));
    vi.stubGlobal("fetch", fetchMock);
    const { api, unmount } = mountHealth();
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(api().health.value, "mount-time failure blanks the row").toBeNull();
      expect(api().error.value).toBeTruthy();

      // The one-shot era left this row dead for the page's whole life;
      // the 30s loop revives it (2026-10-11 auth-surface report).
      await vi.advanceTimersByTimeAsync(30_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(api().health.value?.engineVersion).toBe("9.8.7");
      expect(api().health.value?.engineBuildHash).toBe("abc1234");
      expect(api().error.value).toBeNull();
    } finally {
      unmount();
    }
  });

  it("keeps the row fresh on cadence and stops on unmount", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve(okBody({ engine_version: "1.0.0" })));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = mountHealth();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock, "cadence refresh fires").toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    unmount();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(fetchMock, "no refreshes after unmount").toHaveBeenCalledTimes(3);
  });

  it("never stacks requests — a slow refresh skips the next beat", async () => {
    vi.useFakeTimers();
    const slow = deferredJsonResponse();
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(okBody({ engine_version: "1.0.0" })); // mount
    fetchMock.mockImplementationOnce(() => slow.promise); // t+30s: hangs
    vi.stubGlobal("fetch", fetchMock);
    const { api, unmount } = mountHealth();
    try {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(api().loading.value).toBe(true);

      // The t+60s beat arrives while the t+30s refresh still hangs — it
      // must be skipped, not stacked.
      await vi.advanceTimersByTimeAsync(30_000);
      expect(fetchMock, "in-flight refresh holds the beat").toHaveBeenCalledTimes(2);

      slow.resolve(okBody({ engine_version: "2.0.0" }));
      await vi.advanceTimersByTimeAsync(0);
      expect(api().loading.value).toBe(false);
      expect(api().health.value?.engineVersion).toBe("2.0.0");
    } finally {
      unmount();
    }
  });
});
