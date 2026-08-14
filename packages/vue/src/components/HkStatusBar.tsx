import { defineComponent, ref, onMounted, type PropType } from "vue";
import { HPopover, useI18n } from "@celestia-island/hikari";
import { Wifi, WifiOff, Globe, Cable, Cpu } from "lucide-vue-next";
import type { HkConnectionInfo } from "./HkConnectionInfo";
import { PCountdownDigit } from "./HkCountdownDigit";


const regionLabel: Record<string, string> = {
  CN: "\u4e2d\u56fd\u5927\u9646", JP: "\u65e5\u672c", KR: "\u97e9\u56fd",
  US: "\u7f8e\u56fd", GB: "\u82f1\u56fd", DE: "\u5fb7\u56fd",
  FR: "\u6cd5\u56fd", SA: "\u6c99\u7279", TW: "\u4e2d\u56fd\u53f0\u6e7e",
  HK: "\u4e2d\u56fd\u9999\u6e2f", MO: "\u4e2d\u56fd\u6fb3\u95e8",
  BR: "\u5df4\u897f", RU: "\u4fc4\u7f57\u65af",
  CA: "\u52a0\u62ff\u5927", AU: "\u6fb3\u5927\u5229\u4e9a",
  PT: "\u8461\u8404\u7259", ES: "\u897f\u73ed\u7259",
};

function latencyColor(ms: number | null): string {
  if (ms === null) return "var(--color-muted)";
  if (ms < 30) return "rgb(var(--color-success))";
  if (ms < 100) return "rgb(var(--color-warning))";
  return "rgb(var(--color-error))";
}

function qualityIcon(quality: string, tier: string, isLocalhost: boolean, size: number) {
  if (isLocalhost) return <Cable size={size} />;
  if (quality === "excellent" || quality === "good") return <Wifi size={size} />;
  if (quality === "unknown") return <Wifi size={size} style={{ opacity: 0.4 }} />;
  return <WifiOff size={size} />;
}

function fmtVer(v: string, hash?: string): string {
  if (hash) return `${v} ${hash}`;
  return v;
}

