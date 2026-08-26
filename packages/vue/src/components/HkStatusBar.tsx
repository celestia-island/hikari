import { defineComponent, ref, type PropType } from "vue";
import { Wifi, WifiOff, Globe, Cable, Monitor, Cog, Plug } from "lucide-vue-next";

import { useI18n } from "../i18n/context";

import HPopover from "./HkPopover";
import type { HkConnectionInfo } from "./HkConnectionInfo";
import { HkCountdownDigit } from "./HkCountdownDigit";

/**
 * HkStatusBar — connection + version status pill for app footers.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * A traffic-light dot plus a two-column-grid version block (panel row,
 * engine row). Hovering/tapping the pill opens an HPopover with the
 * quality icon, latency, retry countdown and protocol/network rows.
 * With `compact` the pill collapses to the BARE DOT only (mobile
 * logged-in footers) — no inline status text next to the light; that
 * label is a standing user directive (asked to be removed repeatedly,
 * re-introduced once by an upstreaming wave and reported again on
 * 2026-08-25). The state stays reachable via the tap popover and the
 * compact-mode aria-label; the version rows likewise move into the
 * popover.
 *
 * Styling rides the shared `s-status-bar*` classes from
 * `styles/admin-tokens.scss` (the `[data-compact]` rules hide the inline
 * version block); everything else is inline.
 */
/** Locale-aware region name: the political-name i18n keys first (they
 * carry the deliberate political naming per language, e.g. zh-Hans
 * 中国台湾 for TW), Intl.DisplayNames as the generic fallback, raw code
 * last. Replaces a hardcoded Chinese-only map that showed 中国大陆 to
 * English/French/... users regardless of their locale. (Upstreamed from
 * shittim-chest's plana-legacy layer.) */
function regionDisplayName(
  region: string,
  locale: string,
  t: (key: string, fallback?: string) => string,
): string {
  if (!region) return region;
  const keyed = t(`hikari::statusBar.region.${region}`, "");
  if (keyed) return keyed;
  try {
    const name = new Intl.DisplayNames([locale], { type: "region" }).of(region);
    if (name && name !== region) return name;
  } catch {
    // Intl.DisplayNames unsupported, or invalid locale/region code.
  }
  return region;
}

function latencyColor(ms: number | null): string {
  if (ms === null) return "var(--color-muted)";
  if (ms < 30) return "rgb(var(--color-success))";
  if (ms < 100) return "rgb(var(--color-warning))";
  return "rgb(var(--color-error))";
}

