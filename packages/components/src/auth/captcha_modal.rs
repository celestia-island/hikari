// hi-components/src/auth/captcha_modal.rs
// CaptchaModal — mirror of the canonical Vue `HkCaptchaModal`: the modal host
// for the captcha widget (upstreamed from shittim-chest's plana-legacy layer).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkCaptchaModal.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `s-captcha-modal*` class names are literal and
// identical in both forms. The frame is the ALREADY-MIRRORED `feedback::Modal`
// (`hk-modal*`, its own sheet), exactly like Vue hosts this in `HkModal`.
// DOM contract (mirrors the Vue render output):
//
//   div.hk-modal-root                               (the Modal frame contract)
//     div.hk-modal-overlay
//     div.hk-modal-content role="dialog" aria-modal="true"
//         aria-label="{title}" style="max-width:min(<width>, …)"
//       div.hk-modal-header
//         h2.hk-modal-title "{title}"
//         button.hk-window-close.hk-modal-close      (closable)
//       div.hk-modal-body
//         div.hk-modal-body-scroll.hk-scroll-pin-host
//           div.hk-modal-body-inner
//             div.s-captcha-modal data-state="{state}"
//               p.s-captcha-modal-prompt "{prompt}"
//               ── the CaptchaWidget (see auth/captcha_widget.rs) ──
//               <children slot>                      ([D4] host content)
//
// The pure layer: `captcha_modal_title` (Vue's `title ?? t(captcha.title)`),
// `captcha_modal_prompt`, `captcha_modal_state_token` and
// `captcha_modal_widget_props` (the whole prop forwarding contract, so the
// hand-off to the widget is testable without a DOM). The `.s-captcha-modal`
// shell hook is a literal, like the wave's other `.s-*` wrappers: Vue's
// fallthrough class lands on `HkModal`'s root, not on this inner wrapper.
//
// State (L48): controlled only — `open` is the host's (Vue: `modelValue`), and
// the modal owns no signal, no thread_local and no timer.
//
// Deltas vs Vue (documented, not accidental):
//   [D1] NO PROVIDER SCRIPT / IFRAME — inherited from the widget mirror: the
//     modal forwards the host's challenge list instead of `siteKey` +
//     `scriptUrl` to a provider, and `scriptUrl` is not part of this surface.
//   [D2] `update:modelValue` becomes `on_open_change(bool)`: the modal never
//     opens itself, so Vue's two-way emit reduces to the close direction — the
//     ✕, the overlay click and Esc all publish `false` (the same convention as
//     the wave's `overlay/protocol_modal.rs`). The host owns `open`.
//   [D3] The `verify` / `error` EMITS ARE GONE. Vue's widget emits them out of
//     the provider callback, and the modal forwards `verify` while closing
//     itself on `error`. With no provider inside the widget (see
//     `auth/captcha_widget.rs` [D1]), those emits have no source: the host owns
//     the answer path and closes the modal itself when it decides the attempt
//     failed. The self-close-on-error behaviour therefore lives in the host,
//     not here.
//   [D4] The host CONTENT slot (`children`) renders after the prompt + widget,
//     inside `.s-captcha-modal`. Vue's answer UI lives inside the provider
//     iframe, so its modal renders nothing there; the Rust form needs a channel
//     for the host's input / submit button, and this is it.
//   [D5] `.s-captcha-modal` publishes the widget's visual state as
//     `data-state` so the modal chrome can react to it; Vue has no such
//     attribute.
//   [D6] No `<Teleport>`, no leave transition, no focus trap — the mirrored
//     Modal's own documented deltas (the surface renders in place with
//     `position: fixed`).
//   [D7] i18n keys read `components.hk.captcha.title` /
//     `components.hk.captcha.prompt` through `hikari_i18n::t`; Vue reads
//     `hikari::captcha.title` / `.prompt` with the same English fallbacks, so
//     the English DOM is identical. The keys are NEW (wave receipt).

use hikari_i18n::t;

use crate::auth::captcha_widget::{
    CaptchaChallenge, CaptchaProvider, CaptchaState, CaptchaWidget, CaptchaWidgetProps,
};
use crate::feedback::Modal;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct CaptchaModalComponent;

/// Vue's `title ?? t("hikari::captcha.title", "Security check")` — nullish, not
/// truthiness, so an explicit empty title stays empty.
pub fn captcha_modal_title(title: Option<&str>) -> String {
    match title {
        Some(title) => title.to_string(),
        None => t("components.hk.captcha.title", "Security check"),
    }
}

/// Vue's prompt line (`hikari::captcha.prompt`).
pub fn captcha_modal_prompt() -> String {
    t(
        "components.hk.captcha.prompt",
        "Complete the verification below to continue",
    )
}

/// The `data-state` token the modal publishes ([D5]): the widget's state.
pub fn captcha_modal_state_token(state: CaptchaState) -> &'static str {
    state.token()
}

