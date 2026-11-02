// hi-components/src/theme/connection_status.rs
// ConnectionStatus — mirror of the canonical Vue `HkConnectionStatus`
// (the batteries-included connection status footer: the StatusBar pill plus
// an optional backend traffic-light tag and the left/center/right bands).
//
// NO SHEET OF ITS OWN — verified, not assumed. `HkConnectionStatus.tsx`
// imports no stylesheet; every class it writes (`s-status-bar`,
// `-left`, `-center`, `-right`, `-tag`, `-dot`, `-tag-label`, `-tag-value`)
// is a HOST-UTILITY class defined once in the shared `s-*` layout sheet
// `packages/vue/src/styles/admin-tokens.scss` (rules `.s-status-bar*`, the
// same table the StatusBar pill reads). The Rust side mirrors that sheet as
// `styled::vue_admin_tokens_css()` and registers it as shared chrome
// (`vue-admin-tokens`, via `StyleRegistry::register_vue_chrome`), so this
// component's `styles()` returns `""` — the exact verdict the StatusBar
// mirror (`layout/status_bar.rs`) reached for the same reason. A
// registry-only host gets the geometry from the chrome layer, not from here.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   footer.s-status-bar                          (standalone only, default)
//     div.s-status-bar-left
//       {StatusBar}                              (standalone=false always)
//       span.s-status-bar-tag [style=cursor:default]    (backendStatus set)
//         span.s-status-bar-dot (style: background={state color})
//         span.s-status-bar-tag-label  {backend.label}
//         span.s-status-bar-tag-value  {t(backend.{state})}
//       {left slot}
//     div.s-status-bar-center                    (always, always empty)
//     div.s-status-bar-right
//       {right slot}
//
// The shell NEVER touches the network (pinned by the Vue shell test): the
// probe is INJECTED in Vue (`HK_CONNECTION_PROBE` / `HK_ENGINE_HEALTH`) and
// the fallback is the inert `INERT_PROBE` — state `disconnected`,
// transportTier `unknown`, zero counters, null latency, a no-op `retryNow`.
// The mirror flattens the injection into explicit props whose defaults ARE
// `INERT_PROBE` verbatim; `on_retry: None` is the inert no-op retry.
//
// The derivation chain below is TAKEN FROM the Vue sources, as pure
// functions (the wave's state-derivation core):
//   * `HkConnectionInfo.ts` `useConnectionInfo` — the 5→3 state fold, the
//     tier fallback (`?? (isLocalhostUrl() ? "local" : "ws")`), the quality
//     table, the `?? 0 / ?? 3 / ?? null` defaults and the always-null `asn`
//     ([`connection_info`]);
//   * `detectRegion()` / `isLocalhostUrl()` — the locale→region map and the
//     localhost host check ([`connection_detect_region`] /
//     [`connection_is_localhost`]; a wasip2 host has no
//     `navigator.language` / `window.location`, so both take the raw input
//     the Vue side would have read);
//   * `HkConnectionStatus.tsx` `mergedInfo` — the engine-health network
//     overlay (`region` non-empty and not the `XX` sentinel wins; `asn`
//     nullish keeps the base) ([`merge_engine_network`]);
//   * `connectionStatus` — the `idle` override WINS over the probe (the
//     resting gray light is a statement about the SHELL, not the link)
//     ([`connection_status`]);
//   * `backendStateColor` ([`ConnectionBackendState::color`]) and the
//     backend status word ([`ConnectionBackendState::label`]).
//
// Deltas vs Vue (documented, not accidental):
//   * INJECTION → PROPS (see above); no context lookup, no fetch ever.
//   * The Vue call passes `attemptNumber` as the hook's `retryCount` TOO
//     (`ProbeResult.retryCount` is the deprecated alias) — the mirror keeps
//     that wiring verbatim in [`ConnectionStatusProps`] → the info input,
//     quirk and all.
//   * `region`/`asn` arrive as two optional props; either present means the
//     health envelope carried a `network` object (Vue: `if (!net) return
//     base` — a network with neither field merges nothing anyway).
//   * i18n keys read `components.hk.statusBar.backend.{ok,warn,error,
//     unknown}` through `hikari_i18n::t`; the four keys are NEW to the Rust
//     bundle (Vue's own `hikari::statusBar.backend.*` en values are the
//     fallbacks: OK / Degraded / Error / Unknown).
//
// STATELESS (ledger L48): the shell keeps no refs at all — everything is
// derived per render, and the popup/retry interactions belong to the
// mirrored `StatusBar` (whose `idle` mode already refuses to fire a silent
// retry, the shell test's R3 catch).

