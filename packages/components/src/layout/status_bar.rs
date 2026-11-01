// hi-components/src/layout/status_bar.rs
// StatusBar — mirror of the canonical Vue `HkStatusBar` (the connection +
// version pill for app footers).
//
// NO HIKARI SHEET, on purpose. The Vue component ships none: every class it
// writes is a HOST class from `packages/vue/src/styles/admin-tokens.scss`
// (`s-status-bar*` — including the `[data-compact]` block that hides the inline
// version rows), and everything else is inline style. So the mirror guarantees
// the DOM STRUCTURE and the `data-*` hooks only; `styles()` returns `""` and
// this file invents no CSS beyond the inline geometry Vue itself writes.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   footer.s-status-bar                                (standalone only)
//     span.s-status-bar-tag [.s-status-bar-tag-reconnecting]
//                           [.s-status-bar-tag-recovered] [data-compact]
//          role="button" tabindex="0" [aria-label]
//          (style: position:relative;z-index:51)
//       span.s-status-bar-dot (style: background:{mode tone})
//       span.s-status-bar-tag-value
//         span.s-status-bar-tag-label {Panel}
//         span.s-status-bar-version [title]            (the panel version)
//           span.s-status-bar-version__static {text}
//         ── engine_version ──
//         span.s-status-bar-tag-label {Engine}
//         span.s-status-bar-version [title]            (the engine version)
//     ── popup_open ──  (the mirrored Popover, placement top-start)
//     div[data-status-bar-card]
//          (style: min-width:min(300px, calc(100vw - 2 * var(--viewport-gutter, 16px)));
//                  padding:10px 14px;font-size:0.75rem;line-height:1.6;
//                  color:rgb(var(--color-text)))
//       div (header row)  quality glyph · status text · latency chip? · actions?
//       div (retry row)   "Retrying n / m" + countdown digit   (connecting && attempt > 0)
//       div[role=button]  "Click to retry"                     (disconnected && no actions)
//       div (panel row)   glyph · "Panel" · version cell
//       div (engine row)  glyph · "Engine" · version cell      (engine_version)
//       div (protocol row) glyph · "Protocol" · tier label     (tier shows)
//       div (network row)  glyph · "Network" · region · AS n · Local
//       div[data-extra-detail={key}] …                         (extra_details)
//
// The two version values (panel row, engine row) merge ONCE from the raw facts
// through [`status_bar_merge_version_display`] — the family's set-based,
// duplicate-free-by-construction rule: every whitespace token of the version
// line, then the stamp, is keyed (git tokens by commit, non-git tokens by their
// raw text) and an already-seen key is dropped, so no pair of inputs can print
// one identity twice. A stamp whose commit the version line already names adds
// nothing; a DIFFERENT commit always stays visible, because that drift IS the
// stale-embed signal.
//
// STATE CONTRACT (ledger L48). Vue keeps `popupOpen`, `touchOpenedPopover` and
// the recovery-flash machine (`seenConnected` + `recovering` + two timers) in
// refs, plus a hover close-timer, a touch-vs-gesture discriminator and an echo
// guard. `use_signal` allocates a fresh signal per render and `use_state`
// shares ONE slot per component TYPE in tairitsu 0.5.22, so BOTH are
// unavailable: `popup_open` and `recovered` are CONTROLLED props and every
// transition leaves through a callback (`on_popup_change`). The flash DECISION
// is a pure function ([`status_bar_recover_flash`]) the host applies on its own
// status changes. The component stores nothing itself.
//
// Deltas vs Vue (documented, not accidental):
//   * `connectionInfo` (one object) is FLATTENED into the props it is read
//     through (`quality`, `latency_ms`, `transport_tier`, `attempt_number`,
//     `max_retries`, `countdown`, `region`, `asn`, `is_localhost`). Vue merges
//     `props.X ?? info.X ?? default`; the mirror takes the merged value once,
//     from the host.
//   * NO HOVER OPEN / CLOSE TIMER, NO TOUCH ENGINE. Vue opens on
//     mouseenter, closes 250ms after leave, distinguishes a tap from a scroll
//     and arms a 400ms echo guard so a synthesized click cannot double-fire the
//     retry. None of that is portable this wave (no per-instance state, no
//     timer primitive), so the mirror keeps the TAP semantics on `click`: press
//     = ask to open the details + retry when the mode allows it (Vue's
//     `onTagClick`), and the host may drive `popup_open` from its own pointer
//     events.
//   * The recovery flash is a CONTROLLED flag (`recovered`) instead of a
//     1200ms internal timer: [`status_bar_recover_flash`] returns whether the
//     transition deserves the flash and what the next `seen_connected` value
//     is, so the host owns the clock without re-deriving the rule.
//   * `HkCountdownDigit` IS mirrored (`display/countdown_digit.rs`) and composed
//     for the retry countdown; `HkPlaceholderMarquee` is NOT, so a version cell
//     renders its static layer only — `data-overflowing` is never set and a
//     long branch identity clips instead of scrolling.
//   * `regionDisplayName` keeps the i18n key first (`components.hk.statusBar.
//     region.{code}`) and the raw code last; the `Intl.DisplayNames` middle
//     fallback has no Rust analogue in this crate, so a region with no key
//     renders its code (documented, not silent).
//   * Glyphs: lucide `Wifi` / `WifiOff` / `Cable` / `Monitor` / `Cog` / `Plug` /
//     `Globe` have no `MdiIcon` counterparts in the crate's minimal set, so the
//     mirror maps them onto the closest members — table in
//     [`status_bar_quality_icon`] and the row-icon constants below. They ride
//     the mirrored `Icon` (which renders `div.hk-icon`), not lucide markup.
//   * No `Teleport` and no popup-manager z-band for the details card: the
//     mirrored `Popover` already renders a fixed panel (see its own header).
//   * The `actions` cluster is gated on RENDERED content (Vue counts the slot's
//     vnodes) — here `actions.is_some()`.
//
// Behaviour taken from the Vue component: the popover body never sits on a
// "fetching" placeholder — the heading is ALWAYS a definite state and the
// version rows show up front, with the probe-dependent rows (retry, protocol,
// network, extra details) joining only once their facts exist.

use hikari_i18n::t;

use hikari_icons::{Icon, MdiIcon};

