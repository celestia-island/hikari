import { computed, type Ref } from "vue";

function detectRegion(): string {
  const lang = navigator.language;
  const regionMap: Record<string, string> = {
    zh: "CN", "zh-CN": "CN", "zh-Hans": "CN",
    "zh-TW": "TW", "zh-HK": "HK",
    ja: "JP", ko: "KR", de: "DE", fr: "FR", es: "ES", pt: "PT",
    ar: "SA", ru: "RU", en: "US",
  };
  return regionMap[lang] ?? lang.split("-")[1]?.toUpperCase() ?? lang.toUpperCase();
}

function isLocalhostUrl(): boolean {
  try {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch { return false; }
}

export type ConnectionStateInput =
  | "connected"
  | "disconnected"
  | "connecting"
  | "reconnecting"
  | "failed";

export interface HkConnectionInfo {
  state: "connected" | "reconnecting" | "disconnected";
  tier: string;
  quality: string;
  latencyMs: number | null;
  isLocalhost: boolean;
  region: string;
  retryCount: number;
  maxRetries: number;
  asn: number | null;
  attemptNumber: number;
  countdown: number;
}

export function useConnectionInfo(
  connectionState: Ref<ConnectionStateInput>,
  transportTier?: Ref<string>,
  retryCount?: Ref<number>,
  maxRetries?: Ref<number>,
  attemptNumber?: Ref<number>,
  countdown?: Ref<number>,
  latencyMs?: Ref<number | null>,
): { connectionInfo: Ref<HkConnectionInfo> } {
  const info = computed<HkConnectionInfo>(() => {
    const s = connectionState.value;
    let state: HkConnectionInfo["state"] = "disconnected";
    if (s === "connected") state = "connected";
    else if (s === "connecting" || s === "reconnecting") state = "reconnecting";
    else if (s === "failed") state = "disconnected";

    const tierValue = transportTier?.value ?? (isLocalhostUrl() ? "local" : "ws");
    let quality = "unknown";
    if (s === "connected") {
      quality = tierValue === "local" ? "excellent" : tierValue === "ws" ? "good" : "fair";
    }

    return {
      state,
      tier: tierValue,
      quality,
      latencyMs: latencyMs?.value ?? null,
      isLocalhost: isLocalhostUrl(),
      region: detectRegion(),
      retryCount: retryCount?.value ?? 0,
      maxRetries: maxRetries?.value ?? 3,
      asn: null,
      attemptNumber: attemptNumber?.value ?? 0,
      countdown: countdown?.value ?? 0,
    };
  });

  return { connectionInfo: info };
}
