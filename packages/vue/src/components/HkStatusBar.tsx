import { defineComponent, onBeforeUnmount, ref, watch, type PropType } from "vue";
import { Wifi, WifiOff, Globe, Cable, Monitor, Cog, Plug } from "lucide-vue-next";

import { useI18n } from "../i18n/context";
import { HIKARI_FONT_MONO } from "../theme/fontContext";

import HPopover from "./HkPopover";
import type { HkConnectionInfo } from "./HkConnectionInfo";
import { HkCountdownDigit } from "./HkCountdownDigit";
import { HkPlaceholderMarquee } from "./HkPlaceholderMarquee";

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
 *
 * The two version values (panel row, engine row) are merged ONCE from
 * the raw facts via hkMergeVersionDisplay — the single set-based,
 * duplicate-free-by-construction rule for the whole family — and each
 * renders in an HkVersionValue cell: static text that hands its paint
 * over to the shared HkPlaceholderMarquee scrolling window when a long
 * branch identity outgrows the cell (2026-10-11 user direction).
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

/**
 * One git identity atom: a commit, optionally labeled by its branch.
 * `feat/x:770f625`, the legacy `feat/x::770f625`, and a bare `770f625`
 * all carry the SAME commit — the commit IS the identity (2026-10-08
 * family direction); branch labels are names for it.
 */
export interface HkVersionIdentity {
  branch?: string;
  commit: string;
}

/** `<branch>:<hash7..40>` / legacy `<branch>::<hash>` / bare `<hash>`.
 * Both separators count: the family narrowed `::` → `:` on 2026-10-11
 * and transition-window binaries still speak either shape. Non-git
 * tokens (retired Crockford chunk stamps like `EDW62Q`) carry no commit
 * and return undefined — they can never be "already shown". */
const STAMP_RE = /^(\S+?):+([0-9a-f]{7,40})$/i;
const BARE_COMMIT_RE = /^[0-9a-f]{7,40}$/i;

export function hkParseIdentity(token: string | undefined): HkVersionIdentity | undefined {
  if (!token) return undefined;
  const labeled = token.match(STAMP_RE);
  if (labeled) return { branch: labeled[1], commit: labeled[2].toLowerCase() };
  if (BARE_COMMIT_RE.test(token)) return { commit: token.toLowerCase() };
  return undefined;
}

/**
 * Canonical display merge for a `<version line> + <build stamp>` pair —
 * the ONE rule every identity surface consumes (status bar rows, the
 * hosts' About dialogs; import this instead of re-deriving it). The two
 * inputs are independent facts (the served version line and the
 * client/stamp), so a plain concatenation can print the same commit
 * twice.
 *
 * The merge is SET-BASED and therefore duplicate-free BY CONSTRUCTION:
 * every whitespace token of the version line, then the stamp, is keyed —
 * git tokens by their commit (case-folded, separator-agnostic), non-git
 * tokens by their raw text — and a key already in the set is dropped.
 * No pair of inputs, in either separator generation, can render one
 * identity twice. A stamp whose commit the version line already names
 * adds nothing (the 2026-10-11 seam: single-colon line against legacy
 * `::` stamp and vice versa); a DIFFERENT commit always stays visible,
 * because that drift IS the stale-embed signal.
 */
