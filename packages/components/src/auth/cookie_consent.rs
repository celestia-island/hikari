// hi-components/src/auth/cookie_consent.rs
// CookieConsent — mirror of the canonical Vue `HkCookieConsent`: the GDPR
// cookie notice (upstreamed from shittim-chest's plana-legacy layer).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkCookieConsent.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the three
// `.s-cookie-consent*` class names are literal and identical in both forms.
// DOM contract (mirrors the Vue render output):
//
//   span.s-cookie-consent                          (the notice; `Notice` mode)
//     "{text}"                                     (Vue's bare text child)
//     button.s-cookie-consent-ok [data-action=reject]
//     button.s-cookie-consent-ok [data-action=accept]      ← Vue's only verb
//     button.s-cookie-consent-ok [data-action=customize]?  (when wired)
//
//   span[style="display:contents"]                 (`Accepted` mode)
//     > svg.lucide.s-cookie-consent-icon           (the acknowledgment glyph)
//
//   (nothing at all)                               (`Hidden` mode)
//
// The component is CONTROLLED: Vue reads `localStorage` on mount, guesses the
// timezone and owns `accepted` / `show` internally; the mirror renders from the
// `visible` / `accepted` props and reports every choice through a callback, so
// the host owns storage, the Europe gate and the policy decision. That is the
// one structural change (see the deltas), and it is what makes the notice
// testable without a browser.
//
// Prop mapping: `modelValue`-less state → [`CookieConsentProps::visible`] +
// [`CookieConsentProps::accepted`], the accept press → `on_accept`
// ([`CookieConsentAction::Accept`]); `reject` / `customize` are the wave's
// additions the sheet's single text-action voice already covers (see below),
// plus per-action label overrides for hosts that localize the copy themselves.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * **the localStorage / `Intl.DateTimeFormat` self-gating is the host's.**
//     Vue stores `hikari-cookies-accepted` and only mounts inside a
//     `Europe/*` timezone; a tairitsu component body has no per-instance state
//     (and no storage/timezone op), so `visible` / `accepted` arrive as props
//     and the host persists the choice. The accepted marker is the same glyph.
//   * **`reject` and `customize` are new actions.** Vue ships the accept verb
//     only; the sheet defines exactly ONE text-action voice
//     (`.s-cookie-consent-ok` — transparent, primary ink, semibold), so all
//     three verbs wear it and are told apart by `data-action`. No new class
//     is invented: an unstyled `-reject` button would be an invisible control.
//   * the customize action renders ONLY when the host wires `on_customize`
//     (a preferences dialog is host-side); accept and reject always render,
//     because a consent banner without a refusal path is not a consent banner.
//   * the notice text and the labels default to the crate bundle
//     (`components.hk.cookieConsent.*`, Vue's English defaults) and every one
//     of them can be overridden by prop.
//   * the accepted glyph is lucide `cookie` mounted through
//     `dangerous_inner_html` on a `display:contents` host — the crate-wide SVG
//     rule (an rsx `svg {}` child lands in the HTML namespace) — with the
//     sheet class ON the `<svg>` itself, exactly as Vue renders it
//     (`<Cookie size={12} class="s-cookie-consent-icon" />`), so the sheet's
//     `color` / `opacity` / `cursor` land on a real box.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct CookieConsentComponent;

/// What the notice renders this paint (`Hidden` → nothing, `Accepted` → the
/// acknowledgment glyph, `Notice` → the bar).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum CookieConsentMode {
    /// Neither visible nor accepted: Vue returns `null`.
    #[default]
    Hidden,
    /// The notice with its actions.
    Notice,
    /// The post-choice marker.
    Accepted,
}

/// Vue's render gate as a pure value: accepted wins over visible (the Vue
/// component returns the glyph before it looks at `show`), so a host that
/// forgets to clear `visible` still collapses to the marker.
pub fn cookie_consent_mode(visible: bool, accepted: bool) -> CookieConsentMode {
    if accepted {
        CookieConsentMode::Accepted
    } else if visible {
        CookieConsentMode::Notice
    } else {
        CookieConsentMode::Hidden
    }
}

impl CookieConsentMode {
    /// Whether the notice bar renders.
    pub fn shows_notice(self) -> bool {
        matches!(self, CookieConsentMode::Notice)
    }

    /// Whether the acknowledgment glyph renders.
    pub fn shows_marker(self) -> bool {
        matches!(self, CookieConsentMode::Accepted)
    }

    /// Whether the component renders nothing at all.
    pub fn is_hidden(self) -> bool {
        matches!(self, CookieConsentMode::Hidden)
    }
}

/// The sheet's class names, spelled once (Vue inlines them at the call site).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum CookieConsentClass {
    /// The notice bar.
    Notice,
    /// The text-action voice (every verb wears it).
    Action,
    /// The post-choice glyph.
    Icon,
}