function qualityIcon(quality: string, tier: string, isLocalhost: boolean, size: number) {
  if (isLocalhost) return <Cable size={size} />;
  if (quality === "excellent" || quality === "good" || quality === "fair") return <Wifi size={size} />;
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
    /** Collapse the tag to the bare traffic-light dot (mobile logged-in
     *  footers where the centered tab strip needs the width). NO inline
     *  status text renders next to the dot (standing user directive);
     *  the connection state rides the aria-label, and the version rows
     *  move into the hover/tap popover. */
    compact: { type: Boolean, default: false },
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
    // Tap-vs-gesture discrimination for the touch activation path below.
    let touchStartedAt = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    // Whether the CURRENTLY open popover was opened by a touch tap
    // (instead of a mouse hover). Touch has no hover model, so such a
    // popover must close on an outside tap rather than on mouseleave —
    // otherwise it would hang open forever on phones.
    const touchOpenedPopover = ref(false);

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
    function closePopover() {
      popupOpen.value = false;
      // Clear the touch-origin marker on EVERY close path so hybrid
      // devices never carry it into a later hover-open popover.
      touchOpenedPopover.value = false;
    }
    function onTagLeave() {
      closeTimer = setTimeout(() => { closePopover(); }, 250);
    }
    function onPopupEnter() {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    }
    function onPopupLeave() {
      closePopover();
    }
    // Belt-and-braces echo guard: preventDefault stops the synthesized
    // mouse chain on every mainstream engine, but should one slip
    // through anyway, a synthetic click must never double-fire the
    // retry behind a touch tap. Real user clicks always arrive later
    // than this short window.
    let touchEchoGuardUntil = 0;
    function onTagClick() {
      if (Date.now() < touchEchoGuardUntil) return;
      if (props.connectionStatus !== "connected") {
        props.onRetry?.();
      }
    }

    // ── Touch activation ────────────────────────────────────────────
    // Mobile tap-to-retry used to ride the SYNTHESIZED mouse chain
    // (touchend → mouseenter → click → mouseleave), which browsers may
    // reorder or drop around mid-gesture DOM mutations — the popover
    // flashing open could swallow the very click that should have
    // re-triggered the reconnect. The pointer path now OWNS taps:
    // preventDefault stops the synthesis entirely, so one touchend
    // performs the action deterministically. Mouse hover and keyboard
    // behavior are untouched.
    function onTouchStart(e: TouchEvent) {
      const t0 = e.touches[0];
      if (!t0) return;
      touchStartedAt = Date.now();
      touchStartX = t0.clientX;
      touchStartY = t0.clientY;
    }

    // A canceled gesture (palm, system gesture edge, incoming call)
    // invalidates the pending tap bookkeeping.
    function onTouchCancel() {
      touchStartedAt = 0;
    }

    function onTouchEnd(e: TouchEvent) {
      // Only single-finger taps count; continuation touches of
      // multi-finger gestures fall through untouched.
      if (e.touches.length > 0) return;
      const t0 = e.changedTouches[0];
      if (!t0 || touchStartedAt === 0) return;
      // A scroll/flick that happens to end over the element is not a
      // tap: require near-zero travel and a short press.
      const moved = Math.hypot(t0.clientX - touchStartX, t0.clientY - touchStartY);
      const heldMs = Date.now() - touchStartedAt;
      touchStartedAt = 0;
      if (moved > 12 || heldMs > 900) return;
      if (e.cancelable) e.preventDefault();

      if (popupOpen.value && touchOpenedPopover.value) {
        // Tapping again toggles the details popover closed. The echo
        // guard re-arms here too: a late synthetic click after this
        // close must not fire an unguarded retry.
        closePopover();
        touchEchoGuardUntil = Date.now() + 400;
        return;
      }
      touchOpenedPopover.value = true;
      popupOpen.value = true;
      // The whole point: a red light answers a tap with an immediate
      // reconnect attempt plus visible feedback — the popover shows the
      // probing/retrying rows instead of leaving a seemingly dead dot.
      // The echo guard arms only AFTER the real activation so it blocks
      // late synthetic clicks, never the tap itself.
      onTagClick();
      touchEchoGuardUntil = Date.now() + 400;
    }

    return () => {
      const { t, locale } = useI18n();
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
      // Version block: panel version on the first row, engine version on
      // the second. The value container is a two-column grid (label column
      // + value column), so both rows share one true left edge — no
      // separator, no mid-token wrapping, at any footer width.

      const tagClass = connecting
        ? "s-status-bar-tag s-status-bar-tag-reconnecting"
        : "s-status-bar-tag";

      const inner = (
        <>
          <span
            ref={anchorRef}
            class={tagClass}
            data-compact={props.compact || undefined}
            role="button"
            tabindex={0}
            aria-label={props.compact
              ? `${statusText} · ${pv}${ev ? ` · ${fmtVer(ev, props.engineBuildHash)}` : ""}`
              : undefined}
            onMouseenter={onTagEnter}
            onMouseleave={onTagLeave}
            onClick={onTagClick}
            onTouchstart={onTouchStart}
            onTouchend={onTouchEnd}
            onTouchcancel={onTouchCancel}
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
            <span class="s-status-bar-tag-value">
              <span class="s-status-bar-tag-label">{t("hikari::statusBar.panel", "Panel")}</span>
              <span class="s-status-bar-version">{pv}</span>
              {ev && (
                <>
                  <span class="s-status-bar-tag-label">{t("hikari::statusBar.engine", "Engine")}</span>
                  <span class="s-status-bar-version">{fmtVer(ev, props.engineBuildHash)}</span>
                </>
              )}
            </span>
          </span>

          <HPopover
            modelValue={popupOpen.value}
            onUpdate:modelValue={(v: boolean) => { popupOpen.value = v; }}
            placement="top-start"
            backdrop={false}
            // Touch has no hover model: a tap-opened popover would only
            // close via the mouseleave timer that never fires, so it
            // dismisses on an outside tap instead. Hover-opened
            // (desktop) popovers keep the leave-timer semantics.
            closeOnBackdrop={touchOpenedPopover.value}
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
                          <HkCountdownDigit value={countdown} />
                        </span>
                      )}
                    </div>
                  )}
                  {mode === "disconnected" && (
                    <div style={{ fontStyle: "italic", fontSize: "0.6875rem", marginBottom: "4px", opacity: 0.7 }}>
                      {t("hikari::statusBar.clickReconnect", "Click to retry")}
                    </div>
                  )}
                  {props.compact && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Monitor size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                        <span style={{ opacity: 0.5, marginRight: "auto" }}>{t("hikari::statusBar.panel", "Panel")}</span>
                        <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{pv}</span>
                      </div>
                      {ev && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Cog size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                          <span style={{ opacity: 0.5, marginRight: "auto" }}>{t("hikari::statusBar.engine", "Engine")}</span>
                          <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{fmtVer(ev, props.engineBuildHash)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Plug size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
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
                    <span>{regionDisplayName(info.region, locale, t)}{info.asn != null ? ` · AS${info.asn}` : ""}{info.isLocalhost ? " · " + t("hikari::statusBar.local", "Local") : ""}</span>
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