use hikari_i18n::t;

use crate::layout::status_bar::{StatusBar, StatusBarConnection, StatusBarProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ConnectionStatusComponent;

/// The probe's raw connection states (Vue: `ConnectionStateInput` /
/// `ProbeResult.state`; `disconnected` is the inert shell's state).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ConnectionStateInput {
    Connected,
    #[default]
    Disconnected,
    Connecting,
    Reconnecting,
    Failed,
}

impl ConnectionStateInput {
    /// Vue's raw state token.
    pub fn as_str(self) -> &'static str {
        match self {
            ConnectionStateInput::Connected => "connected",
            ConnectionStateInput::Disconnected => "disconnected",
            ConnectionStateInput::Connecting => "connecting",
            ConnectionStateInput::Reconnecting => "reconnecting",
            ConnectionStateInput::Failed => "failed",
        }
    }
}

/// The three-valued info state (Vue: `HkConnectionInfo["state"]`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ConnectionInfoState {
    Connected,
    Reconnecting,
    #[default]
    Disconnected,
}

impl ConnectionInfoState {
    /// Vue's info state token.
    pub fn as_str(self) -> &'static str {
        match self {
            ConnectionInfoState::Connected => "connected",
            ConnectionInfoState::Reconnecting => "reconnecting",
            ConnectionInfoState::Disconnected => "disconnected",
        }
    }
}

/// The derived connection info (Vue: the `HkConnectionInfo` object).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ConnectionInfo {
    pub state: ConnectionInfoState,
    pub tier: String,
    pub quality: &'static str,
    pub latency_ms: Option<f64>,
    pub is_localhost: bool,
    pub region: String,
    pub retry_count: u32,
    pub max_retries: u32,
    pub asn: Option<u32>,
    pub attempt_number: u32,
    pub countdown: u32,
}

/// The inputs of [`connection_info`] (Vue: the `useConnectionInfo` ref
/// parameters — `None` models an absent ref so the hook's `??` defaults
/// stay reachable).
#[derive(Clone, PartialEq, Debug)]
pub struct ConnectionInfoInput {
    pub state: ConnectionStateInput,
    pub transport_tier: Option<String>,
    pub retry_count: Option<u32>,
    pub max_retries: Option<u32>,
    pub attempt_number: Option<u32>,
    pub countdown: Option<u32>,
    pub latency_ms: Option<f64>,
    pub is_localhost: bool,
    /// The locale `detectRegion()` reads (Vue: `navigator.language`; the
    /// neutral default mirrors the browser's `en`).
    pub locale: String,
}

impl Default for ConnectionInfoInput {
    fn default() -> Self {
        Self {
            state: ConnectionStateInput::Disconnected,
            transport_tier: None,
            retry_count: None,
            max_retries: None,
            attempt_number: None,
            countdown: None,
            latency_ms: None,
            is_localhost: false,
            locale: "en".to_string(),
        }
    }
}

/// The secondary "engine/backend health" traffic light (Vue:
/// `HkBackendStatus`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ConnectionBackendStatus {
    pub label: String,
    pub state: ConnectionBackendState,
}

/// The backend light's four states (Vue: `ok | warn | error | unknown`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ConnectionBackendState {
    Ok,
    #[default]
    Unknown,
    Warn,
    Error,
}