impl CookieConsentClass {
    /// The class exactly as the Vue sheet spells it.
    pub fn class_name(self) -> &'static str {
        match self {
            CookieConsentClass::Notice => "s-cookie-consent",
            CookieConsentClass::Action => "s-cookie-consent-ok",
            CookieConsentClass::Icon => "s-cookie-consent-icon",
        }
    }
}

/// The notice's three verbs (Vue ships [`CookieConsentAction::Accept`] only).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum CookieConsentAction {
    /// Store the consent.
    Accept,
    /// Refuse the optional categories.
    Reject,
    /// Open the host's preferences dialog.
    Customize,
}

impl CookieConsentAction {
    /// The `data-action` token that tells the three identical buttons apart.
    pub fn data_action(self) -> &'static str {
        match self {
            CookieConsentAction::Accept => "accept",
            CookieConsentAction::Reject => "reject",
            CookieConsentAction::Customize => "customize",
        }
    }

    /// The bundle key of this verb's label.
    pub fn label_key(self) -> &'static str {
        match self {
            CookieConsentAction::Accept => "components.hk.cookieConsent.accept",
            CookieConsentAction::Reject => "components.hk.cookieConsent.reject",
            CookieConsentAction::Customize => "components.hk.cookieConsent.customize",
        }
    }

    /// The English default of [`CookieConsentAction::label_key`] (Vue's
    /// accept verb is literally "OK").
    pub fn fallback(self) -> &'static str {
        match self {
            CookieConsentAction::Accept => "OK",
            CookieConsentAction::Reject => "Reject",
            CookieConsentAction::Customize => "Customize",
        }
    }
}

/// A verb's visible label: the host override when it has one, else the bundle.
pub fn cookie_consent_action_label(action: CookieConsentAction, label: Option<&str>) -> String {
    match label {
        Some(label) => label.to_string(),
        None => hikari_i18n::t(action.label_key(), action.fallback()),
    }
}

/// The notice text: the host override when set, else the bundle's copy (Vue:
/// `t("hikari::cookie.text", "This site uses cookies")`).
pub fn cookie_consent_text(text: Option<&str>) -> String {
    match text {
        Some(text) => text.to_string(),
        None => hikari_i18n::t("components.hk.cookieConsent.text", "This site uses cookies"),
    }
}

/// The customize verb exists only while the host wires its callback (the
/// preferences surface is host-side) — an unwired button would be dead.
pub fn cookie_consent_shows_customize(wired: bool) -> bool {
    wired
}

/// lucide `cookie` at the 12px the Vue component passes, with the sheet's class
/// on the `<svg>`; static trusted markup (see the header note).
const COOKIE_CONSENT_COOKIE_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide s-cookie-consent-icon lucide-cookie-icon lucide-cookie" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/></svg>"#;

/// The acknowledgment marker on its paint-inert host (`dangerous_inner_html`
/// suppresses an element's own children, hence the dedicated host).
fn cookie_consent_marker() -> Element {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: COOKIE_CONSENT_COOKIE_SVG,
        }
    }
}

/// One text-action button: the shared `.s-cookie-consent-ok` voice plus the
/// `data-action` token that distinguishes the verbs.
fn cookie_consent_action_button(
    action: CookieConsentAction,
    label: String,
    handler: Option<EventHandler<()>>,
) -> Element {
    rsx! {
        button {
            class: CookieConsentClass::Action.class_name(),
            "type": "button",
            "data-action": action.data_action(),
            // An element-level `onclick` is a closure, not a callback slot
            // (the rsx macro turns it into `on_event("click", …)`).
            onclick: move |_event: MouseEvent| {
                if let Some(handler) = handler.as_ref() {
                    handler.call(());
                }
            },
            "{label}"
        }
    }
}

#[define_props]
pub struct CookieConsentProps {
    /// The notice is on stage (Vue: the local `show` ref, promoted to a prop).
    #[default]
    pub visible: bool,

    /// The visitor already chose (Vue: the local `accepted` ref; the host
    /// persists it). While true the component collapses to the glyph.
    #[default]
    pub accepted: bool,

    /// Notice copy override; unset keeps the bundle's text.
    pub text: Option<String>,

    /// Accept verb label override (Vue's default is "OK").
    pub accept_label: Option<String>,

    /// Reject verb label override (wave addition, see the header).
    pub reject_label: Option<String>,

    /// Customize verb label override (rendered only when `on_customize` is
    /// wired).
    pub customize_label: Option<String>,

    /// The visitor consented. The host stores the flag and flips
    /// `accepted` / `visible`.
    pub on_accept: Option<EventHandler<()>>,

