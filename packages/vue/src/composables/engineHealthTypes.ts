/** Engine-health DTOs — the SHELL side of the split (the fetch hook
 * that fills them was demoted to the consuming app with the chat-kit
 * wave; the shapes stay so HkConnectionStatus's injection contract is
 * typed here). */

/** Connectivity probe result — the shape a host's injected probe
 * (HK_CONNECTION_PROBE) exposes. The fetch implementation that
 * produced it was demoted to the app; the shape stays as the shell's
 * contract. */
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


/** Inlined subset of the `/api/health` network payload — kept local so
 *  hikari stays dependency-free of protocol packages. */
export interface NetworkInfo {
  transport?: string;
  region?: string;
  asn?: number | null;
}

/** Inlined subset of the `/api/health` response envelope. */
export interface HealthResponse {
  engine_version?: string;
  build_hash?: string;
  network?: NetworkInfo;
}

export type { NetworkInfo as EngineNetworkInfo };

/** Subset of `/api/health` relevant to status-bar style consumers. */
export interface EngineHealth {
  engineVersion: string | null;
  engineBuildHash: string | null;
  network: NetworkInfo | null;
}
