import { computed, defineComponent, inject, type InjectionKey, type PropType, type Ref } from "vue";

import { useI18n } from "../i18n/context";
import { useConnectionProbe, type ProbeResult } from "../composables/useConnectionProbe";
import { useEngineHealth } from "../composables/useEngineHealth";

import { HkStatusBar } from "./HkStatusBar";
import {
  useConnectionInfo,
  type ConnectionStateInput,
  type HkConnectionInfo,
} from "./HkConnectionInfo";

/** Secondary "engine/backend health" traffic-light segment. */
export interface HkBackendStatus {
  label: string;
  state: "ok" | "warn" | "error" | "unknown";
}

/**
 * Probe source a host app may `provide(HK_CONNECTION_PROBE, …)` to swap
 * hikari's fetch-poll probe for its own transport-aware one (e.g. chest's
 * RpcClient-driven probe). Shape matches `useConnectionProbe()`'s return.
 */
export interface HkConnectionProbeSource {
  result: Ref<ProbeResult>;
  retryNow: () => void;
}

/** Injection key for the connection-probe overload (see above). */
export const HK_CONNECTION_PROBE: InjectionKey<HkConnectionProbeSource> =
  Symbol("HkConnectionProbe");

const backendStateColor: Record<HkBackendStatus["state"], string> = {
  ok: "rgb(var(--color-success))",
  warn: "rgb(var(--color-warning))",
  error: "rgb(var(--color-error))",
  unknown: "var(--color-muted)",
};

/**
 * HkConnectionStatus — batteries-included connection status footer.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Composes useConnectionProbe + useEngineHealth + useConnectionInfo +
 * HkStatusBar. The probe source is injectable: when a parent provides
 * HK_CONNECTION_PROBE, that probe (and its retryNow) is used verbatim;
 * otherwise hikari's own fetch-poll useConnectionProbe() runs. Slots:
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
    backendStatus: { type: Object as PropType<HkBackendStatus | undefined>, default: undefined },
    standalone: { type: Boolean, default: true },
    /** Forwarded to HkStatusBar — collapse to the traffic-light dot. */
    compact: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    // Probe-source overload: a host app (chest) provides its own
    // RpcClient-driven probe; everyone else gets hikari's fetch-poll.
    const injectedProbe = inject(HK_CONNECTION_PROBE, null);
    const { result: probe, retryNow } = injectedProbe ?? useConnectionProbe();
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
              compact={props.compact}
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
