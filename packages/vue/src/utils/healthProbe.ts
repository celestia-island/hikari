/**
 * Shared one-shot health-endpoint probe (P59-W2).
 *
 * `/api/health` (or any health-style endpoint) was fetched independently
 * by every app with its own timeout/body handling — shittim-chest's
 * useHealthProbe, plana-legacy's useEngineHealth, erp's status poll —
 * drifting apart in policy. This is the single primitive they all call:
 * one fetch, one AbortSignal timeout, one canonical minimal body shape.
 * Pure function, no app config — callers bring the URL.
 */

/** Minimal subset shared by all `/api/health` consumers. */
export interface HealthProbeBody {
  status: string;
  version: string;
  product: string;
  engine_version: string | null;
  build_hash: string | null;
  network?: unknown;
  [key: string]: unknown;
}

export interface HealthProbeResult {
  ok: boolean;
  /** HTTP round-trip latency in ms (present even when the body is not ok). */
  latencyMs: number;
  body: HealthProbeBody | null;
  /** Human-readable failure reason when !ok. */
  reason: string | null;
}

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Probe a health endpoint once. Never throws — returns a result.
 * `ok` means: HTTP 2xx AND parseable body (callers decide how to treat
 * `status` values like "degraded").
 */
export async function probeHealthEndpoint(
  url: string,
  opts: { timeoutMs?: number; fetchFn?: typeof fetch } = {},
): Promise<HealthProbeResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const started = performance.now();
  try {
    const resp = await fetchFn(url, {
      method: "GET",
      credentials: "include",
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    const latencyMs = Math.round(performance.now() - started);
    if (!resp.ok) {
      return { ok: false, latencyMs, body: null, reason: `HTTP ${resp.status}` };
    }
    const body = (await resp.json()) as HealthProbeBody;
    return { ok: true, latencyMs, body, reason: null };
  } catch (e) {
    const latencyMs = Math.round(performance.now() - started);
    const reason = e instanceof DOMException && e.name === "TimeoutError"
      ? "timeout"
      : e instanceof Error ? e.message : String(e);
    return { ok: false, latencyMs, body: null, reason };
  }
}