    /// The visitor refused the optional categories.
    pub on_reject: Option<EventHandler<()>>,

    /// The visitor asked for the preferences surface (host-side dialog).
    pub on_customize: Option<EventHandler<()>>,
}

#[component]
pub fn CookieConsent(props: CookieConsentProps) -> Element {
    let mode = cookie_consent_mode(props.visible, props.accepted);
    if mode.is_hidden() {
        return empty_vnode();
    }
    if mode.shows_marker() {
        return cookie_consent_marker();
    }

    let text = cookie_consent_text(props.text.as_deref());
    let reject_label =
        cookie_consent_action_label(CookieConsentAction::Reject, props.reject_label.as_deref());
    let accept_label =
        cookie_consent_action_label(CookieConsentAction::Accept, props.accept_label.as_deref());
    let customize_label = cookie_consent_action_label(
        CookieConsentAction::Customize,
        props.customize_label.as_deref(),
    );
    let shows_customize = cookie_consent_shows_customize(props.on_customize.is_some());

    rsx! {
        span {
            class: CookieConsentClass::Notice.class_name(),
            "{text}"
            {cookie_consent_action_button(
                CookieConsentAction::Reject,
                reject_label,
                props.on_reject.clone(),
            )}
            {cookie_consent_action_button(
                CookieConsentAction::Accept,
                accept_label,
                props.on_accept.clone(),
            )}
            if shows_customize {
                {cookie_consent_action_button(
                    CookieConsentAction::Customize,
                    customize_label,
                    props.on_customize.clone(),
                )}
            }
        }
    }
}