use crate::display::{CountdownDigit, CountdownDigitProps};
use crate::feedback::popover::{PopoverAnchorRect, PopoverPlacement};
use crate::feedback::{Popover, PopoverProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct StatusBarComponent;

/// The five connection states (Vue: `connected | reconnecting | disconnected |
/// connecting | idle`, default `disconnected`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StatusBarConnection {
    Connected,
    Reconnecting,
    #[default]
    Disconnected,
    Connecting,
    /// The shell is alive but has no session — the login page's resting light.
    Idle,
}

impl StatusBarConnection {
    /// Vue's `mode` token.
    pub fn as_str(self) -> &'static str {
        match self {
            StatusBarConnection::Connected => "connected",
            StatusBarConnection::Reconnecting => "reconnecting",
            StatusBarConnection::Disconnected => "disconnected",
            StatusBarConnection::Connecting => "connecting",
            StatusBarConnection::Idle => "idle",
        }
    }

    /// Vue's `connecting = mode === "reconnecting" || mode === "connecting"`.
    pub fn is_connecting(self) -> bool {
        matches!(
            self,
            StatusBarConnection::Reconnecting | StatusBarConnection::Connecting
        )
    }

    /// The traffic-light tone (Vue's `dotColorMap`; idle is the neutral resting
    /// ink — red means FAULT, and "not yet logged in" is not one).
    pub fn dot_color(self) -> &'static str {
        match self {
            StatusBarConnection::Connected => "rgb(var(--color-success))",
            StatusBarConnection::Connecting | StatusBarConnection::Reconnecting => {
                "rgb(var(--color-warning))"
            }
            StatusBarConnection::Disconnected => "rgb(var(--color-error))",
            StatusBarConnection::Idle => {
                "rgb(var(--color-text-tertiary, var(--color-text-secondary, 128 128 128)))"
            }
        }
    }
}

/// One git identity atom: a commit, optionally labeled by its branch
/// (Vue: `HkVersionIdentity`). `feat/x:770f625`, the legacy `feat/x::770f625`
/// and a bare `770f625` all carry the SAME commit — the commit IS the identity;
/// branch labels are names for it.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct StatusBarVersionIdentity {
    pub branch: Option<String>,
    pub commit: String,
}

/// One extra label/value row appended to the details card (Vue:
/// `extraDetails` entry).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct StatusBarExtraDetail {
    pub key: String,
    /// Leading glyph node (Vue: a prebuilt icon vnode).
    pub icon: Option<Element>,
    pub label: String,
    pub value: String,
}

/// A git-ish token is `<branch>:<hash7..40>` / the legacy `<branch>::<hash>` /
/// a bare `<hash>`. Both separators count: the family narrowed `::` → `:` on
/// 2026-10-11 and transition-window binaries still speak either shape. Non-git
/// tokens (retired Crockford chunk stamps like `EDW62Q`) carry no commit and
/// return `None` — they can never be "already shown".
pub fn status_bar_parse_identity(token: &str) -> Option<StatusBarVersionIdentity> {
    fn is_hex(token: &str) -> bool {
        (7..=40).contains(&token.len()) && token.chars().all(|ch| ch.is_ascii_hexdigit())
    }

    if token.is_empty() {
        return None;
    }
    if is_hex(token) {
        return Some(StatusBarVersionIdentity {
            branch: None,
            commit: token.to_ascii_lowercase(),
        });
    }
    // `<branch>:<hash>` / `<branch>::<hash>`: the branch is everything before
    // the LAST colon run, the commit the hex tail after it.
    if let Some((branch, commit)) = token.rsplit_once(':') {
        let commit = commit.trim_start_matches(':');
        if !branch.is_empty() && is_hex(commit) {
            return Some(StatusBarVersionIdentity {
                branch: Some(branch.trim_end_matches(':').to_string()),
                commit: commit.to_ascii_lowercase(),
            });
        }
    }
    None
}

/// The identity key of one token: git tokens key on their commit (case-folded,
/// separator-agnostic), everything else on its raw (case-folded) text.
fn status_bar_identity_key(token: &str) -> String {
    match status_bar_parse_identity(token) {
        Some(identity) => format!("c:{}", identity.commit),
        None => format!("t:{}", token.to_lowercase()),
    }
}

/// Canonical display merge for a `<version line> + <build stamp>` pair — the ONE
/// rule every identity surface consumes. The two inputs are independent facts
/// (the served version line and the client stamp), so a plain concatenation can
/// print the same commit twice; this merge is set-based and therefore
/// duplicate-free BY CONSTRUCTION.
pub fn status_bar_merge_version_display(version: &str, hash: Option<&str>) -> String {
    let mut seen: Vec<String> = Vec::new();
    let mut out: Vec<String> = Vec::new();
    for token in version.split_whitespace() {
        let key = status_bar_identity_key(token);
        if seen.contains(&key) {
            continue;
        }
        seen.push(key);
        out.push(token.to_string());
    }
    if let Some(stamp) = hash.map(str::trim).filter(|stamp| !stamp.is_empty()) {
        let key = status_bar_identity_key(stamp);
        if !seen.contains(&key) {
            out.push(stamp.to_string());
        }
    }
    out.join(" ")
}

/// The tag's state text (Vue's `statusText` ternary). `idle` reads "Ready": the
/// shell is alive and resting, not failing.
pub fn status_bar_status_text(mode: StatusBarConnection) -> String {
    match mode {
        StatusBarConnection::Idle => t("components.hk.statusBar.idle", "Ready"),
        StatusBarConnection::Connected => t("components.hk.statusBar.connected", "Connected"),
        StatusBarConnection::Connecting | StatusBarConnection::Reconnecting => {
            t("components.hk.statusBar.connecting", "Connecting...")
        }
        StatusBarConnection::Disconnected => {
            t("components.hk.statusBar.disconnected", "Disconnected")
        }
    }
}

/// Vue's `latencyColor`: `< 30ms` good, `< 100ms` fair, else poor; `None` is
/// the muted ink.
pub fn status_bar_latency_color(ms: Option<f64>) -> &'static str {
    match ms {
        None => "var(--color-muted)",
        Some(ms) if ms < 30.0 => "rgb(var(--color-success))",
        Some(ms) if ms < 100.0 => "rgb(var(--color-warning))",
        Some(_) => "rgb(var(--color-error))",
    }
}