impl ConnectionBackendState {
    /// Vue's raw state token (the i18n key suffix and the fallback text).
    pub fn as_str(self) -> &'static str {
        match self {
            ConnectionBackendState::Ok => "ok",
            ConnectionBackendState::Warn => "warn",
            ConnectionBackendState::Error => "error",
            ConnectionBackendState::Unknown => "unknown",
        }
    }

    /// The localized status word (Vue: `t("hikari::statusBar.backend.
    /// ${state}", state)`; the Rust key family is
    /// `components.hk.statusBar.backend.*`, new in this wave — the English
    /// fallbacks are Vue's own en-locale values).
    pub fn label(self) -> String {
        let (suffix, fallback) = match self {
            ConnectionBackendState::Ok => ("ok", "OK"),
            ConnectionBackendState::Warn => ("warn", "Degraded"),
            ConnectionBackendState::Error => ("error", "Error"),
            ConnectionBackendState::Unknown => ("unknown", "Unknown"),
        };
        t(
            &format!("components.hk.statusBar.backend.{suffix}"),
            fallback,
        )
    }

    /// Vue's `backendStateColor` table.
    pub fn color(self) -> &'static str {
        match self {
            ConnectionBackendState::Ok => "rgb(var(--color-success))",
            ConnectionBackendState::Warn => "rgb(var(--color-warning))",
            ConnectionBackendState::Error => "rgb(var(--color-error))",
            ConnectionBackendState::Unknown => "var(--color-muted)",
        }
    }
}

/// Vue's state fold: connected → connected; connecting/reconnecting →
/// reconnecting; disconnected/failed → disconnected.
pub fn connection_info_state(state: ConnectionStateInput) -> ConnectionInfoState {
    match state {
        ConnectionStateInput::Connected => ConnectionInfoState::Connected,
        ConnectionStateInput::Connecting | ConnectionStateInput::Reconnecting => {
            ConnectionInfoState::Reconnecting
        }
        ConnectionStateInput::Disconnected | ConnectionStateInput::Failed => {
            ConnectionInfoState::Disconnected
        }
    }
}

/// Vue's tier fallback: the probe's tier, else `local` on a localhost
/// origin, else `ws`.
pub fn connection_tier(transport_tier: Option<&str>, is_localhost: bool) -> String {
    match transport_tier {
        Some(tier) => tier.to_string(),
        None if is_localhost => "local".to_string(),
        None => "ws".to_string(),
    }
}

/// Vue's quality table: only a connected link has a quality — `local` →
/// excellent, `ws` → good, anything else → fair; every other state is
/// `unknown`.
pub fn connection_quality(state: ConnectionStateInput, tier: &str) -> &'static str {
    if state != ConnectionStateInput::Connected {
        return "unknown";
    }
    match tier {
        "local" => "excellent",
        "ws" => "good",
        _ => "fair",
    }
}

/// Vue's `isLocalhostUrl()` hostname check (no `window` on wasip2 — the
/// host hands the hostname in).
pub fn connection_is_localhost(hostname: &str) -> bool {
    matches!(hostname, "localhost" | "127.0.0.1" | "[::1]")
}

/// Vue's `detectRegion()` verbatim: the locale→region map first, then the
/// subtag after the first `-` upper-cased, then the whole locale
/// upper-cased. A locale with an EMPTY second segment stays empty (the `??`
/// in Vue is nullish-only — `""` wins over the whole-locale fallback).
pub fn connection_detect_region(locale: &str) -> String {
    let mapped = match locale {
        "zh" | "zh-CN" | "zh-Hans" => Some("CN"),
        "zh-TW" => Some("TW"),
        "zh-HK" => Some("HK"),
        "ja" => Some("JP"),
        "ko" => Some("KR"),
        "de" => Some("DE"),
        "fr" => Some("FR"),
        "es" => Some("ES"),
        "pt" => Some("PT"),
        "ar" => Some("SA"),
        "ru" => Some("RU"),
        "en" => Some("US"),
        _ => None,
    };
    if let Some(region) = mapped {
        return region.to_string();
    }
    match locale.split('-').nth(1) {
        Some(subtag) => subtag.to_uppercase(),
        None => locale.to_uppercase(),
    }
}