/// The widget props this modal hands down ([D1], [D4] is the modal's own slot).
/// Pure so the forwarding contract is testable without a DOM.
pub fn captcha_modal_widget_props(
    site_key: &str,
    provider: CaptchaProvider,
    attempt: u32,
    challenges: &[CaptchaChallenge],
    state: CaptchaState,
    challenge_content: Option<Element>,
) -> CaptchaWidgetProps {
    CaptchaWidgetProps {
        site_key: site_key.to_string(),
        provider,
        attempt,
        // Vue's modal never forwards `disabled`; the widget keeps its default.
        disabled: false,
        challenges: challenges.to_vec(),
        state,
        challenge_content,
        class: String::new(),
    }
}

// ── props ────────────────────────────────────────────────────────────────

#[define_props]
pub struct CaptchaModalProps {
    /// Controlled open state (Vue: `modelValue`).
    #[default]
    pub open: bool,

    /// Header title; unset falls back to the catalog's "Security check"
    /// (Vue: `title ?? t(...)`).
    pub title: Option<String>,

    /// Named preset (`xs`…`xl`) or any CSS max-width (Vue's `HkCaptchaModal`
    /// default is `30rem`).
    #[default("30rem".to_string())]
    pub width: String,

    /// Forwarded to the widget (Vue: `siteKey`).
    #[default]
    pub site_key: String,

    /// Forwarded to the widget (Vue: `provider`).
    #[default]
    pub provider: CaptchaProvider,

    /// Forwarded to the widget: bumping it rotates the challenge ([D3] of the
    /// widget mirror).
    #[default]
    pub attempt: u32,

    /// Forwarded to the widget: the host's challenge list.
    pub challenges: Vec<CaptchaChallenge>,

    /// Forwarded to the widget: the controlled visual state.
    #[default]
    pub state: CaptchaState,

    /// Forwarded to the widget: a host-painted challenge that wins over
    /// `challenges`.
    pub challenge_content: Option<Element>,

    /// Host content rendered inside `.s-captcha-modal` after the widget
    /// ([D4]): the answer field / submit button the provider iframe used to
    /// own.
    pub children: Element,

    /// Fired with the requested open state (Vue: `update:modelValue`); the
    /// modal only ever requests `false` (✕, overlay click or Esc), and the host
    /// owns `open`.
    pub on_open_change: Option<EventHandler<bool>>,
}

// ── the component ────────────────────────────────────────────────────────

#[component]
pub fn CaptchaModal(props: CaptchaModalProps) -> Element {
    // Vue renders the whole surface only while open (its widget is gated on
    // `modelValue` as well); the mirrored Modal already renders nothing there.
    if !props.open {
        return empty_vnode();
    }

    let title = captcha_modal_title(props.title.as_deref());
    let prompt = captcha_modal_prompt();
    let state_token = captcha_modal_state_token(props.state);

    let widget_props = captcha_modal_widget_props(
        &props.site_key,
        props.provider,
        props.attempt,
        &props.challenges,
        props.state,
        props.challenge_content.clone(),
    );

    let children = props.children.clone();
    let width = props.width.clone();
    let on_open_change = props.on_open_change.clone();
    let on_close = Some(event_handler(move |_event: MouseEvent| {
        if let Some(handler) = on_open_change.as_ref() {
            handler.call(false);
        }
    }));
    rsx! {
        Modal {
            open: true,
            title: Some(title),
            width: width,
            on_close: on_close,
            children: rsx! {
                div {
                    class: "s-captcha-modal",
                    "data-state": state_token,
                    p { class: "s-captcha-modal-prompt",
                        "{prompt}"
                    }
                    {CaptchaWidget(widget_props)}
                    {children}
                }
            },
        }
    }
}