/// Vue's `tagClass` list: the base hook plus the in-flight breath and the
/// recovery flash modifiers.
pub fn status_bar_tag_classes(mode: StatusBarConnection, recovered: bool) -> String {
    let mut classes = String::from("s-status-bar-tag");
    if mode.is_connecting() {
        classes.push_str(" s-status-bar-tag-reconnecting");
    }
    if recovered {
        classes.push_str(" s-status-bar-tag-recovered");
    }
    classes
}

/// The recovery-flash decision, as a pure function of the observed transition.
/// The flash acknowledges a connection the user SAW go down; the first connect
/// of the component's life stays quiet. `seen_connected` seeds from the initial
/// status, so a bar that mounts while already connected still counts as
/// established and a LATER drop/recover pair flashes.
///
/// Returns `(flash, next_seen_connected)`.
pub fn status_bar_recover_flash(
    next_mode: StatusBarConnection,
    seen_connected: bool,
) -> (bool, bool) {
    if next_mode != StatusBarConnection::Connected {
        return (false, seen_connected);
    }
    if seen_connected {
        // Established before, connected again → flash (a real recovery).
        (true, true)
    } else {
        // The FIRST connect of this component's life stays quiet.
        (false, true)
    }
}

/// Vue's compact-mode accessible name:
/// `${statusText} · ${panelVersion}${engine ? ` · ${engineVersion}` : ""}`.
pub fn status_bar_aria_label(
    compact: bool,
    mode: StatusBarConnection,
    panel_version: &str,
    engine_version: Option<&str>,
) -> Option<String> {
    if !compact {
        return None;
    }
    let status = status_bar_status_text(mode);
    let mut label = format!("{status} · {panel_version}");
    if let Some(engine) = engine_version {
        label.push_str(" · ");
        label.push_str(engine);
    }
    Some(label)
}

/// Vue's `regionDisplayName`: the political-name i18n keys first (they carry
/// the deliberate naming per language), the raw code last. Vue's middle
/// `Intl.DisplayNames` fallback has no Rust counterpart here — see the header
/// delta.
pub fn status_bar_region_name(region: &str) -> String {
    if region.is_empty() {
        return String::new();
    }
    let key = format!("components.hk.statusBar.region.{region}");
    let keyed = t(&key, "");
    if keyed.is_empty() {
        region.to_string()
    } else {
        keyed
    }
}

/// Vue's `qualityIcon`: a wired local link, a live wireless link (dimmed while
/// the quality is unknown) or no link at all. The lucide → `MdiIcon` mapping
/// (the crate's minimal set has none of `Wifi` / `WifiOff` / `Cable`):
/// localhost → [`MdiIcon::Home`], live → [`MdiIcon::Pulse`],
/// unknown → [`MdiIcon::Help`], else → [`MdiIcon::Alert`].
pub fn status_bar_quality_icon(
    quality: Option<&str>,
    is_localhost: bool,
    mode: StatusBarConnection,
) -> MdiIcon {
    if is_localhost {
        return MdiIcon::Home;
    }
    match quality {
        Some("excellent") | Some("good") | Some("fair") => MdiIcon::Pulse,
        Some("unknown") => MdiIcon::Help,
        Some(_) => MdiIcon::Alert,
        // Vue: `info?.quality || (mode === "connected" ? "good" : "unknown")`.
        None => {
            if mode == StatusBarConnection::Connected {
                MdiIcon::Pulse
            } else {
                MdiIcon::Help
            }
        }
    }
}

/// Vue's `t("statusBar.retrying").replace("{retryCount}", …).replace("{maxRetries}", …)`
/// — the template replaces both placeholders; `maxRetries` of `0`/absent falls
/// back to 3.
pub fn status_bar_retry_text(attempt: u32, max_retries: Option<u32>) -> String {
    let template = t(
        "components.hk.statusBar.retrying",
        "Retrying {retryCount} / {maxRetries}",
    );
    let max = match max_retries {
        Some(max) if max > 0 => max,
        _ => 3,
    };
    template
        .replace("{retryCount}", &attempt.to_string())
        .replace("{maxRetries}", &max.to_string())
}

/// Vue's protocol/network gate: a sentinel tier (`none`/`unknown`) suppresses
/// BOTH rows — a local panel has no transport or region fact to show.
pub fn status_bar_shows_transport(tier: Option<&str>) -> bool {
    !matches!(tier, Some("none") | Some("unknown"))
}

/// The resolved tier (Vue: `props.transportTier ?? info.tier ?? "ws"`).
pub fn status_bar_transport_tier(tier: Option<&str>) -> String {
    match tier {
        Some(tier) if !tier.is_empty() => tier.to_string(),
        _ => "ws".to_string(),
    }
}

/// The protocol row's value: while connecting the probe is still running, so
/// the row reads "Probing..." instead of a stale tier label.
pub fn status_bar_protocol_text(mode: StatusBarConnection, tier: &str) -> String {
    if mode.is_connecting() {
        t("components.hk.statusBar.probing", "Probing...")
    } else {
        let key = format!("components.hk.statusBar.tier.{tier}");
        t(&key, tier)
    }
}

/// The network row's value: `region[ · AS<asn>][ · Local]`.
pub fn status_bar_network_text(region: &str, asn: Option<u32>, is_localhost: bool) -> String {
    let mut text = status_bar_region_name(region);
    if let Some(asn) = asn {
        text.push_str(&format!(" · AS{asn}"));
    }
    if is_localhost {
        text.push_str(" · ");
        text.push_str(&t("components.hk.statusBar.local", "Local"));
    }
    text
}

/// The card's inline geometry (Vue's literal `style` object), verbatim.
pub const STATUS_BAR_CARD_STYLE: &str = "min-width:min(300px, calc(100vw - 2 * var(--viewport-gutter, 16px)));padding:10px 14px;font-size:0.75rem;line-height:1.6;color:rgb(var(--color-text))";

/// The tag's inline geometry (Vue's literal `style` object), verbatim.
pub const STATUS_BAR_TAG_STYLE: &str = "position:relative;z-index:51";

/// The panel row's glyph (lucide `Monitor` → [`MdiIcon::Panel`]).
const STATUS_BAR_PANEL_ICON: MdiIcon = MdiIcon::Panel;
/// The engine row's glyph (lucide `Cog`).
const STATUS_BAR_ENGINE_ICON: MdiIcon = MdiIcon::Cog;
/// The protocol row's glyph (lucide `Plug` → the crate's transport glyph).
const STATUS_BAR_PROTOCOL_ICON: MdiIcon = MdiIcon::SwapHorizontal;
/// The network row's glyph (lucide `Globe` → the crate's location glyph).
const STATUS_BAR_NETWORK_ICON: MdiIcon = MdiIcon::Marker;

