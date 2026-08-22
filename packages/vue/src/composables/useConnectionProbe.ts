import { onMounted, onUnmounted, ref, type Ref } from "vue";

import { scheduleInterval, scheduleIntervalAfter, type IntervalHandle } from "../runtime/intervalBus";

/** Fetch-based connectivity probe — the hikari-local successor of the
 *  plana-ui probe. Polls `/api/health` (or a custom endpoint set via
 *  `setProbeEndpoint`) and derives the same ProbeResult shape consumers
 *  already read, without pulling in any RPC client dependency. */
export interface ProbeResult {
  connected: boolean;
  state: "connected" | "disconnected" | "connecting" | "reconnecting" | "failed";
  /** Canonical transport tier ("local" | "ws" | "sse" | "poll"). */
  transportTier: string;
  /** @deprecated Use `transportTier`. Alias kept for compatibility. */
  tier: string;
  latencyMs: number | null;
  /** Canonical 1-based connect-attempt counter. */
  attemptNumber: number;
  /** @deprecated Use `attemptNumber`. Alias kept for compatibility. */
  retryCount: number;
  retryTotal: number;
  /** Seconds until the next automatic probe attempt. */
  countdown: number;
}

const DEFAULT_POLL_MS = 15_000;
const DEFAULT_RETRY_TOTAL = 3;

let probeEndpoint: string | (() => string) = "";

/** Override the probed endpoint (defaults to same-origin `/api/health`). */
export function setProbeEndpoint(endpoint: string | (() => string)): void {
  probeEndpoint = endpoint;
}

function endpointUrl(): string {
  const base = (typeof probeEndpoint === "function" ? probeEndpoint() : probeEndpoint)
    .replace(/\/+$/, "");
  return `${base}/api/health`;
}

export function useConnectionProbe(): {
  result: Ref<ProbeResult>;
  retryNow: () => void;
} {
  const result = ref<ProbeResult>({
    connected: false,
    state: "connecting",
    transportTier: "poll",
    tier: "poll",
    latencyMs: null,
    attemptNumber: 0,
    retryCount: 0,
    retryTotal: DEFAULT_RETRY_TOTAL,
    countdown: 0,
  });

  let pollHandle: IntervalHandle | null = null;
  let tickHandle: IntervalHandle | null = null;
  let nextAttemptAt = 0;
  let consecutiveFailures = 0;

  function applyCountdown(): void {
    const seconds = Math.max(0, Math.ceil((nextAttemptAt - Date.now()) / 1000));
    result.value = { ...result.value, countdown: seconds };
  }

  async function probeOnce(): Promise<void> {
    pollHandle?.disconnect();
    pollHandle = null;
    const attempt = result.value.attemptNumber + 1;
    result.value = {
      ...result.value,
      state: result.value.connected ? "reconnecting" : "connecting",
      attemptNumber: attempt,
      retryCount: attempt,
      countdown: 0,
    };
    const started = Date.now();
    try {
      const resp = await fetch(endpointUrl(), {
        method: "GET",
        credentials: "include",
      });
      const latencyMs = Date.now() - started;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      consecutiveFailures = 0;
      result.value = {
        ...result.value,
        connected: true,
        state: "connected",
        latencyMs,
      };
    } catch {
      consecutiveFailures += 1;
      const failed = consecutiveFailures >= result.value.retryTotal;
      result.value = {
        ...result.value,
        connected: false,
        state: failed ? "failed" : "disconnected",
        latencyMs: null,
      };
      nextAttemptAt = Date.now() + DEFAULT_POLL_MS;
      applyCountdown();
      schedulePoll();
    }
  }

  function schedulePoll(): void {
    // Visibility-aware one-shot: the 15s retry window holds while the
    // page is hidden instead of burning down on a throttled background
    // timer (intervalBus — this is its designed case: data polling, not
    // animation).
    pollHandle?.disconnect();
    pollHandle = scheduleIntervalAfter(() => {
      pollHandle = null;
      void probeOnce();
    }, DEFAULT_POLL_MS);
  }

  function retryNow(): void {
    void probeOnce();
  }

  onMounted(() => {
    void probeOnce();
    tickHandle = scheduleInterval(applyCountdown, 1000);
  });

  onUnmounted(() => {
    pollHandle?.disconnect();
    pollHandle = null;
    tickHandle?.disconnect();
    tickHandle = null;
  });

  return { result, retryNow };
}