export function hkMergeVersionDisplay(version: string, hash?: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  const keyOf = (token: string): string => {
    const id = hkParseIdentity(token);
    return id ? `c:${id.commit}` : `t:${token.toLowerCase()}`;
  };
  for (const token of version.trim().split(/\s+/)) {
    if (!token) continue;
    const key = keyOf(token);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  const stamp = hash?.trim();
  if (stamp) {
    const key = keyOf(stamp);
    if (!seen.has(key)) out.push(stamp);
  }
  return out.join(" ");
}

/**
 * One version value cell: the static text plus the shared
 * HkPlaceholderMarquee layered over it (the upstream overflow strategy,
 * consumed as-is — nothing is re-invented here). While the text fits,
 * the static layer shows and the marquee stays a hidden measuring
 * probe; once it overflows the window (long branch names), the static
 * layer turns into a transparent layout ghost (opacity, so the text
 * stays in the a11y tree; `title` keeps the hover copy) and the marquee
 * scrolls the text like a storefront sign. Pure-CSS compositor motion;
 * reduced-motion users get a parked first copy (the component's own
 * media handling).
 */
const HkVersionValue = defineComponent({
  name: "HkVersionValue",
  props: { text: { type: String, required: true } },
  setup(props) {
    const overflowing = ref(false);
    return () => (
      <span
        class="s-status-bar-version"
        data-overflowing={overflowing.value || undefined}
        title={props.text}
      >
        <span class="s-status-bar-version__static">{props.text}</span>
        <HkPlaceholderMarquee
          text={props.text}
          onOverflowChange={(v: boolean) => { overflowing.value = v; }}
        />
      </span>
    );
  },
});

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
    /**
     * Optional extra rows appended to the connection-info popover (after
     * the network row): host-supplied label/value pairs with a prebuilt
     * icon vnode each — the same loose-icon contract as HkAuthMethodList.
     * Rows grow with their content but cap at 400px; values past the cap
     * ellipsize (full text rides the native title). Lets a host surface
     * stage endpoints (gateway, registry…) inside the popover without
     * forking the component.
     */
    extraDetails: {
      type: Array as PropType<
        Array<{ key: string; icon?: unknown; label: string; value: string }>
      >,
      default: undefined,
    },
  },
  setup(props, { slots }) {
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

    // ── Recovery flash ─────────────────────────────────────────────
    // One soft green background blink when the light RETURNS to green
    // after a drop (reconnecting/connecting/disconnected → connected).
    // The FIRST connect of the component's life stays quiet: the flash
    // acknowledges a connection the user saw go down, it is not an
    // open-time announcement (hosts used to fire a toast for exactly
    // this moment; the light now owns that feedback, quietly).
    // `seenConnected` seeds from the initial prop so a component that
    // mounts while already connected still counts as established and a
    // LATER drop/recover pair flashes.
    const RECOVER_FLASH_MS = 1200;
    const seenConnected = ref(props.connectionStatus === "connected");
    const recovering = ref(false);
    let recoverTimer: ReturnType<typeof setTimeout> | null = null;

    watch(() => props.connectionStatus, (next) => {
      if (next !== "connected") return;
      const wasEstablished = seenConnected.value;
      seenConnected.value = true;
      if (!wasEstablished) return;
      if (recoverTimer) clearTimeout(recoverTimer);
      recovering.value = true;
      recoverTimer = setTimeout(() => {
        recovering.value = false;
        recoverTimer = null;
      }, RECOVER_FLASH_MS);
    });

    onBeforeUnmount(() => {
      if (recoverTimer) clearTimeout(recoverTimer);
    });

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

    // Popover retry button: the echo guard applies here too — a late
    // synthetic click following the touch activation that opened the
    // popover must not double-fire the retry through the button.
    function onRetryButtonClick() {
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
      // Recovery actions (2026-10-11 user direction): the old bottom
      // hairline row stacked a built-in "Reconnect now" button beside the
      // host's own refresh icon — on an outage the popover read as TWO
      // buttons doing one job. The built-in labelled button is RETIRED:
      // the traffic light itself already retries on click/tap, and hosts
      // append their single recovery action (e.g. a manual page refresh)
      // through the `actions` slot. The cluster now rides the FIRST
      // popover row's right side — status text left, actions right — so
      // no extra row of vertical space is spent on it.
      // Gate the cluster on RENDERED content, not on the slot function's
      // existence: HkConnectionStatus forwards `actions` unconditionally,
      // so a function-existence gate would paint an empty cluster in the
      // connected state for every host that passed no #actions.
      const actionVnodes = slots.actions?.();
      const hasHostActions = Array.isArray(actionVnodes)
        ? actionVnodes.length > 0
        : Boolean(actionVnodes);
      const hasActionsRow = hasHostActions;

      const pv = hkMergeVersionDisplay(props.version, props.panelBuildHash);
      const ev = props.engineVersion;
      // Version block: panel version on the first row, engine version on
      // the second. The value container is a two-column grid (label column
      // + value column), so both rows share one true left edge — no
      // separator, no mid-token wrapping, at any footer width. Each value
      // cell is an HkVersionValue: merged ONCE above (set semantics — see
      // hkMergeVersionDisplay), rendered once, marquee-scrolled only when
      // the identity outgrows the window.

      const tagClass = [
        "s-status-bar-tag",
        connecting ? "s-status-bar-tag-reconnecting" : "",
        recovering.value ? "s-status-bar-tag-recovered" : "",
      ].filter(Boolean).join(" ");

      const inner = (
        <>
          <span
            ref={anchorRef}
            class={tagClass}
            data-compact={props.compact || undefined}
            role="button"
            tabindex={0}
            aria-label={props.compact
              ? `${statusText} · ${pv}${ev ? ` · ${hkMergeVersionDisplay(ev, props.engineBuildHash)}` : ""}`
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
              <HkVersionValue text={pv} />
              {ev && (
                <>
                  <span class="s-status-bar-tag-label">{t("hikari::statusBar.engine", "Engine")}</span>
                  <HkVersionValue text={hkMergeVersionDisplay(ev, props.engineBuildHash)} />
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
            title={t("hikari::statusBar.panel")}
          >
            <div
              data-status-bar-card
              onMouseenter={onPopupEnter}
              onMouseleave={onPopupLeave}
              style={{
                // 300px default floor (2026-10-11 user direction: the
                // version/protocol rows read cramped at the old 220px),
                // clamped to the popover's own viewport budget so a
                // 320px-class phone never spills past the glass.
                minWidth: "min(300px, calc(100vw - 2 * var(--viewport-gutter, 16px)))",
                padding: "10px 14px",
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
                      <span style={{ marginLeft: "auto", color: latencyColor(latency), fontFamily: `var(--font-mono, ${HIKARI_FONT_MONO})`, fontWeight: 600, fontSize: "0.6875rem" }}>
                        {latency} ms
                      </span>
                    )}
                    {hasActionsRow && (
                      <span
                        data-status-actions
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          // No latency chip to push against: the cluster
                          // still lands on the row's right edge.
                          marginLeft: latency !== null ? undefined : "auto",
                        }}
                      >
                        {actionVnodes}
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
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: `var(--font-mono, ${HIKARI_FONT_MONO})`, marginLeft: "8px" }}>
                          <HkCountdownDigit value={countdown} />
                        </span>
                      )}
                    </div>
                  )}
                  {mode === "disconnected" && !hasActionsRow && (
                    // Fallback for hosts without a slot action — and a REAL
                    // control this time: the original hint was retired
                    // because its clicks went nowhere (the popover body
                    // teleports to <body>), so the text now carries the
                    // retry itself, echo guard included.
                    <div
                      role="button"
                      tabindex={0}
                      onClick={onRetryButtonClick}
                      onKeydown={(e: KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRetryButtonClick(); }
                      }}
                      style={{ fontStyle: "italic", fontSize: "0.6875rem", marginBottom: "4px", opacity: 0.7, cursor: "pointer" }}
                    >
                      {t("hikari::statusBar.clickReconnect", "Click to retry")}
                    </div>
                  )}
                  {props.compact && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Monitor size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                        <span style={{ opacity: 0.5, marginRight: "auto" }}>{t("hikari::statusBar.panel", "Panel")}</span>
                        <span
                          class="s-status-bar-popover-value"
                          style={{ fontFamily: `var(--font-mono, ${HIKARI_FONT_MONO})` }}
                        >
                          <HkVersionValue text={pv} />
                        </span>
                      </div>
                      {ev && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Cog size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                          <span style={{ opacity: 0.5, marginRight: "auto" }}>{t("hikari::statusBar.engine", "Engine")}</span>
                          <span
                            class="s-status-bar-popover-value"
                            style={{ fontFamily: `var(--font-mono, ${HIKARI_FONT_MONO})` }}
                          >
                            <HkVersionValue text={hkMergeVersionDisplay(ev, props.engineBuildHash)} />
                          </span>
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
                  {(props.extraDetails ?? []).map((row) => (
                    <div key={row.key} data-extra-detail={row.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", maxWidth: "400px" }}>
                      <span style={{ opacity: 0.5, flexShrink: 0, display: "inline-flex" }}>{row.icon}</span>
                      <span style={{ opacity: 0.5, flexShrink: 0, minWidth: "72px", marginRight: "auto" }}>{row.label}</span>
                      <span title={row.value} style={{ fontFamily: `var(--font-mono, ${HIKARI_FONT_MONO})`, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <span style={{ opacity: 0.5 }}>{t("hikari::statusBar.fetching", "Fetching connection info...")}</span>
                  {hasActionsRow && (
                    // An outage that drops connectionInfo to null is exactly
                    // when the recovery action is most needed — the cluster
                    // rides the fetching line's right edge.
                    <span data-status-actions style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
                      {actionVnodes}
                    </span>
                  )}
                </div>
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