export const HkStatusBar = defineComponent({
  name: "HkStatusBar",
  props: {
    version: { type: String, default: "0.1.0" },
    engineVersion: { type: String as PropType<string | null>, default: null },
    panelBuildHash: { type: String as PropType<string | undefined>, default: undefined },
    engineBuildHash: { type: String as PropType<string | undefined>, default: undefined },
    connectionStatus: {
      type: String as PropType<"connected" | "reconnecting" | "disconnected" | "connecting">,
      default: "disconnected",
    },
    connectionInfo: {
      type: Object as PropType<HkConnectionInfo | null>,
      default: null,
    },
    standalone: { type: Boolean, default: true },
    onRetry: { type: Function as PropType<() => void>, default: undefined },
    latencyMs: { type: Number, default: null },
    transportTier: { type: String as PropType<string>, default: undefined },
    attemptNumber: { type: Number, default: undefined },
    countdown: { type: Number, default: undefined },
  },
  setup(props) {
    const popupOpen = ref(false);
    const anchorRef = ref<HTMLElement | null>(null);
    let closeTimer: ReturnType<typeof setTimeout> | null = null;

    const dotColorMap: Record<string, string> = {
      connected: "rgb(var(--color-success))",
      connecting: "rgb(var(--color-warning))",
      reconnecting: "rgb(var(--color-warning))",
      disconnected: "rgb(var(--color-error))",
    };

    function onTagEnter() {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      popupOpen.value = true;
    }
    function onTagLeave() {
      closeTimer = setTimeout(() => { popupOpen.value = false; }, 250);
    }
    function onPopupEnter() {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    }
    function onPopupLeave() {
      popupOpen.value = false;
    }
    function onTagClick() {
      if (props.connectionStatus !== "connected") {
        props.onRetry?.();
      }
    }

    return () => {
      const { t } = useI18n();
      const info = props.connectionInfo;
      const latency = props.latencyMs ?? info?.latencyMs ?? null;
      const mode = props.connectionStatus;
      const tier = props.transportTier ?? info?.tier ?? "ws";
      const attempt = props.attemptNumber ?? info?.attemptNumber ?? 0;
      const countdown = props.countdown ?? info?.countdown ?? 0;

      const tierLabelKey = `hikari::statusBar.tier.${tier}`;
      const statusText = mode === "connected" ? t("hikari::statusBar.connected", "Connected")
        : mode === "reconnecting" || mode === "connecting" ? t("hikari::statusBar.connecting", "Connecting...")
        : t("hikari::statusBar.disconnected", "Disconnected");

      const connecting = mode === "reconnecting" || mode === "connecting";

      const pv = fmtVer(props.version, props.panelBuildHash);
      const ev = props.engineVersion;
      // Two nowrap version parts inside a flex-wrap container: on wide
      // screens they sit side by side ("pv | Engine ev"), and when the
      // width runs out the engine part wraps to its own line instead of
      // breaking mid-token (mobile footer vertical-fragmentation fix).
      const enginePart = ev
        ? `${t("hikari::statusBar.engine", "Engine")} ${fmtVer(ev, props.engineBuildHash)}`
        : null;

      const tagClass = connecting
        ? "s-status-bar-tag s-status-bar-tag-reconnecting"
        : "s-status-bar-tag";

      const inner = (
        <>
          <span
            ref={anchorRef}
            class={tagClass}
            role="button"
            tabindex={0}
            onMouseenter={onTagEnter}
            onMouseleave={onTagLeave}
            onClick={onTagClick}
            onKeydown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTagClick(); }
            }}
            style={{
              position: "relative", zIndex: 51,
            }}
          >
            <span class="s-status-bar-dot" style={{
              background: dotColorMap[mode] ?? dotColorMap.disconnected,
            }} />
            <span class="s-status-bar-tag-label">{t("hikari::statusBar.panel", "Panel")}</span>
            <span class="s-status-bar-tag-value">
              <span class="s-status-bar-version">{pv}</span>
              {enginePart && (
                <span class="s-status-bar-version">
                  <span class="s-status-bar-version-sep" aria-hidden="true">| </span>
                  {enginePart}
                </span>
              )}
            </span>
          </span>

          <HPopover
            modelValue={popupOpen.value}
            onUpdate:modelValue={(v: boolean) => { popupOpen.value = v; }}
            placement="top-start"
            backdrop={false}
            closeOnBackdrop={false}
            anchorRef={anchorRef.value}
          >
            <div
              onMouseenter={onPopupEnter}
              onMouseleave={onPopupLeave}
              style={{
                minWidth: "220px", padding: "10px 14px",
                fontSize: "0.75rem", lineHeight: 1.6,
                color: "rgb(var(--color-text))",
              }}
            >
              {info ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", fontWeight: 600, fontSize: "0.8125rem" }}>
                    {qualityIcon(info.quality || (mode === "connected" ? "good" : "unknown"), tier, info.isLocalhost, 14)}
                    <span style={{ color: dotColorMap[mode] ?? dotColorMap.disconnected }}>
                      {statusText}
                    </span>
                    {latency !== null && (
                      <span style={{ marginLeft: "auto", color: latencyColor(latency), fontFamily: "var(--font-mono, monospace)", fontWeight: 600, fontSize: "0.6875rem" }}>
                        {latency} ms
                      </span>
                    )}
                  </div>
                  {connecting && attempt > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "rgb(var(--color-warning))", fontSize: "0.6875rem", marginBottom: "4px" }}>
                      <span>
                        {t("hikari::statusBar.retrying", "Retrying {retryCount} / {maxRetries}")
                          .replace("{retryCount}", String(attempt))
                          .replace("{maxRetries}", String(info.maxRetries > 0 ? info.maxRetries : 3))}
                      </span>
                      {countdown > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-mono, monospace)", marginLeft: "8px" }}>
                          <PCountdownDigit value={countdown} />
                        </span>
                      )}
                    </div>
                  )}
                  {mode === "disconnected" && (
                    <div style={{ fontStyle: "italic", fontSize: "0.6875rem", marginBottom: "4px", opacity: 0.7 }}>
                      {t("hikari::statusBar.clickReconnect", "Click to retry")}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Cpu size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                    <span style={{ opacity: 0.5, marginRight: "auto" }}>{t("hikari::statusBar.protocol", "Protocol")}</span>
                    {connecting ? (
                      <span style={{ color: "rgb(var(--color-warning))" }}>
                        {t("hikari::statusBar.probing", "Probing...")}
                      </span>
                    ) : (
                      <span>{t(tierLabelKey, tier)}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Globe size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                    <span style={{ opacity: 0.5, marginRight: "auto" }}>{t("hikari::statusBar.network", "Network")}</span>
                    <span>{regionLabel[info.region] ?? info.region}{info.asn != null ? ` · AS${info.asn}` : ""}{info.isLocalhost ? " · " + t("hikari::statusBar.local", "Local") : ""}</span>
                  </div>
                </>
              ) : (
                <div style={{ opacity: 0.5 }}>{t("hikari::statusBar.fetching", "Fetching connection info...")}</div>
              )}
            </div>
          </HPopover>
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