/// The full `useConnectionInfo` computed as one pure step, `??` defaults
/// and the always-null `asn` included.
pub fn connection_info(input: &ConnectionInfoInput) -> ConnectionInfo {
    let tier = connection_tier(input.transport_tier.as_deref(), input.is_localhost);
    ConnectionInfo {
        state: connection_info_state(input.state),
        quality: connection_quality(input.state, &tier),
        tier,
        latency_ms: input.latency_ms,
        is_localhost: input.is_localhost,
        region: connection_detect_region(&input.locale),
        retry_count: input.retry_count.unwrap_or(0),
        max_retries: input.max_retries.unwrap_or(3),
        asn: None,
        attempt_number: input.attempt_number.unwrap_or(0),
        countdown: input.countdown.unwrap_or(0),
    }
}

/// Vue's `mergedInfo` overlay: the server-reported network context wins for
/// `region` (a non-empty value that is not the `XX` unknown sentinel) and
/// for `asn` (a present value); both absent means no `network` object and
/// the base survives untouched.
pub fn merge_engine_network(
    base: ConnectionInfo,
    region: Option<&str>,
    asn: Option<u32>,
) -> ConnectionInfo {
    if region.is_none() && asn.is_none() {
        return base;
    }
    let mut merged = base;
    if let Some(region) = region
        && !region.is_empty()
        && region != "XX"
    {
        merged.region = region.to_string();
    }
    if let Some(asn) = asn {
        merged.asn = Some(asn);
    }
    merged
}

/// Vue's `connectionStatus` computed: the `idle` override WINS over the
/// probe (the resting gray light is a definite statement about the SHELL);
/// otherwise connected → connected, connecting/reconnecting →
/// reconnecting, everything else → disconnected.
pub fn connection_status(idle: bool, state: ConnectionStateInput) -> StatusBarConnection {
    if idle {
        return StatusBarConnection::Idle;
    }
    match connection_info_state(state) {
        ConnectionInfoState::Connected => StatusBarConnection::Connected,
        ConnectionInfoState::Reconnecting => StatusBarConnection::Reconnecting,
        ConnectionInfoState::Disconnected => StatusBarConnection::Disconnected,
    }
}

#[define_props]
pub struct ConnectionStatusProps {
    /// The served panel version line (Vue default `"0.1.0"`).
    #[default("0.1.0".to_string())]
    pub version: String,

    pub panel_build_hash: Option<String>,

    /// The secondary backend traffic light (Vue: `backendStatus`).
    pub backend_status: Option<ConnectionBackendStatus>,

    /// Render the shell's own `footer.s-status-bar` band (Vue default true).
    #[default(true)]
    pub standalone: bool,

    /// Forwarded to the StatusBar — collapse the pill to the bare dot.
    #[default]
    pub compact: bool,

    /// Resting override: pins the light to the neutral idle state whatever
    /// the probe reports (sessionless surfaces set it).
    #[default]
    pub idle: bool,

    // ── The probe surface (Vue: injected; defaults = INERT_PROBE) ───────
    #[default]
    pub probe_state: ConnectionStateInput,

    /// Canonical transport tier (INERT sentinel: `"unknown"`).
    #[default(Some("unknown".to_string()))]
    pub transport_tier: Option<String>,

    pub latency_ms: Option<f64>,

    /// 1-based connect-attempt counter (also wired as the hook's
    /// `retryCount` — the deprecated-alias quirk, kept verbatim).
    #[default]
    pub attempt_number: u32,

    #[default]
    pub retry_total: u32,

    /// Seconds until the next automatic probe attempt.
    #[default]
    pub countdown: u32,

    // ── The engine-health surface (Vue: HK_ENGINE_HEALTH) ──────────────
    pub engine_version: Option<String>,

    pub engine_build_hash: Option<String>,