impl StyledComponent for CaptchaModalComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `s-captcha-modal*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkCaptchaModal.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "captcha-modal"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// True when a slot carries nothing to render (the props default).
    fn slot_is_empty(node: &VNode) -> bool {
        match node {
            VNode::Fragment(nodes) => nodes.iter().all(slot_is_empty),
            VNode::Text(text) => text.text.is_empty(),
            VNode::Element(_) | VNode::DynamicText(_) => false,
        }
    }

    // ── the pure layer ───────────────────────────────────────────────────

    #[test]
    fn captcha_modal_title_matches_the_vue_nullish_coalescing() {
        // Unset: the catalog default.
        assert_eq!(captcha_modal_title(None), "Security check");
        // An explicit title always wins…
        assert_eq!(captcha_modal_title(Some("Human check")), "Human check");
        // …including an empty one (`??` is not a truthiness test).
        assert_eq!(captcha_modal_title(Some("")), "");
        assert_eq!(
            captcha_modal_prompt(),
            "Complete the verification below to continue"
        );
    }

    #[test]
    fn captcha_modal_state_tokens_match_the_widget() {
        assert_eq!(captcha_modal_state_token(CaptchaState::Idle), "idle");
        assert_eq!(captcha_modal_state_token(CaptchaState::Loading), "loading");
        assert_eq!(
            captcha_modal_state_token(CaptchaState::Verified),
            "verified"
        );
        assert_eq!(captcha_modal_state_token(CaptchaState::Error), "error");
    }

    #[test]
    fn captcha_modal_widget_props_forward_the_whole_surface() {
        let challenges = vec![CaptchaChallenge::new("AB", 1)];
        let props = captcha_modal_widget_props(
            "site-key",
            CaptchaProvider::Recaptcha,
            2,
            &challenges,
            CaptchaState::Loading,
            None,
        );
        assert_eq!(props.site_key, "site-key");
        assert_eq!(props.provider, CaptchaProvider::Recaptcha);
        assert_eq!(props.attempt, 2);
        // Vue's modal never forwards `disabled`.
        assert!(!props.disabled);
        assert_eq!(props.challenges, challenges);
        assert_eq!(props.state, CaptchaState::Loading);
        assert!(props.challenge_content.is_none());
        // The modal's own class never leaks onto the widget root.
        assert_eq!(props.class, "");
    }

    // ── the DOM contract ─────────────────────────────────────────────────

    #[test]
    fn captcha_modal_props_default_matches_the_vue_props() {
        let props = CaptchaModalProps::default();
        assert!(!props.open);
        assert_eq!(props.title, None);
        // Vue's HkCaptchaModal default width.
        assert_eq!(props.width, "30rem");
        assert_eq!(props.site_key, "");
        assert_eq!(props.provider, CaptchaProvider::Turnstile);
        assert_eq!(props.attempt, 0);
        assert!(props.challenges.is_empty());
        assert_eq!(props.state, CaptchaState::Idle);
        assert!(props.challenge_content.is_none());
        assert!(slot_is_empty(&props.children));
        assert!(props.on_open_change.is_none());
    }

    #[test]
    fn captcha_modal_renders_nothing_while_closed() {
        let html = CaptchaModal(CaptchaModalProps::default()).render_to_html();
        assert!(html.is_empty(), "a closed modal renders nothing: {html}");
    }

    #[test]
    fn captcha_modal_renders_the_vue_shell() {
        let html = CaptchaModal(CaptchaModalProps {
            open: true,
            site_key: "site-key".to_string(),
            challenges: vec![CaptchaChallenge::new("7FK2", 5)],
            children: rsx! {
                input { class: "host-answer" }
            },
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            // The mirrored Modal frame.
            r#"class="hk-modal-root""#,
            r#"class="hk-modal-overlay""#,
            r#"role="dialog""#,
            r#"aria-modal="true""#,
            r#"max-width:min(30rem"#,
            // The captcha body contract.
            r#"class="hk-modal-body-inner""#,
            r#"class="s-captcha-modal""#,
            r#"data-state="idle""#,
            r#"class="s-captcha-modal-prompt""#,
            "Complete the verification below to continue",
            // The default title plus the widget's host box.
            "hk-modal-title",
            "Security check",
            r#"class="s-captcha-widget""#,
            "s-captcha-widget-host",
            "s-captcha-challenge",
            // The host content slot ([D4]).
            r#"class="host-answer""#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The prompt comes before the widget, and the host slot after it.
        let prompt_at = html.find("s-captcha-modal-prompt").expect("prompt");
        let widget_at = html.find("s-captcha-widget").expect("widget");
        let slot_at = html.find("host-answer").expect("slot");
        assert!(prompt_at < widget_at, "{html}");
        assert!(widget_at < slot_at, "{html}");
    }

    #[test]
    fn captcha_modal_renders_the_placeholder_and_error_arms() {
        // No site key: the widget falls into its no-op placeholder box, and the
        // modal still publishes its own state marker.
        let placeholder = CaptchaModal(CaptchaModalProps {
            open: true,
            state: CaptchaState::Error,
            title: Some("Human check".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            r#"class="s-captcha-modal""#,
            r#"data-state="error""#,
            "s-captcha-widget-placeholder",
            "Verification is not configured for this deployment",
            "Human check",
        ] {
            assert!(
                placeholder.contains(needle),
                "missing {needle}: {placeholder}"
            );
        }
        // The custom title replaces the default one.
        assert!(!placeholder.contains("Security check"), "{placeholder}");
        // A loading widget inside an open modal.
        let loading = CaptchaModal(CaptchaModalProps {
            open: true,
            site_key: "site-key".to_string(),
            state: CaptchaState::Loading,
            ..Default::default()
        })
        .render_to_html();
        assert!(loading.contains("s-captcha-widget-loading"), "{loading}");
        assert!(
            loading.contains("Loading verification widget…"),
            "{loading}"
        );
        assert!(loading.contains(r#"data-state="loading""#), "{loading}");
    }

    #[test]
    fn captcha_modal_styles_come_from_the_canonical_vue_sheet() {
        let css = CaptchaModalComponent::styles();
        for needle in [".s-captcha-modal", ".s-captcha-modal-prompt", "gap"] {
            assert!(
                css.contains(needle),
                "captcha modal css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored captcha modal sheet"
        );
    }
}
