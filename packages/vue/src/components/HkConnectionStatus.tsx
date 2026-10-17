import { computed, defineComponent, inject, ref, type InjectionKey, type PropType, type Ref } from "vue";

import { useI18n } from "../i18n/context";
import type { EngineHealth, EngineNetworkInfo, ProbeResult } from "../composables/engineHealthTypes";

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
/** Engine-health source a host provides (the demoted fetch's
 * replacement): a ref of the /api/health envelope, or null. */
export const HK_ENGINE_HEALTH: InjectionKey<Ref<EngineHealth | null>> = Symbol(
  "HK_ENGINE_HEALTH",
);

/** The shell's inert probe — no network, no timers: "unknown". */
const INERT_PROBE: ProbeResult = {
  connected: false,
  state: "disconnected",
  transportTier: "unknown",
  tier: "unknown",
  latencyMs: null,
  attemptNumber: 0,
  retryCount: 0,
  retryTotal: 0,
  countdown: 0,
};

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
 * without an injection the shell renders an inert unknown state and
 * NEVER touches the network (pinned). Slots:
 * - `left`  — extras after the status tags (e.g. a mock badge)
 * - `right` — extras on the far right (e.g. an engine version tag)
 */
export const HkConnectionStatus = defineComponent({
  name: "HkConnectionStatus",
  props: {
    version: { type: String, default: "0.1.0" },
    panelBuildHash: { type: String as PropType<string | undefined>, default: undefined },
    backendStatus: { type: Object as PropType<HkBackendStatus | undefined>, default: undefined },
    standalone: { type: Boolean, default: true },
    /** Forwarded to HkStatusBar — collapse to the traffic-light dot. */
    compact: { type: Boolean, default: false },
    /** Resting override (2026-10-17 user direction): pins the light and
     *  the status line to the neutral-gray idle state — "the shell is
     *  alive, no session yet" — regardless of what the injected probe
     *  reports. Sessionless auth surfaces set it; logged-in surfaces
     *  never do. Everything else (versions, info rows, actions) keeps
     *  the ONE wiring — idle hosts no longer hand-roll an HkStatusBar
     *  copy (that fork is what left the auth popover stuck on its
     *  fetching placeholder). */
    idle: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    // SHELL-ONLY: the network side (WHO polls /api/health and HOW)
    // lives in the host — injected via HK_CONNECTION_PROBE /
    // HK_ENGINE_HEALTH. Without an injection the shell renders an
    // inert unknown state and never touches the network (the
    // fetch-poll defaults were demoted with the chat kit wave).
    const injectedProbe = inject(HK_CONNECTION_PROBE, null);
    const probe = injectedProbe?.result ?? ref(INERT_PROBE);
    const retryNow = injectedProbe?.retryNow ?? (() => {});
    const health = inject(HK_ENGINE_HEALTH, ref<EngineHealth | null>(null));

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

    const connectionStatus = computed<"connected" | "reconnecting" | "disconnected" | "idle">(() => {
      // The idle override wins over the probe: the resting gray light is
      // a definite statement about the SHELL, not a verdict on the link.
      if (props.idle) return "idle";
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
            >
              {/* Host-appended popover actions (e.g. a manual page
                  refresh) ride the status row's right edge — the only
                  recovery button in the popover since the built-in
                  labelled retry retired (2026-10-11). */}
              {{ actions: () => slots.actions?.() }}
            </HkStatusBar>
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