    /// Server-reported region (`XX` is the unknown sentinel, ignored).
    pub engine_region: Option<String>,

    pub engine_asn: Option<u32>,

    /// `detectRegion`'s input (Vue: `navigator.language`; wasip2 default
    /// `en`).
    #[default("en".to_string())]
    pub locale: String,

    /// `isLocalhostUrl()`'s verdict (Vue: `window.location.hostname`).
    #[default]
    pub localhost: bool,

    /// `retryNow` (Vue's inert default is a no-op).
    pub on_retry: Option<EventHandler<()>>,

    /// Extras after the status tags (Vue: the `left` slot).
    pub left: Option<Element>,

    /// Extras on the far right (Vue: the `right` slot).
    pub right: Option<Element>,

    /// Forwarded to the StatusBar's status-row cluster (Vue: the `actions`
    /// slot).
    pub actions: Option<Element>,
}

#[component]
pub fn ConnectionStatus(props: ConnectionStatusProps) -> Element {
    let info = connection_info(&ConnectionInfoInput {
        state: props.probe_state,
        transport_tier: props.transport_tier.clone(),
        // The deprecated-alias wiring, verbatim: the shell hands
        // `attemptNumber` as the hook's `retryCount` too.
        retry_count: Some(props.attempt_number),
        max_retries: Some(props.retry_total),
        attempt_number: Some(props.attempt_number),
        countdown: Some(props.countdown),
        latency_ms: props.latency_ms,
        is_localhost: props.localhost,
        locale: props.locale.clone(),
    });
    let info = merge_engine_network(info, props.engine_region.as_deref(), props.engine_asn);

    let bar = StatusBar(StatusBarProps {
        has_connection_info: Some(true),
        version: props.version.clone(),
        panel_build_hash: props.panel_build_hash.clone(),
        engine_version: props.engine_version.clone(),
        engine_build_hash: props.engine_build_hash.clone(),
        connection_status: connection_status(props.idle, props.probe_state),
        quality: Some(info.quality.to_string()),
        latency_ms: info.latency_ms,
        transport_tier: Some(info.tier.clone()),
        attempt_number: Some(info.attempt_number),
        max_retries: Some(info.max_retries),
        countdown: Some(info.countdown as f64),
        region: Some(info.region.clone()),
        asn: info.asn,
        is_localhost: info.is_localhost,
        standalone: false,
        compact: props.compact,
        actions: props.actions.clone(),
        on_retry: props.on_retry.clone(),
        ..Default::default()
    });

    let inner = rsx! {
        div { class: "s-status-bar-left",
            {bar}
            if let Some(backend) = &props.backend_status {
                span {
                    class: "s-status-bar-tag",
                    style: "cursor:default",
                    span {
                        class: "s-status-bar-dot",
                        style: format!("background:{}", backend.state.color()),
                    }
                    span { class: "s-status-bar-tag-label", {backend.label.clone()} }
                    span { class: "s-status-bar-tag-value", {backend.state.label()} }
                }
            }
            if let Some(left) = &props.left {
                {left.clone()}
            }
        }
        div { class: "s-status-bar-center" }
        div { class: "s-status-bar-right",
            if let Some(right) = &props.right {
                {right.clone()}
            }
        }
    };

    if props.standalone {
        // Vue: the default wraps the bands in the shell's own footer.
        rsx! {
            footer { class: "s-status-bar",
                {inner}
            }
        }
    } else {
        // `!standalone` returns the bare fragment — a host owns the band.
        inner
    }
}