/// Vue's presence-only marker: `data-*` carries `"true"` while the flag is on
/// and is ABSENT otherwise (a serialized `="false"` still answers a
/// `[data-compact]` selector).
fn marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

/// One version value cell: the static text with its hover copy. Vue layers
/// `HkPlaceholderMarquee` over it and flips `data-overflowing`; that component
/// is not mirrored this wave (see the file header), so the static layer stands
/// alone.
fn version_cell(text: &str) -> Element {
    rsx! {
        span { class: "s-status-bar-version", title: text,
            span { class: "s-status-bar-version__static", {text} }
        }
    }
}

#[define_props]
pub struct StatusBarProps {
    /// Whether Vue's `connectionInfo` object exists (`None` derives it from the
    /// flattened fields; see the header's flattening delta).
    pub has_connection_info: Option<bool>,

    /// The served panel version line (Vue default `"0.1.0"`).
    #[default("0.1.0".to_string())]
    pub version: String,

    /// The engine's version line; `None` hides the engine row.
    pub engine_version: Option<String>,

    /// The panel's build stamp (merged once with `version`).
    pub panel_build_hash: Option<String>,

    /// The engine's build stamp.
    pub engine_build_hash: Option<String>,

    /// Connection state.
    #[default]
    pub connection_status: StatusBarConnection,

    /// Probe quality (`excellent | good | fair | unknown | …`).
    pub quality: Option<String>,

    /// Round-trip latency in ms.
    pub latency_ms: Option<f64>,

    /// Transport tier (`ws` / `http` / `none` / `unknown` …); `None` reads as
    /// `ws`, like Vue's `props.transportTier ?? info.tier ?? "ws"`.
    pub transport_tier: Option<String>,

    /// Retry attempt number (the retry row renders while connecting).
    pub attempt_number: Option<u32>,

    /// The retry budget (defaults to 3, like Vue).
    pub max_retries: Option<u32>,

    /// Countdown seconds until the next retry.
    pub countdown: Option<f64>,

    /// The probed network region code.
    pub region: Option<String>,

    /// The probed AS number.
    pub asn: Option<u32>,

    /// The panel is a local one (no transport/region facts).
    #[default]
    pub is_localhost: bool,

    /// Render the shell's own `footer.s-status-bar` band (Vue default true);
    /// `false` renders the tag alone for a host that owns its footer.
    #[default(true)]
    pub standalone: bool,

    /// Collapse the pill to the bare dot (the version rows move into the
    /// details card via the sheet's `[data-compact]` rule).
    #[default]
    pub compact: bool,

    /// Extra rows appended after the network row.
    #[default]
    pub extra_details: Vec<StatusBarExtraDetail>,

    /// CONTROLLED details-card visibility (Vue: `popupOpen`).
    #[default]
    pub popup_open: bool,

    /// Whether the open card was opened by a TAP — Vue uses it to close on an
    /// outside tap instead of the mouseleave timer (touch has no hover model).
    #[default]
    pub popup_touch_opened: bool,

    /// The trigger rect to anchor the card against
    /// (`feedback::popover::anchor_rect_from_element_id` measures one by id).
    pub popup_anchor: Option<PopoverAnchorRect>,

    /// CONTROLLED recovery-flash flag (Vue: the `recovering` ref); see
    /// [`status_bar_recover_flash`].
    #[default]
    pub recovered: bool,

    /// The host's action cluster for the card's header row (Vue: the `actions`
    /// slot).
    pub actions: Option<Element>,

    /// Retry requested (Vue: `props.onRetry`).
    pub on_retry: Option<EventHandler<()>>,

    /// Fires with the desired card state (Vue: the popover's
    /// `update:modelValue`, plus the hover/tap engines the mirror leaves to the
    /// host).
    pub on_popup_change: Option<EventHandler<bool>>,
}

