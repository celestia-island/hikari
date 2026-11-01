// packages/components/src/layout/status_pill.rs
// StatusPill — mirror of the canonical Vue `HkStatusPill` (the compact health
// indicator for hub connections, edge nodes and stations).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkStatusPill.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so every
// `.hk-status-pill*` class name and the `hk-status-pill-pulse` keyframes are
// literal and identical in both forms.
//
// DOM contract (mirrors Vue's render output one-to-one):
//
//   span.hk-status-pill.hk-status-pill-{state}[role="status"]
//     span.hk-status-pill-dot[aria-hidden="true"]        (the pulsing dot)
//     span.hk-status-pill-label?                         (`label` non-empty)
//     span.hk-status-pill-latency?                       (`latencyMs` present)
//     span.hk-status-pill-version?                       (`version` non-empty)
//
// Vue prop mapping: `state` → [`StatusPillState`] (default `unknown`),
// `label` / `version` are plain strings whose EMPTY value is Vue's `undefined`
// (both are tested for truthiness before rendering), `latencyMs` → `f64`
// behind an `Option` because Vue's gate is `!= null`: `0 ms` IS a reading and
// renders, an absent reading renders nothing.
//
// State contract: the pill is STATELESS. The dot colour, the `ok` pulse and
// its reduced-motion opt-out are pure CSS over the state class, so no local
// state, no thread-local registry, no DOM write (the tairitsu 0.5.22
// `use_signal` / `use_state` limits — ledger L48 — never come into play).
//
// Deltas vs Vue (documented, not accidental):
//   * The latency's unit rides the i18n table
//     (`components.hk.statusPill.ms`, English `" ms"`) instead of Vue's
//     `hikari::statusPill.ms`; the fallback keeps the leading space Vue's
//     default carries, because the number and the unit share one span.
//   * `latencyMs` is `Option<f64>`: Vue types it `Number` with
//     `default: undefined`, which a Rust `f64` cannot spell (`0.0` would be
//     indistinguishable from "unknown").
//   * No `class` prop: Vue's root class list is entirely state-derived, so a
//     host class would have no fallthrough target of its own. Add one together
//     with a real consumer that needs it.

use hikari_i18n::t;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct StatusPillComponent;

/// The four health states (Vue: `PillState`, default `unknown`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StatusPillState {
    Ok,
    Warn,
    Error,
    #[default]
    Unknown,
}

impl StatusPillState {
    /// The state token exactly as Vue declares it.
    pub fn name(self) -> &'static str {
        match self {
            StatusPillState::Ok => "ok",
            StatusPillState::Warn => "warn",
            StatusPillState::Error => "error",
            StatusPillState::Unknown => "unknown",
        }
    }

    /// The `hk-status-pill-{state}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            StatusPillState::Ok => "hk-status-pill-ok",
            StatusPillState::Warn => "hk-status-pill-warn",
            StatusPillState::Error => "hk-status-pill-error",
            StatusPillState::Unknown => "hk-status-pill-unknown",
        }
    }
}

/// The root class list: `.hk-status-pill` plus the state modifier.
pub fn status_pill_classes(state: StatusPillState) -> String {
    format!("hk-status-pill {}", state.class_name())
}

/// Vue's truthiness gates on `label` / `version`: an empty string renders
/// nothing, any content renders the span.
pub fn status_pill_text_visible(text: &str) -> bool {
    !text.is_empty()
}

/// JS number → string for the latency readout (`34` stays `34`, not `34.0`).
/// Rust's shortest-round-trip `Display` for `f64` already prints `34`, and a
/// zero reading prints `0` whichever way its sign bit points (JS prints `0` for
/// `-0` too); the helper exists so the contract is ASSERTED, not assumed.
pub fn status_pill_number(value: f64) -> String {
    if value == 0.0 {
        return "0".to_string();
    }
    format!("{value}")
}

/// Vue's latency readout: `None` when `latencyMs` is null/undefined, and
/// `"{n}{t(" ms")}"` otherwise. `0.0` renders (`0 ms`) exactly like Vue's
/// `props.latencyMs != null` gate.
pub fn status_pill_latency_text(latency_ms: Option<f64>) -> Option<String> {
    latency_ms.map(|ms| {
        format!(
            "{}{}",
            status_pill_number(ms),
            t("components.hk.statusPill.ms", " ms")
        )
    })
}

#[define_props]
pub struct StatusPillProps {
    /// The health state (Vue default `unknown`).
    #[default]
    pub state: StatusPillState,

    /// Text beside the dot (Vue default `""`; empty renders no label span).
    #[default]
    pub label: String,

    /// Round-trip latency in milliseconds; `None` = unknown (Vue: `undefined`).
    pub latency_ms: Option<f64>,

    /// Service version string; empty = unknown (Vue: `undefined`).
    #[default]
    pub version: String,
}

#[component]
pub fn StatusPill(props: StatusPillProps) -> Element {
    let mut pill = VElement::new("span")
        .class(status_pill_classes(props.state))
        .attr("role", "status")
        .child(rsx! {
            span { class: "hk-status-pill-dot", "aria-hidden": "true" }
        });

    if status_pill_text_visible(&props.label) {
        pill = pill.child(rsx! {
            span { class: "hk-status-pill-label", {props.label.clone()} }
        });
    }
    if let Some(latency) = status_pill_latency_text(props.latency_ms) {
        pill = pill.child(rsx! {
            span { class: "hk-status-pill-latency", {latency} }
        });
    }
    if status_pill_text_visible(&props.version) {
        pill = pill.child(rsx! {
            span { class: "hk-status-pill-version", {props.version.clone()} }
        });
    }

    VNode::Element(Box::new(pill))
}

