import { computed, defineComponent, onMounted, type PropType } from "vue";
import { useI18n } from "@celestia-island/hikari";
import { HkStatusBar } from "./HkStatusBar";
import {
  useConnectionInfo,
  type ConnectionStateInput,
  type HkConnectionInfo,
} from "./HkConnectionInfo";
import { useConnectionProbe } from "../composables/useConnectionProbe";
import { useEngineHealth } from "../composables/useEngineHealth";


/** Secondary "engine/backend health" traffic-light segment. */
export interface HBackendStatus {
  label: string;
  state: "ok" | "warn" | "error" | "unknown";
}

const backendStateColor: Record<HBackendStatus["state"], string> = {
  ok: "rgb(var(--color-success))",
  warn: "rgb(var(--color-warning))",
  error: "rgb(var(--color-error))",
  unknown: "var(--color-muted)",
};

/**
 * Batteries-included connection status footer: composes useConnectionProbe +
 * useEngineHealth + useConnectionInfo + HkStatusBar. Slots:
 * - `left`  — extras after the status tags (e.g. a mock badge)
 * - `right` — extras on the far right (e.g. an engine version tag)
 */
export const HkConnectionStatus = defineComponent({
  name: "HkConnectionStatus",
  props: {
    version: { type: String, default: "0.1.0" },
    panelBuildHash: { type: String as PropType<string | undefined>, default: undefined },
    /** API origin for the /api/health probe (defaults to same-origin ""). */
    baseUrl: { type: String as PropType<string | undefined>, default: undefined },
    backendStatus: { type: Object as PropType<HBackendStatus | undefined>, default: undefined },
    standalone: { type: Boolean, default: true },
  },
  setup(props, { slots }) {

    const { result: probe, retryNow } = useConnectionProbe();
    const { health } = useEngineHealth(props.baseUrl);

    const connectionState = computed<ConnectionStateInput>(() => probe.value.state);
    const transportTier = computed(() => probe.value.transportTier);
    const attemptNumber = computed(() => probe.value.attemptNumber);
    const retryTotal = computed(() => probe.value.retryTotal);
    const countdown = computed(() => probe.value.countdown);
    const latencyMs = computed(() => probe.value.latencyMs);

    const { connectionInfo } = useConnectionInfo(
      connectionState,
      transportTier,
      attemptNumber,
      retryTotal,
      attemptNumber,
      countdown,
      latencyMs,
    );

    // Overlay the server-reported network context (region/asn) when available;
    // "XX" is the backend's unknown-region sentinel, keep the local guess then.
    const mergedInfo = computed<HkConnectionInfo>(() => {
      const base = connectionInfo.value;
      const net = health.value?.network;
      if (!net) return base;
      return {
        ...base,
        region: net.region && net.region !== "XX" ? net.region : base.region,
        asn: net.asn ?? base.asn,
      };
    });

    const connectionStatus = computed<"connected" | "reconnecting" | "disconnected">(() => {
      const s = probe.value.state;
      if (s === "connected") return "connected";
      if (s === "connecting" || s === "reconnecting") return "reconnecting";
      return "disconnected";
    });

    return () => {
      const { t } = useI18n();
      const bs = props.backendStatus;
      const inner = (
        <>
          <div class="s-status-bar-left">
            <HkStatusBar
              standalone={false}
              version={props.version}
              panelBuildHash={props.panelBuildHash}
              engineVersion={health.value?.engineVersion ?? null}
              engineBuildHash={health.value?.engineBuildHash ?? undefined}
              connectionStatus={connectionStatus.value}
              connectionInfo={mergedInfo.value}
              onRetry={retryNow}
              transportTier={probe.value.transportTier}
              attemptNumber={probe.value.attemptNumber}
              countdown={probe.value.countdown}
            />
            {bs && (
              <span class="s-status-bar-tag" style={{ cursor: "default" }}>
                <span
                  class="s-status-bar-dot"
                  style={{ background: backendStateColor[bs.state] ?? backendStateColor.unknown }}
                />
                <span class="s-status-bar-tag-label">{bs.label}</span>
                <span class="s-status-bar-tag-value">
                  {t(`hikari::statusBar.backend.${bs.state}`, bs.state)}
                </span>
              </span>
            )}
            {slots.left?.()}
          </div>
          <div class="s-status-bar-center" />
          <div class="s-status-bar-right">
            {slots.right?.()}
          </div>
        </>
      );

      if (!props.standalone) return inner;

      return (
        <footer class="s-status-bar">
          {inner}
        </footer>
      );
    };
  },
});
