import { onMounted, ref, type Ref } from "vue";

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

/**
 * Fetch `/api/health` once on mount and expose the engine/network subset.
 * Replaces per-app hand-rolled health fetches. Call `refresh()` to re-poll.
 *
 * @param baseUrl Optional API origin (defaults to same-origin "").
 */
export function useEngineHealth(baseUrl?: string): {
  health: Ref<EngineHealth | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  refresh: () => Promise<void>;
} {
  const health = ref<EngineHealth | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const base = (baseUrl ?? "").replace(/\/+$/, "");
      const resp = await fetch(`${base}/api/health`, {
        method: "GET",
        credentials: "include",
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const body = (await resp.json()) as HealthResponse;
      health.value = {
        engineVersion: body.engine_version ?? null,
        engineBuildHash: body.build_hash ?? null,
        network: body.network ?? null,
      };
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => { void refresh(); });

  return { health, loading, error, refresh };
}