#[component]
pub fn StatusBar(props: StatusBarProps) -> Element {
    let mode = props.connection_status;
    let connecting = mode.is_connecting();
    let panel_version =
        status_bar_merge_version_display(&props.version, props.panel_build_hash.as_deref());
    let engine_version = props
        .engine_version
        .as_ref()
        .map(|engine| status_bar_merge_version_display(engine, props.engine_build_hash.as_deref()));

    let status_text = status_bar_status_text(mode);
    let latency = props.latency_ms;
    let attempt = props.attempt_number.unwrap_or(0);
    let countdown = props.countdown.unwrap_or(0.0);
    let has_actions = props.actions.is_some();
    let tier = status_bar_transport_tier(props.transport_tier.as_deref());
    // Vue: `info && tier !== "none" && tier !== "unknown"`. `connectionInfo` is
    // flattened here, so its PRESENCE is a controlled flag; when the host does
    // not set it, any flattened field stands in for the object.
    let has_info = props.has_connection_info.unwrap_or_else(|| {
        props.transport_tier.is_some()
            || props.quality.is_some()
            || props.latency_ms.is_some()
            || props.region.is_some()
            || props.asn.is_some()
    });
    let shows_transport = has_info && status_bar_shows_transport(props.transport_tier.as_deref());
    let tag_classes = status_bar_tag_classes(mode, props.recovered);
    let aria_label = status_bar_aria_label(
        props.compact,
        mode,
        &panel_version,
        engine_version.as_deref(),
    );
    let quality_icon = status_bar_quality_icon(props.quality.as_deref(), props.is_localhost, mode);

    let retry = props.on_retry.clone();
    let popup_change = props.on_popup_change.clone();
    let mode_for_click = mode;
    let on_tag_activate = move || {
        // Vue's TAP path: open the details AND retry. `idle` is a settled
        // resting state, not a fault, so its click must not fire a silent retry
        // (only the overview opens).
        if let Some(handler) = popup_change.as_ref() {
            handler.call(true);
        }
        if mode_for_click != StatusBarConnection::Connected
            && mode_for_click != StatusBarConnection::Idle
            && let Some(handler) = retry.as_ref()
        {
            handler.call(());
        }
    };

    let tag = {
        let click_open = on_tag_activate.clone();
        let key_open = on_tag_activate.clone();
        rsx! {
            span {
                class: tag_classes,
                "data-compact": marker_attr(props.compact),
                "role": "button",
                tabindex: 0,
                "aria-label": aria_label,
                style: STATUS_BAR_TAG_STYLE,
                onclick: move |_event: MouseEvent| click_open(),
                onkeydown: move |event: KeyboardEvent| {
                    if event.key.as_str() == "Enter" || event.key.as_str() == " " {
                        event.prevent_default();
                        key_open();
                    }
                },
                span {
                    class: "s-status-bar-dot",
                    style: format!("background:{}", mode.dot_color()),
                }
                span {
                    class: "s-status-bar-tag-value",
                    span {
                        class: "s-status-bar-tag-label",
                        {t("components.hk.statusBar.panel", "Panel")}
                    }
                    {version_cell(&panel_version)}
                    if let Some(engine) = &engine_version {
                        span {
                            class: "s-status-bar-tag-label",
                            {t("components.hk.statusBar.engine", "Engine")}
                        }
                        {version_cell(engine)}
                    }
                }
            }
        }
    };

    // ── the details card ─────────────────────────────────────────────────
    let actions_gate = has_actions;
    let latency_chip = latency.map(|ms| {
        rsx! {
            span {
                style: format!(
                    "margin-left:auto;color:{};font-family:var(--font-mono);font-weight:600;font-size:0.6875rem",
                    status_bar_latency_color(Some(ms))
                ),
                {format!("{ms} ms")}
            }
        }
    });
    let show_retry_row = connecting && attempt > 0;
    let retry_row = if show_retry_row {
        Some(rsx! {
            div {
                style: "display:flex;align-items:center;gap:4px;color:rgb(var(--color-warning));font-size:0.6875rem;margin-bottom:4px",
                span { {status_bar_retry_text(attempt, props.max_retries)} }
                if countdown > 0.0 {
                    span {
                        style: "display:inline-flex;align-items:center;gap:4px;font-family:var(--font-mono);margin-left:8px",
                        {CountdownDigit(CountdownDigitProps {
                            value: countdown,
                            ..Default::default()
                        })}
                    }
                }
            }
        })
    } else {
        None
    };
    let show_click_hint = mode == StatusBarConnection::Disconnected && !actions_gate;
    let click_hint = if show_click_hint {
        let hint_retry = props.on_retry.clone();
        let hint_key = props.on_retry.clone();
        Some(rsx! {
            div {
                "role": "button",
                tabindex: 0,
                style: "font-style:italic;font-size:0.6875rem;margin-bottom:4px;opacity:0.7;cursor:pointer",
                onclick: move |_event: MouseEvent| {
                    if let Some(handler) = hint_retry.as_ref() {
                        handler.call(());
                    }
                },
                onkeydown: move |event: KeyboardEvent| {
                    if event.key.as_str() == "Enter" || event.key.as_str() == " " {
                        event.prevent_default();
                        if let Some(handler) = hint_key.as_ref() {
                            handler.call(());
                        }
                    }
                },
                {t("components.hk.statusBar.clickReconnect", "Click to retry")}
            }
        })
    } else {
        None
    };

    let engine_row = engine_version.as_ref().map(|engine| {
        rsx! {
            div { style: "display:flex;align-items:center;gap:6px",
                Icon {
                    icon: STATUS_BAR_ENGINE_ICON,
                    size: 12,
                    class: "s-status-bar-row-icon".to_string(),
                }
                span {
                    style: "opacity:0.5;margin-right:auto",
                    {t("components.hk.statusBar.engine", "Engine")}
                }
                span {
                    class: "s-status-bar-popover-value",
                    style: "font-family:var(--font-mono)",
                    {version_cell(engine)}
                }
            }
        }
    });

    let transport_rows = if shows_transport {
        let protocol_text = status_bar_protocol_text(mode, &tier);
        // The probing row owns the warning tint; the settled row inherits the
        // card's ink (Vue writes no colour at all in that arm).
        let probe_style = if connecting {
            "color:rgb(var(--color-warning))".to_string()
        } else {
            String::new()
        };
        let network_text = status_bar_network_text(
            props.region.as_deref().unwrap_or_default(),
            props.asn,
            props.is_localhost,
        );
        Some(rsx! {
            div { style: "display:flex;align-items:center;gap:6px",
                Icon {
                    icon: STATUS_BAR_PROTOCOL_ICON,
                    size: 12,
                    class: "s-status-bar-row-icon".to_string(),
                }
                span {
                    style: "opacity:0.5;margin-right:auto",
                    {t("components.hk.statusBar.protocol", "Protocol")}
                }
                span {
                    style: probe_style,
                    {protocol_text}
                }
            }
            div { style: "display:flex;align-items:center;gap:6px",
                Icon {
                    icon: STATUS_BAR_NETWORK_ICON,
                    size: 12,
                    class: "s-status-bar-row-icon".to_string(),
                }
                span {
                    style: "opacity:0.5;margin-right:auto",
                    {t("components.hk.statusBar.network", "Network")}
                }
                span { {network_text} }
            }
        })
    } else {
        None
    };

    let extra_rows: Vec<VNode> = props
        .extra_details
        .iter()
        .map(|row| {
            let key = row.key.clone();
            let label = row.label.clone();
            let value = row.value.clone();
            rsx! {
                div {
                    "data-extra-detail": key,
                    style: "display:flex;align-items:center;justify-content:space-between;gap:6px;max-width:400px",
                    span {
                        style: "opacity:0.5;flex-shrink:0;display:inline-flex",
                        {row.icon.clone().unwrap_or_else(empty_vnode)}
                    }
                    span {
                        style: "opacity:0.5;flex-shrink:0;min-width:72px;margin-right:auto",
                        {label}
                    }
                    span {
                        title: value.clone(),
                        style: "font-family:var(--font-mono);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap",
                        {value}
                    }
                }
            }
        })
        .collect();

    // No latency chip to push against: the cluster still lands on the row's
    // right edge.
    let actions_style = if latency.is_some() {
        "display:inline-flex;align-items:center;gap:8px".to_string()
    } else {
        "display:inline-flex;align-items:center;gap:8px;margin-left:auto".to_string()
    };
    let card_open_change = props.on_popup_change.clone();
    let card = if props.popup_open {
        Some(Popover(PopoverProps {
            open: true,
            placement: PopoverPlacement::TopStart,
            backdrop: false,
            // Touch has no hover model: a tap-opened card dismisses on an
            // outside tap instead of the (unmirrored) leave timer.
            close_on_backdrop: props.popup_touch_opened,
            anchor: props.popup_anchor,
            title: t("components.hk.statusBar.panel", "Panel"),
            on_open_change: card_open_change,
            children: rsx! {
                div {
                    "data-status-bar-card": "",
                    style: STATUS_BAR_CARD_STYLE,
                    div {
                        style: "display:flex;align-items:center;gap:6px;margin-bottom:6px;font-weight:600;font-size:0.8125rem",
                        Icon {
                            icon: quality_icon,
                            size: 14,
                            class: "s-status-bar-row-icon".to_string(),
                        }
                        span {
                            style: format!("color:{}", mode.dot_color()),
                            {status_text}
                        }
                        if let Some(chip) = &latency_chip {
                            {chip.clone()}
                        }
                        if actions_gate {
                            span {
                                "data-status-actions": "",
                                style: actions_style,
                                {props.actions.clone().unwrap_or_else(empty_vnode)}
                            }
                        }
                    }
                    if let Some(row) = &retry_row {
                        {row.clone()}
                    }
                    if let Some(hint) = &click_hint {
                        {hint.clone()}
                    }
                    div { style: "display:flex;align-items:center;gap:6px",
                        Icon {
                            icon: STATUS_BAR_PANEL_ICON,
                            size: 12,
                            class: "s-status-bar-row-icon".to_string(),
                        }
                        span {
                            style: "opacity:0.5;margin-right:auto",
                            {t("components.hk.statusBar.panel", "Panel")}
                        }
                        span {
                            class: "s-status-bar-popover-value",
                            style: "font-family:var(--font-mono)",
                            {version_cell(&panel_version)}
                        }
                    }
                    if let Some(row) = &engine_row {
                        {row.clone()}
                    }
                    if let Some(rows) = &transport_rows {
                        {rows.clone()}
                    }
                    {VNode::Fragment(extra_rows.clone())}
                }
            },
            ..Default::default()
        }))
    } else {
        None
    };

    let inner = VNode::Fragment(
        [Some(tag), card]
            .into_iter()
            .flatten()
            .collect::<Vec<VNode>>(),
    );

    if !props.standalone {
        return inner;
    }

    rsx! {
        footer {
            class: "s-status-bar",
            {inner}
        }
    }
}