impl StyledComponent for CookieConsentComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.s-cookie-consent*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkCookieConsent.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "cookie-consent"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cookie_consent_class_names_match_the_sheet() {
        assert_eq!(CookieConsentClass::Notice.class_name(), "s-cookie-consent");
        assert_eq!(
            CookieConsentClass::Action.class_name(),
            "s-cookie-consent-ok"
        );
        assert_eq!(
            CookieConsentClass::Icon.class_name(),
            "s-cookie-consent-icon"
        );
        // The accepted glyph carries that class on its `<svg>` (Vue renders
        // `<Cookie class="s-cookie-consent-icon" />`), so the static markup
        // and the enum can never drift apart.
        assert!(
            COOKIE_CONSENT_COOKIE_SVG.contains(CookieConsentClass::Icon.class_name()),
            "the glyph markup must carry the sheet's icon class"
        );
    }

    #[test]
    fn cookie_consent_defaults_match_the_vue_props() {
        let props = CookieConsentProps::default();
        // Vue starts hidden until its mount effect decides; the controlled
        // mirror starts hidden too.
        assert!(!props.visible);
        assert!(!props.accepted);
        assert!(props.text.is_none());
        assert!(props.accept_label.is_none());
        assert!(props.reject_label.is_none());
        assert!(props.customize_label.is_none());
        assert!(props.on_accept.is_none());
        assert!(props.on_reject.is_none());
        assert!(props.on_customize.is_none());
        assert_eq!(CookieConsentMode::default(), CookieConsentMode::Hidden);
    }

    #[test]
    fn cookie_consent_mode_gate_matches_the_vue_render() {
        // Vue: `if (!show && !accepted) return null; if (accepted) return icon`.
        assert_eq!(cookie_consent_mode(false, false), CookieConsentMode::Hidden);
        assert_eq!(cookie_consent_mode(true, false), CookieConsentMode::Notice);
        assert_eq!(
            cookie_consent_mode(false, true),
            CookieConsentMode::Accepted
        );
        // Accepted wins even while the host still says visible.
        assert_eq!(cookie_consent_mode(true, true), CookieConsentMode::Accepted);
        assert!(CookieConsentMode::Hidden.is_hidden());
        assert!(CookieConsentMode::Notice.shows_notice());
        assert!(CookieConsentMode::Accepted.shows_marker());
        assert!(!CookieConsentMode::Accepted.shows_notice());
    }

    #[test]
    fn cookie_consent_labels_and_text_are_bundle_backed() {
        assert_eq!(cookie_consent_text(None), "This site uses cookies");
        // An override wins verbatim, even an empty string.
        assert_eq!(
            cookie_consent_text(Some("We use cookies")),
            "We use cookies"
        );
        assert_eq!(cookie_consent_text(Some("")), "");

        assert_eq!(
            cookie_consent_action_label(CookieConsentAction::Accept, None),
            "OK"
        );
        assert_eq!(
            cookie_consent_action_label(CookieConsentAction::Reject, None),
            "Reject"
        );
        assert_eq!(
            cookie_consent_action_label(CookieConsentAction::Customize, None),
            "Customize"
        );
        assert_eq!(
            cookie_consent_action_label(CookieConsentAction::Accept, Some("Got it")),
            "Got it"
        );
        // Every verb names a bundle key and its English default.
        for action in [
            CookieConsentAction::Accept,
            CookieConsentAction::Reject,
            CookieConsentAction::Customize,
        ] {
            assert!(
                action
                    .label_key()
                    .starts_with("components.hk.cookieConsent."),
                "every verb is a bundle key: {}",
                action.label_key()
            );
            assert!(!action.fallback().is_empty());
            assert_eq!(cookie_consent_action_label(action, None), action.fallback());
        }
        assert_eq!(CookieConsentAction::Accept.data_action(), "accept");
        assert_eq!(CookieConsentAction::Reject.data_action(), "reject");
        assert_eq!(CookieConsentAction::Customize.data_action(), "customize");
        // The customize verb is wired-or-absent.
        assert!(!cookie_consent_shows_customize(false));
        assert!(cookie_consent_shows_customize(true));
    }

    #[test]
    fn cookie_consent_renders_the_notice_contract() {
        let html = CookieConsent(CookieConsentProps {
            visible: true,
            on_accept: Some(EventHandler::new(|_: ()| {})),
            on_reject: Some(EventHandler::new(|_: ()| {})),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="s-cookie-consent""#,
            "This site uses cookies",
            r#"class="s-cookie-consent-ok""#,
            r#"data-action="accept""#,
            r#"data-action="reject""#,
            r#"type="button""#,
            ">OK</button>",
            ">Reject</button>",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Two verbs: accept + reject. The customize verb is NOT wired here.
        assert_eq!(html.matches("s-cookie-consent-ok").count(), 2, "{html}");
        assert!(!html.contains("data-action=\"customize\""), "{html}");
        // The notice is the bar only — no accepted glyph yet.
        assert!(!html.contains("s-cookie-consent-icon"), "{html}");
    }

    #[test]
    fn cookie_consent_renders_the_customize_verb_when_wired() {
        let html = CookieConsent(CookieConsentProps {
            visible: true,
            customize_label: Some("Preferences".to_string()),
            on_accept: Some(EventHandler::new(|_: ()| {})),
            on_reject: Some(EventHandler::new(|_: ()| {})),
            on_customize: Some(EventHandler::new(|_: ()| {})),
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"data-action="customize""#), "{html}");
        assert!(html.contains(">Preferences</button>"), "{html}");
        // All three verbs share the sheet's single text-action voice.
        assert_eq!(html.matches("s-cookie-consent-ok").count(), 3, "{html}");
    }

    #[test]
    fn cookie_consent_collapses_to_the_glyph_and_hides_entirely() {
        let accepted = CookieConsent(CookieConsentProps {
            visible: true,
            accepted: true,
            ..Default::default()
        })
        .render_to_html();
        // The glyph, not the bar (Vue's accepted branch) …
        assert!(accepted.contains("s-cookie-consent-icon"), "{accepted}");
        assert!(!accepted.contains("s-cookie-consent-ok"), "{accepted}");
        assert!(
            !accepted.contains(r#"class="s-cookie-consent""#),
            "{accepted}"
        );
        // … mounted through the display:contents SVG host, class on the svg.
        assert!(
            accepted.contains(r#"style="display:contents""#),
            "{accepted}"
        );
        assert!(
            accepted.contains(
                r#"class="lucide s-cookie-consent-icon lucide-cookie-icon lucide-cookie""#
            ),
            "{accepted}"
        );
        assert!(accepted.contains(r#"aria-hidden="true""#), "{accepted}");

        // Neither visible nor accepted renders nothing at all.
        let hidden = CookieConsent(CookieConsentProps::default()).render_to_html();
        assert!(
            hidden.is_empty(),
            "a hidden banner mounts no node: {hidden}"
        );
    }

    #[test]
    fn cookie_consent_escapes_consumer_copy() {
        let html = CookieConsent(CookieConsentProps {
            visible: true,
            text: Some("Cookies <3 & \"ads\"".to_string()),
            ..Default::default()
        })
        .render_to_html();
        // The text path is the escaped one — never raw markup.
        assert!(html.contains("&lt;3"), "{html}");
        assert!(html.contains("&amp;"), "{html}");
        assert!(!html.contains("<3"), "{html}");
    }

    #[test]
    fn cookie_consent_styles_come_from_the_canonical_vue_sheet() {
        let css = CookieConsentComponent::styles();
        for needle in [
            ".s-cookie-consent",
            ".s-cookie-consent-ok",
            ".s-cookie-consent-icon",
            "text-decoration: underline",
        ] {
            assert!(
                css.contains(needle),
                "cookie-consent css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored cookie-consent sheet"
        );
        assert_eq!(CookieConsentComponent::name(), "cookie-consent");
    }
}