impl StyledComponent for StatusPillComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkStatusPill.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "status-pill"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_pill_defaults_match_the_vue_props() {
        let props = StatusPillProps::default();
        assert_eq!(props.state, StatusPillState::Unknown);
        assert_eq!(props.label, "");
        assert!(props.latency_ms.is_none());
        assert_eq!(props.version, "");
    }

    #[test]
    fn status_pill_states_match_the_vue_union() {
        for (state, name, class) in [
            (StatusPillState::Ok, "ok", "hk-status-pill-ok"),
            (StatusPillState::Warn, "warn", "hk-status-pill-warn"),
            (StatusPillState::Error, "error", "hk-status-pill-error"),
            (
                StatusPillState::Unknown,
                "unknown",
                "hk-status-pill-unknown",
            ),
        ] {
            assert_eq!(state.name(), name);
            assert_eq!(state.class_name(), class);
            assert_eq!(
                status_pill_classes(state),
                format!("hk-status-pill {class}")
            );
        }
    }

    #[test]
    fn status_pill_latency_gate_matches_the_vue_null_check() {
        // The unit fallback (" ms") comes from the sheet-agnostic i18n table.
        assert_eq!(status_pill_latency_text(None), None);
        assert_eq!(status_pill_latency_text(Some(0.0)).as_deref(), Some("0 ms"));
        assert_eq!(
            status_pill_latency_text(Some(34.0)).as_deref(),
            Some("34 ms")
        );
        assert_eq!(
            status_pill_latency_text(Some(12.5)).as_deref(),
            Some("12.5 ms")
        );
    }

    #[test]
    fn status_pill_number_formats_like_js_number_to_string() {
        // An integral reading drops the fraction, a fractional one keeps it —
        // JS `Number#toString` behaviour, not `{:.1}` rounding.
        assert_eq!(status_pill_number(34.0), "34");
        assert_eq!(status_pill_number(0.0), "0");
        // `-0` prints `0` (JS does the same); a signed zero is never a reading.
        assert_eq!(status_pill_number(-0.0), "0");
        assert_eq!(status_pill_number(12.25), "12.25");
        assert_eq!(status_pill_number(0.5), "0.5");
        // The composed readout uses it verbatim.
        assert_eq!(status_pill_number(120.0), "120");
    }

    #[test]
    fn status_pill_text_gates_match_the_vue_truthiness() {
        assert!(!status_pill_text_visible(""));
        assert!(status_pill_text_visible("online"));
        assert!(status_pill_text_visible(" "));
    }

    #[test]
    fn status_pill_renders_the_vue_dom_contract() {
        let html = StatusPill(StatusPillProps {
            state: StatusPillState::Ok,
            label: "hub".to_string(),
            latency_ms: Some(34.0),
            version: "0.5.22".to_string(),
        })
        .render_to_html();

        assert!(
            html.contains(r#"class="hk-status-pill hk-status-pill-ok""#),
            "{html}"
        );
        assert!(html.contains(r#"role="status""#), "{html}");
        // The dot is the first child and stays out of the a11y tree
        // (`write_html` emits attributes before the class list).
        assert!(
            html.contains(r#"<span aria-hidden="true" class="hk-status-pill-dot">"#),
            "{html}"
        );
        let dot = html.find("hk-status-pill-dot").expect("dot");
        let label = html.find("hk-status-pill-label").expect("label");
        let latency = html.find("hk-status-pill-latency").expect("latency");
        let version = html.find("hk-status-pill-version").expect("version");
        assert!(
            dot < label && label < latency && latency < version,
            "{html}"
        );
        assert!(html.contains(">hub<"), "{html}");
        assert!(html.contains(">34 ms<"), "{html}");
        assert!(html.contains(">0.5.22<"), "{html}");
    }

    #[test]
    fn status_pill_omits_the_unknown_readouts() {
        // The bare pill: dot + role only — Vue's three truthiness gates.
        let html = StatusPill(StatusPillProps {
            state: StatusPillState::Unknown,
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains(r#"class="hk-status-pill hk-status-pill-unknown""#),
            "{html}"
        );
        assert!(html.contains("hk-status-pill-dot"), "{html}");
        assert!(!html.contains("hk-status-pill-label"), "{html}");
        assert!(!html.contains("hk-status-pill-latency"), "{html}");
        assert!(!html.contains("hk-status-pill-version"), "{html}");

        // A zero reading is a reading: it renders while version stays absent.
        let html = StatusPill(StatusPillProps {
            latency_ms: Some(0.0),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(">0 ms<"), "{html}");
    }

    #[test]
    fn status_pill_styles_come_from_the_canonical_vue_sheet() {
        let css = StatusPillComponent::styles();
        for needle in [
            ".hk-status-pill",
            "hk-status-pill-dot",
            "hk-status-pill-label",
            "hk-status-pill-latency",
            "hk-status-pill-version",
            "hk-status-pill-pulse",
            "prefers-reduced-motion",
        ] {
            assert!(
                css.contains(needle),
                "status-pill css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored status-pill sheet"
        );
    }
}
