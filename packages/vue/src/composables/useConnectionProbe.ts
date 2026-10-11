import { onMounted, onUnmounted, ref, type Ref } from "vue";

import { scheduleInterval, scheduleIntervalAfter, type IntervalHandle } from "../runtime/intervalBus";
import { reportHkRuntime, type HkRuntimeHandle } from "../runtime/registry";

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

// Runtime-registry reporting (the "context of contexts"): the probe is a
// per-component composable, so the MODULE is the hook — one registry
// entry counting live probe instances, with the configured endpoint in
// the read facet. Registration API unchanged.
let liveProbes = 0;
let probeRuntime: HkRuntimeHandle | null = null;
function ensureProbeRuntime(): HkRuntimeHandle {
  return (probeRuntime ??= reportHkRuntime("connectionProbe", {
    kind: "hook",
    description: "The fetch-based connectivity probe: per-component /api/health polling with retry and countdown.",
    read: () => ({ liveProbes, endpoint: endpointUrl() }),
  }));
}

/** Override the probed endpoint (defaults to same-origin `/api/health`). */
export function setProbeEndpoint(endpoint: string | (() => string)): void {
  probeEndpoint = endpoint;
}

function endpointUrl(): string {
  // A consumer-registered endpoint function returning undefined/null must
  // degrade to the same-origin default ("/api/health"), not crash the
  // probe loop — the TypeError from .replace-on-undefined is swallowed by
  // probeOnce's catch and permanently misreports the app as offline.
  const raw = typeof probeEndpoint === "function" ? probeEndpoint() : probeEndpoint;
  const base = (raw ?? "").replace(/\/+$/, "");
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
  // Set at unmount, read by schedulePoll: an in-flight probe resolving
  // AFTER unmount must not arm a fresh slot — that race resurrected a
  // 15s zombie loop polling forever on a dead component (R2 catch,
  // 2026-10-11). Late state writes into the dead ref are harmless;
  // late ARMING is not.
  let disposed = false;

  function applyCountdown(): void {
    const seconds = Math.max(0, Math.ceil((nextAttemptAt - Date.now()) / 1000));
    result.value = { ...result.value, countdown: seconds };
  }

  async function probeOnce(opts?: { quiet?: boolean }): Promise<void> {
    pollHandle?.disconnect();
    pollHandle = null;
    const wasConnected = result.value.connected;
    // Quiet re-checks (the scheduled poll while healthy) keep the light
    // GREEN through the fetch: flipping every healthy re-check through
    // "reconnecting" would blink the pill and re-fire the recovery flash
    // once per interval. A quiet re-check that FAILS falls through to
    // the ladder below — that transition is real and must show.
    const quiet = opts?.quiet === true && wasConnected;
    const attempt = result.value.attemptNumber + 1;
    if (!quiet) {
      result.value = {
        ...result.value,
        state: wasConnected ? "reconnecting" : "connecting",
        attemptNumber: attempt,
        retryCount: attempt,
        countdown: 0,
      };
    }
    const started = Date.now();
    try {
      const resp = await fetch(endpointUrl(), {
        method: "GET",
        credentials: "include",
      });
      const latencyMs = Date.now() - started;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      consecutiveFailures = 0;
      nextAttemptAt = 0;
      result.value = {
        ...result.value,
        connected: true,
        state: "connected",
        latencyMs,
        // The attempt counter is LADDER state, not a lifetime odometer:
        // a healthy probe zeroes it so the next outage's ladder reads
        // "Retrying 1/3" instead of an ever-growing number. Continuous
        // polling made this matter — the counter used to stop moving
        // once connected, so the creep was invisible.
        attemptNumber: 0,
        retryCount: 0,
        countdown: 0,
      };
      // Continuous observation (2026-10-11 auth-surface report): the
      // light must FOLLOW the backend, not just record the initial
      // verdict. Parked-forever-on-success meant a backend dying later
      // left a permanently green light on sessionless surfaces.
      schedulePoll(true);
    } catch {
      consecutiveFailures += 1;
      const failed = consecutiveFailures >= result.value.retryTotal;
      result.value = {
        ...result.value,
        connected: false,
        state: failed ? "failed" : "disconnected",
        latencyMs: null,
        attemptNumber: attempt,
        retryCount: attempt,
      };
      nextAttemptAt = Date.now() + DEFAULT_POLL_MS;
      applyCountdown();
      schedulePoll();
    }
  }

  function schedulePoll(quiet = false): void {
    // The zombie guard: an in-flight probe settling after unmount lands
    // here with nothing left to serve — arming would loop forever on a
    // dead component. Both call sites (success re-check AND the failure
    // ladder) route through this single gate.
    if (disposed) return;
    // Visibility-aware one-shot: the 15s window holds while the page is
    // hidden instead of burning down on a throttled background timer
    // (intervalBus — this is its designed case: data polling, not
    // animation). Retry-ladder hops stay loud; the success-path
    // re-check passes `quiet` so a healthy poll never blinks the light.
    pollHandle?.disconnect();
    pollHandle = scheduleIntervalAfter(() => {
      pollHandle = null;
      void probeOnce({ quiet });
    }, DEFAULT_POLL_MS);
  }

  function retryNow(): void {
    void probeOnce();
  }

  onMounted(() => {
    liveProbes += 1;
    ensureProbeRuntime().pulse({ liveProbes });
    void probeOnce();
    tickHandle = scheduleInterval(applyCountdown, 1000);
  });

  onUnmounted(() => {
    liveProbes = Math.max(0, liveProbes - 1);
    probeRuntime?.pulse({ liveProbes });
    // Disarm FIRST: an in-flight probe's late success must find the
    // guard already up when it reaches schedulePoll.
    disposed = true;
    pollHandle?.disconnect();
    pollHandle = null;
    tickHandle?.disconnect();
    tickHandle = null;
  });

  return { result, retryNow };
}