impl StyledComponent for StatusBarComponent {
    fn styles() -> &'static str {
        // The Vue pill ships no sheet of its own: the `s-status-bar*` rules are
        // the host's admin token sheet. See the file header.
        ""
    }

    fn name() -> &'static str {
        "status-bar"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_bar_defaults_match_the_vue_props() {
        let props = StatusBarProps::default();
        assert_eq!(props.version, "0.1.0");
        assert!(props.engine_version.is_none());
        assert!(props.panel_build_hash.is_none());
        assert!(props.engine_build_hash.is_none());
        assert_eq!(props.connection_status, StatusBarConnection::Disconnected);
        assert!(props.quality.is_none());
        assert!(props.latency_ms.is_none());
        assert!(props.transport_tier.is_none());
        assert!(props.attempt_number.is_none());
        assert!(props.max_retries.is_none());
        assert!(props.countdown.is_none());
        assert!(props.region.is_none());
        assert!(props.asn.is_none());
        assert!(!props.is_localhost);
        assert!(props.standalone);
        assert!(!props.compact);
        assert!(props.extra_details.is_empty());
        assert!(!props.popup_open);
        assert!(!props.popup_touch_opened);
        assert!(props.popup_anchor.is_none());
        assert!(!props.recovered);
        assert!(props.actions.is_none());
        assert!(props.on_retry.is_none());
        assert!(props.on_popup_change.is_none());
    }

    #[test]
    fn status_bar_parses_the_three_identity_shapes() {
        // `<branch>:<hash>`
        let identity = status_bar_parse_identity("feat/x:770f625").expect("labeled");
        assert_eq!(identity.branch.as_deref(), Some("feat/x"));
        assert_eq!(identity.commit, "770f625");
        // The legacy `::` separator names the same commit.
        let legacy = status_bar_parse_identity("feat/x::770F625").expect("legacy");
        assert_eq!(legacy.branch.as_deref(), Some("feat/x"));
        assert_eq!(legacy.commit, "770f625");
        // A bare commit.
        let bare = status_bar_parse_identity("770f625").expect("bare");
        assert!(bare.branch.is_none());
        assert_eq!(bare.commit, "770f625");
        // Non-git tokens carry no commit and can never be "already shown".
        assert!(status_bar_parse_identity("EDW62Q").is_none());
        assert!(status_bar_parse_identity("").is_none());
        assert!(status_bar_parse_identity("0.1.0").is_none());
        // Too short / too long / non-hex tails are not commits.
        assert!(status_bar_parse_identity("770f62").is_none());
        assert!(status_bar_parse_identity("feat/x:770f62z").is_none());
    }

    #[test]
    fn status_bar_merges_the_version_display_without_duplicates() {
        // A stamp whose commit the version line already names adds nothing.
        assert_eq!(
            status_bar_merge_version_display("0.1.0", Some("0.1.0")),
            "0.1.0"
        );
        assert_eq!(
            status_bar_merge_version_display("0.1.0 feat/x:770f625", Some("770f625")),
            "0.1.0 feat/x:770f625"
        );
        // The separator generation does not matter: the commit is the identity.
        assert_eq!(
            status_bar_merge_version_display("0.1.0 feat/x::770f625", Some("770f625")),
            "0.1.0 feat/x::770f625"
        );
        // A DIFFERENT commit always stays visible — that drift is the signal.
        assert_eq!(
            status_bar_merge_version_display("0.1.0 770f625", Some("aaa1111")),
            "0.1.0 770f625 aaa1111"
        );
        // Non-git stamp text is deduped case-insensitively.
        assert_eq!(
            status_bar_merge_version_display("0.1.0 edw62q", Some("EDW62Q")),
            "0.1.0 edw62q"
        );
        // A missing/blank stamp adds nothing.
        assert_eq!(status_bar_merge_version_display("0.1.0", None), "0.1.0");
        assert_eq!(
            status_bar_merge_version_display("0.1.0", Some("   ")),
            "0.1.0"
        );
    }

    #[test]
    fn status_bar_tones_follow_the_traffic_light_map() {
        assert_eq!(
            StatusBarConnection::Connected.dot_color(),
            "rgb(var(--color-success))"
        );
        assert_eq!(
            StatusBarConnection::Connecting.dot_color(),
            "rgb(var(--color-warning))"
        );
        assert_eq!(
            StatusBarConnection::Reconnecting.dot_color(),
            "rgb(var(--color-warning))"
        );
        assert_eq!(
            StatusBarConnection::Disconnected.dot_color(),
            "rgb(var(--color-error))"
        );
        assert!(
            StatusBarConnection::Idle
                .dot_color()
                .contains("--color-text-tertiary")
        );

        assert_eq!(status_bar_latency_color(None), "var(--color-muted)");
        assert_eq!(
            status_bar_latency_color(Some(0.0)),
            "rgb(var(--color-success))"
        );
        assert_eq!(
            status_bar_latency_color(Some(29.9)),
            "rgb(var(--color-success))"
        );
        assert_eq!(
            status_bar_latency_color(Some(30.0)),
            "rgb(var(--color-warning))"
        );
        assert_eq!(
            status_bar_latency_color(Some(99.0)),
            "rgb(var(--color-warning))"
        );
        assert_eq!(
            status_bar_latency_color(Some(100.0)),
            "rgb(var(--color-error))"
        );
    }

    #[test]
    fn status_bar_status_texts_match_the_vue_ternary() {
        assert_eq!(status_bar_status_text(StatusBarConnection::Idle), "Ready");
        assert_eq!(
            status_bar_status_text(StatusBarConnection::Connected),
            "Connected"
        );
        assert_eq!(
            status_bar_status_text(StatusBarConnection::Connecting),
            "Connecting..."
        );
        assert_eq!(
            status_bar_status_text(StatusBarConnection::Reconnecting),
            "Connecting..."
        );
        assert_eq!(
            status_bar_status_text(StatusBarConnection::Disconnected),
            "Disconnected"
        );
        assert!(StatusBarConnection::Connecting.is_connecting());
        assert!(StatusBarConnection::Reconnecting.is_connecting());
        assert!(!StatusBarConnection::Connected.is_connecting());
    }

    #[test]
    fn status_bar_tag_classes_and_compact_label_match_vue() {
        assert_eq!(
            status_bar_tag_classes(StatusBarConnection::Connected, false),
            "s-status-bar-tag"
        );
        assert_eq!(
            status_bar_tag_classes(StatusBarConnection::Reconnecting, false),
            "s-status-bar-tag s-status-bar-tag-reconnecting"
        );
        assert_eq!(
            status_bar_tag_classes(StatusBarConnection::Connected, true),
            "s-status-bar-tag s-status-bar-tag-recovered"
        );
        assert_eq!(
            status_bar_tag_classes(StatusBarConnection::Connecting, true),
            "s-status-bar-tag s-status-bar-tag-reconnecting s-status-bar-tag-recovered"
        );

        // Non-compact renders NO aria-label at all.
        assert_eq!(
            status_bar_aria_label(false, StatusBarConnection::Connected, "0.1.0", None),
            None
        );
        assert_eq!(
            status_bar_aria_label(true, StatusBarConnection::Connected, "0.1.0", None).as_deref(),
            Some("Connected · 0.1.0")
        );
        assert_eq!(
            status_bar_aria_label(
                true,
                StatusBarConnection::Idle,
                "0.1.0 770f625",
                Some("1.2.3 aaa1111")
            )
            .as_deref(),
            Some("Ready · 0.1.0 770f625 · 1.2.3 aaa1111")
        );
    }

    #[test]
    fn status_bar_recovery_flash_ignores_the_first_connect() {
        // The FIRST connect of the component's life stays quiet.
        assert_eq!(
            status_bar_recover_flash(StatusBarConnection::Connected, false),
            (false, true)
        );
        // An established link coming back flashes.
        assert_eq!(
            status_bar_recover_flash(StatusBarConnection::Connected, true),
            (true, true)
        );
        // Going down never flashes and keeps the memory.
        assert_eq!(
            status_bar_recover_flash(StatusBarConnection::Disconnected, true),
            (false, true)
        );
        assert_eq!(
            status_bar_recover_flash(StatusBarConnection::Connecting, false),
            (false, false)
        );
    }

    #[test]
    fn status_bar_transport_rows_follow_the_sentinel_tiers() {
        // `none` / `unknown` suppress both rows; everything else shows them.
        assert!(!status_bar_shows_transport(Some("none")));
        assert!(!status_bar_shows_transport(Some("unknown")));
        assert!(status_bar_shows_transport(Some("ws")));
        assert!(status_bar_shows_transport(None));
        // Vue also requires `connectionInfo` to exist: a flattened mirror with no
        // info at all must render NEITHER the protocol nor the network row.
        let html = StatusBar(StatusBarProps {
            popup_open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(
            !html.contains("Protocol") && !html.contains("Network"),
            "no connection info means no transport rows: {html}"
        );
        let html = StatusBar(StatusBarProps {
            has_connection_info: Some(true),
            connection_status: StatusBarConnection::Connected,
            popup_open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains("Protocol") && html.contains("Network"),
            "{html}"
        );

        assert_eq!(status_bar_transport_tier(None), "ws");
        assert_eq!(status_bar_transport_tier(Some("")), "ws");
        assert_eq!(status_bar_transport_tier(Some("http")), "http");

        assert_eq!(
            status_bar_protocol_text(StatusBarConnection::Connected, "ws"),
            "ws"
        );
        assert_eq!(
            status_bar_protocol_text(StatusBarConnection::Connecting, "ws"),
            "Probing..."
        );
        assert_eq!(status_bar_retry_text(2, Some(5)), "Retrying 2 / 5");
        // Vue: `info.maxRetries && info.maxRetries > 0 ? … : 3`.
        assert_eq!(status_bar_retry_text(1, None), "Retrying 1 / 3");
        assert_eq!(status_bar_retry_text(1, Some(0)), "Retrying 1 / 3");
    }

    #[test]
    fn status_bar_network_text_and_region_names_match_vue() {
        // No i18n table is installed in a unit test, so the region renders its
        // raw code (Vue's last fallback).
        assert_eq!(status_bar_region_name("TW"), "TW");
        assert_eq!(status_bar_region_name(""), "");
        assert_eq!(status_bar_network_text("TW", None, false), "TW");
        assert_eq!(
            status_bar_network_text("TW", Some(3462), false),
            "TW · AS3462"
        );
        assert_eq!(status_bar_network_text("TW", None, true), "TW · Local");
        assert_eq!(
            status_bar_network_text("TW", Some(3462), true),
            "TW · AS3462 · Local"
        );
        assert_eq!(status_bar_network_text("", None, false), "");
    }

    #[test]
    fn status_bar_quality_glyphs_follow_the_vue_branches() {
        assert_eq!(
            status_bar_quality_icon(Some("excellent"), false, StatusBarConnection::Connected),
            MdiIcon::Pulse
        );
        assert_eq!(
            status_bar_quality_icon(Some("fair"), false, StatusBarConnection::Connected),
            MdiIcon::Pulse
        );
        assert_eq!(
            status_bar_quality_icon(Some("unknown"), false, StatusBarConnection::Connected),
            MdiIcon::Help
        );
        // The default probe branch: connected reads as a live link, otherwise
        // as unknown.
        assert_eq!(
            status_bar_quality_icon(None, false, StatusBarConnection::Connected),
            MdiIcon::Pulse
        );
        assert_eq!(
            status_bar_quality_icon(None, false, StatusBarConnection::Disconnected),
            MdiIcon::Help
        );
        // A local panel is always the local glyph.
        assert_eq!(
            status_bar_quality_icon(Some("good"), true, StatusBarConnection::Connected),
            MdiIcon::Home
        );
        assert_eq!(
            status_bar_quality_icon(Some("poor"), false, StatusBarConnection::Connected),
            MdiIcon::Alert
        );
    }

    #[test]
    fn status_bar_renders_the_standalone_footer() {
        let html = StatusBar(StatusBarProps::default()).render_to_html();
        for needle in [
            "class=\"s-status-bar\"",
            "class=\"s-status-bar-tag\"",
            "role=\"button\"",
            "tabindex=\"0\"",
            "class=\"s-status-bar-dot\"",
            "background:rgb(var(--color-error))",
            "class=\"s-status-bar-tag-value\"",
            "Panel",
            "s-status-bar-version",
            "s-status-bar-version__static",
            "0.1.0",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Not compact: no `data-compact` marker and no aria-label.
        assert!(!html.contains("data-compact"), "{html}");
        assert!(!html.contains("aria-label"), "{html}");
        // No engine version: the engine rows are absent everywhere.
        assert!(!html.contains("Engine"), "{html}");
        // Closed popover: no details card.
        assert!(!html.contains("data-status-bar-card"), "{html}");
    }

    #[test]
    fn status_bar_compact_and_engine_rows_render() {
        let html = StatusBar(StatusBarProps {
            version: "0.1.0 770f625".to_string(),
            panel_build_hash: Some("770f625".to_string()),
            engine_version: Some("1.2.3 aaa1111".to_string()),
            engine_build_hash: Some("aaa1111".to_string()),
            compact: true,
            recovered: true,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "data-compact=\"true\"",
            "s-status-bar-tag-recovered",
            "aria-label=\"Disconnected · 0.1.0 770f625 · 1.2.3 aaa1111\"",
            "Engine",
            "1.2.3 aaa1111",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The merge is dedupe-safe: the stamp adds no fourth token.
        assert!(
            !html.contains("0.1.0 770f625 770f625"),
            "the stamp must not duplicate the commit: {html}"
        );
    }

    #[test]
    fn status_bar_renders_the_details_card() {
        let html = StatusBar(StatusBarProps {
            connection_status: StatusBarConnection::Reconnecting,
            quality: Some("good".to_string()),
            latency_ms: Some(42.0),
            transport_tier: Some("ws".to_string()),
            attempt_number: Some(2),
            max_retries: Some(5),
            countdown: Some(3.0),
            region: Some("TW".to_string()),
            asn: Some(3462),
            popup_open: true,
            extra_details: vec![StatusBarExtraDetail {
                key: "gateway".to_string(),
                icon: None,
                label: "Gateway".to_string(),
                value: "gw.example.test".to_string(),
            }],
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "data-status-bar-card",
            "hk-popover",
            "Connecting...",
            "42 ms",
            "Retrying 2 / 5",
            "hk-countdown-digit",
            "Protocol",
            "Network",
            "TW · AS3462",
            "data-extra-detail=\"gateway\"",
            "gw.example.test",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // `data-status-actions` only renders when the host passed actions.
        assert!(!html.contains("data-status-actions"), "{html}");
        // The sentinel `none` tier is not in play here, so both rows show.
        assert!(html.contains("s-status-bar-popover-value"), "{html}");
    }

    #[test]
    fn status_bar_hides_the_transport_rows_for_a_local_panel() {
        let html = StatusBar(StatusBarProps {
            connection_status: StatusBarConnection::Connected,
            transport_tier: Some("none".to_string()),
            is_localhost: true,
            popup_open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("Protocol"), "{html}");
        assert!(!html.contains("Network"), "{html}");
        // The version rows and the definite heading survive.
        assert!(html.contains("Connected"), "{html}");
        assert!(html.contains("Panel"), "{html}");
    }

    #[test]
    fn status_bar_retry_hint_replaces_the_missing_actions() {
        // Disconnected + no actions → the click-to-retry row.
        let html = StatusBar(StatusBarProps {
            popup_open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("Click to retry"), "{html}");

        // With actions the cluster owns the recovery, so the hint disappears.
        let html = StatusBar(StatusBarProps {
            popup_open: true,
            actions: Some(rsx! { button { "Refresh" } }),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("Click to retry"), "{html}");
        assert!(html.contains("data-status-actions"), "{html}");
        assert!(html.contains("Refresh"), "{html}");
    }

    #[test]
    fn status_bar_non_standalone_renders_the_tag_alone() {
        let html = StatusBar(StatusBarProps {
            standalone: false,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("s-status-bar-tag"), "{html}");
        assert!(!html.contains("<footer"), "{html}");
        assert!(!html.contains("class=\"s-status-bar\""), "{html}");
    }

    #[test]
    fn status_bar_has_no_sheet_of_its_own() {
        assert_eq!(
            <StatusBarComponent as StyledComponent>::styles(),
            "",
            "the Vue pill ships no sheet; the mirror must invent none"
        );
        assert_eq!(
            <StatusBarComponent as StyledComponent>::name(),
            "status-bar"
        );
    }
}