impl StyledComponent for ConnectionStatusComponent {
    fn styles() -> &'static str {
        // No sheet of its own: the `s-status-bar*` rules are the host's
        // shared admin-token sheet (`styled::vue_admin_tokens_css`, chrome
        // registration `vue-admin-tokens`). See the file header.
        ""
    }

    fn name() -> &'static str {
        "connection-status"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn connection_status_defaults_are_the_inert_shell() {
        let props = ConnectionStatusProps::default();
        assert_eq!(props.version, "0.1.0");
        assert!(props.standalone);
        assert!(!props.compact);
        assert!(!props.idle);
        assert_eq!(props.probe_state, ConnectionStateInput::Disconnected);
        assert_eq!(props.transport_tier.as_deref(), Some("unknown"));
        assert_eq!(props.latency_ms, None);
        assert_eq!(props.attempt_number, 0);
        assert_eq!(props.retry_total, 0);
        assert_eq!(props.countdown, 0);
        assert_eq!(props.locale, "en");
        assert!(!props.localhost);
        assert!(props.panel_build_hash.is_none());
        assert!(props.backend_status.is_none());
        assert!(props.engine_version.is_none());
        assert!(props.engine_build_hash.is_none());
        assert!(props.engine_region.is_none());
        assert!(props.engine_asn.is_none());
        assert!(props.on_retry.is_none());
        assert!(props.left.is_none());
        assert!(props.right.is_none());
        assert!(props.actions.is_none());
    }

    #[test]
    fn connection_info_state_folds_five_states_into_three() {
        assert_eq!(
            connection_info_state(ConnectionStateInput::Connected),
            ConnectionInfoState::Connected
        );
        assert_eq!(
            connection_info_state(ConnectionStateInput::Connecting),
            ConnectionInfoState::Reconnecting
        );
        assert_eq!(
            connection_info_state(ConnectionStateInput::Reconnecting),
            ConnectionInfoState::Reconnecting
        );
        assert_eq!(
            connection_info_state(ConnectionStateInput::Disconnected),
            ConnectionInfoState::Disconnected
        );
        // `failed` folds to plain disconnected, exactly like Vue.
        assert_eq!(
            connection_info_state(ConnectionStateInput::Failed),
            ConnectionInfoState::Disconnected
        );
    }

    #[test]
    fn connection_tier_falls_back_through_localhost_to_ws() {
        assert_eq!(connection_tier(Some("ws"), false), "ws");
        assert_eq!(connection_tier(Some("poll"), true), "poll");
        assert_eq!(connection_tier(None, true), "local");
        assert_eq!(connection_tier(None, false), "ws");
    }

    #[test]
    fn connection_quality_only_exists_while_connected() {
        assert_eq!(
            connection_quality(ConnectionStateInput::Connected, "local"),
            "excellent"
        );
        assert_eq!(
            connection_quality(ConnectionStateInput::Connected, "ws"),
            "good"
        );
        assert_eq!(
            connection_quality(ConnectionStateInput::Connected, "sse"),
            "fair"
        );
        assert_eq!(
            connection_quality(ConnectionStateInput::Reconnecting, "ws"),
            "unknown"
        );
        assert_eq!(
            connection_quality(ConnectionStateInput::Disconnected, "local"),
            "unknown"
        );
    }

    #[test]
    fn connection_detect_region_is_vues_locale_map() {
        assert_eq!(connection_detect_region("zh-Hans"), "CN");
        assert_eq!(connection_detect_region("zh"), "CN");
        assert_eq!(connection_detect_region("zh-TW"), "TW");
        assert_eq!(connection_detect_region("en"), "US");
        assert_eq!(connection_detect_region("pt"), "PT");
        // Unmapped locales use the subtag after the first dash, upper-cased.
        assert_eq!(connection_detect_region("pt-BR"), "BR");
        assert_eq!(connection_detect_region("xx-kronos"), "KRONOS");
        assert_eq!(connection_detect_region("xx"), "XX");
    }

    #[test]
    fn connection_is_localhost_matches_vues_host_list() {
        assert!(connection_is_localhost("localhost"));
        assert!(connection_is_localhost("127.0.0.1"));
        assert!(connection_is_localhost("[::1]"));
        assert!(!connection_is_localhost("celestia.world"));
        assert!(!connection_is_localhost(""));
    }

    #[test]
    fn connection_info_applies_the_hook_defaults() {
        // The bare input models the hook called with NO refs: the tier
        // falls to the ws default (the "unknown" sentinel is the INERT
        // PROBE's value, a props default — see the props test).
        let info = connection_info(&ConnectionInfoInput::default());
        assert_eq!(info.state, ConnectionInfoState::Disconnected);
        assert_eq!(info.tier, "ws");
        assert_eq!(info.quality, "unknown");
        assert_eq!(info.latency_ms, None);
        assert!(!info.is_localhost);
        assert_eq!(info.region, "US", "the default locale is en");
        assert_eq!(info.retry_count, 0);
        assert_eq!(info.max_retries, 3, "the ?? 3 default survives");
        assert_eq!(info.asn, None, "useConnectionInfo always writes null");
        assert_eq!(info.attempt_number, 0);
        assert_eq!(info.countdown, 0);

        // The INERT shell's exact input: every ref present, zeroed.
        let inert = connection_info(&ConnectionInfoInput {
            transport_tier: Some("unknown".to_string()),
            retry_count: Some(0),
            max_retries: Some(0),
            ..Default::default()
        });
        assert_eq!(inert.tier, "unknown");
        assert_eq!(inert.max_retries, 0);

        let live = connection_info(&ConnectionInfoInput {
            state: ConnectionStateInput::Connected,
            transport_tier: Some("ws".to_string()),
            retry_count: Some(2),
            max_retries: Some(5),
            attempt_number: Some(2),
            countdown: Some(7),
            latency_ms: Some(42.0),
            is_localhost: false,
            locale: "zh-Hans".to_string(),
        });
        assert_eq!(live.state, ConnectionInfoState::Connected);
        assert_eq!(live.quality, "good");
        assert_eq!(live.latency_ms, Some(42.0));
        assert_eq!(live.region, "CN");
        assert_eq!(live.max_retries, 5);
        assert_eq!(live.countdown, 7);
    }

    #[test]
    fn connection_merge_keeps_the_xx_sentinel_out() {
        let base = connection_info(&ConnectionInfoInput::default());
        // A network object with NEITHER fact merges nothing.
        assert_eq!(merge_engine_network(base.clone(), None, None), base);
        // "XX" is the backend's unknown-region sentinel: the local guess
        // survives (as does an empty region).
        assert_eq!(
            merge_engine_network(base.clone(), Some("XX"), None).region,
            base.region
        );
        assert_eq!(
            merge_engine_network(base.clone(), Some(""), None).region,
            base.region
        );
        // A real region wins; a present asn wins.
        let merged = merge_engine_network(base.clone(), Some("JP"), Some(64512));
        assert_eq!(merged.region, "JP");
        assert_eq!(merged.asn, Some(64512));
        // Region without asn keeps the base's (null) asn.
        assert_eq!(merge_engine_network(base, Some("DE"), None).asn, None);
    }

    #[test]
    fn connection_status_idle_override_wins_over_the_probe() {
        assert_eq!(
            connection_status(true, ConnectionStateInput::Disconnected),
            StatusBarConnection::Idle,
            "idle pins the light even on a faulting probe"
        );
        assert_eq!(
            connection_status(true, ConnectionStateInput::Connected),
            StatusBarConnection::Idle
        );
        assert_eq!(
            connection_status(false, ConnectionStateInput::Connected),
            StatusBarConnection::Connected
        );
        assert_eq!(
            connection_status(false, ConnectionStateInput::Connecting),
            StatusBarConnection::Reconnecting
        );
        assert_eq!(
            connection_status(false, ConnectionStateInput::Failed),
            StatusBarConnection::Disconnected
        );
    }

    #[test]
    fn connection_backend_state_maps_colors_and_words() {
        assert_eq!(
            ConnectionBackendState::Ok.color(),
            "rgb(var(--color-success))"
        );
        assert_eq!(
            ConnectionBackendState::Warn.color(),
            "rgb(var(--color-warning))"
        );
        assert_eq!(
            ConnectionBackendState::Error.color(),
            "rgb(var(--color-error))"
        );
        assert_eq!(
            ConnectionBackendState::Unknown.color(),
            "var(--color-muted)"
        );
        assert_eq!(ConnectionBackendState::Warn.as_str(), "warn");
        // The Rust bundle does not carry the four keys yet — the English
        // fallbacks are Vue's own en-locale values.
        assert_eq!(ConnectionBackendState::Ok.label(), "OK");
        assert_eq!(ConnectionBackendState::Warn.label(), "Degraded");
        assert_eq!(ConnectionBackendState::Error.label(), "Error");
        assert_eq!(ConnectionBackendState::Unknown.label(), "Unknown");
    }

    #[test]
    fn connection_status_renders_the_vue_shell_contract() {
        let html = ConnectionStatus(ConnectionStatusProps::default()).render_to_html();
        for needle in [
            r#"<footer class="s-status-bar">"#,
            r#"class="s-status-bar-left""#,
            r#"<div class="s-status-bar-center"></div>"#,
            r#"class="s-status-bar-right""#,
            // The StatusBar pill renders inside the left band (its own
            // s-status-bar-tag chrome — not this file's backend tag).
            "s-status-bar-tag",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Inert shell: no backend tag (its `cursor:default` chrome is the
        // backend-only marker — the StatusBar pill's own inline rows do
        // render `s-status-bar-tag-label`), no slots.
        assert!(!html.contains("cursor:default"), "{html}");
        assert!(!html.contains("MOCK"), "{html}");
    }

    #[test]
    fn connection_status_renders_the_backend_tag_and_slots() {
        let html = ConnectionStatus(ConnectionStatusProps {
            backend_status: Some(ConnectionBackendStatus {
                label: "plana".to_string(),
                state: ConnectionBackendState::Warn,
            }),
            left: Some(rsx! { span { "MOCK" } }),
            right: Some(rsx! { span { "v1.2.3" } }),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // The tag is inert chrome: cursor default, never a button.
            r#"class="s-status-bar-tag" style="cursor:default""#,
            r#"class="s-status-bar-dot" style="background:rgb(var(--color-warning))""#,
            r#"<span class="s-status-bar-tag-label">plana</span>"#,
            r#"<span class="s-status-bar-tag-value">Degraded</span>"#,
            ">MOCK<",
            ">v1.2.3<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
    }

    #[test]
    fn connection_status_idle_pins_the_pill_and_non_standalone_drops_the_footer() {
        // idle + compact: the pill's compact aria carries "Ready · version"
        // (the exact contract the Vue shell test pins) even though the
        // probe underneath reports disconnected.
        let idle = ConnectionStatus(ConnectionStatusProps {
            idle: true,
            compact: true,
            version: "1.2.3".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(idle.contains(r#"aria-label="Ready · 1.2.3""#), "{idle}");

        let bare = ConnectionStatus(ConnectionStatusProps {
            standalone: false,
            ..Default::default()
        })
        .render_to_html();
        assert!(!bare.contains("<footer"), "no standalone band: {bare}");
        assert!(bare.contains(r#"class="s-status-bar-left""#), "{bare}");
    }

    #[test]
    fn connection_status_styles_stay_empty_and_the_geometry_lives_in_chrome() {
        // Verified conclusion: the component ships no sheet; every class it
        // writes belongs to the shared admin-token sheet, mirrored as
        // `vue_admin_tokens_css` and registered as chrome by the registry.
        assert_eq!(
            ConnectionStatusComponent::styles(),
            "",
            "the shell owns no sheet of its own"
        );
        assert_eq!(ConnectionStatusComponent::name(), "connection-status");
        let chrome = crate::styled::vue_admin_tokens_css();
        for class_name in [
            ".s-status-bar",
            ".s-status-bar-left",
            ".s-status-bar-center",
            ".s-status-bar-right",
            ".s-status-bar-tag",
            ".s-status-bar-dot",
        ] {
            assert!(
                chrome.contains(class_name),
                "the admin-token chrome must own the s-status-bar* rules (missing {class_name})"
            );
        }
    }
}
