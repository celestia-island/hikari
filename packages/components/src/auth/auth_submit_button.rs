// hi-components/src/auth/auth_submit_button.rs
// AuthSubmitButton — mirror of the canonical Vue `HkAuthSubmitButton`: the
// auth kit's submit control (a block `HkButton` with the challenge-lifecycle
// loading look and an optional error line under it).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkAuthSubmitButton.scss`, vendored
// byte-identically under `src/styles/vue-mirror/components/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.s-auth-submit*` class names are literal and identical in both forms. The
// button voice itself is not this sheet's: the mirror composes the canonical
// `Button` (`basic/button.rs`), exactly like Vue composes `HButton`.
//
// DOM contract (attribute-for-attribute with `HkAuthSubmitButton.tsx`):
//
//   div.s-auth-submit                 [host class]
//     button.hk-btn.hk-btn-{variant}.hk-btn-{size}
//            [.hk-btn-block] [.hk-btn-loading]
//            type="button" [disabled] [aria-busy="true"] [aria-label]
//       span.hk-btn-ring            (busy only: the SMIL ring)
//       span.hk-btn-label           {caption}
//     p.s-auth-submit-error         (only when `error` is non-empty)
//
// `aria-busy` and the native `disabled` attribute are not this component's to
// publish: the mirrored `Button` owns that pair (`loading → aria-busy=true`,
// `disabled || loading → disabled`), and this mirror feeds it
// `busy = loading || solving`, which is exactly Vue's `HButton` wiring.
//
// Vue prop mapping: `label` (required in Vue) → [`AuthSubmitButtonProps::label`]
// (`None` falls back to the `components.hk.authSubmitButton.label` locale
// string, so a bare `AuthSubmitButton {}` is valid Rust), `solvingLabel` →
// [`AuthSubmitButtonProps::solving_label`], `loading` /
// `disabled` / `error` / `block` / `size` / `variant` → the same-named fields.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * `solving` is a PROP here, not Vue's local `ref(false)`. The mirror keeps
//     no component state at all (L48 — props only), so the challenge
//     lifecycle Vue owns internally — `onGetChallenge` → `solvePow` /
//     `solver` → `onCaptcha` → `doSubmit`, with its `try`/`catch`/`finally`
//     flipping `solving` — is HOST-owned: the host flips `solving` while the
//     PoW/captcha work runs and clears it afterwards. The rendered busy look
//     is identical (`busy = loading || solving`).
//   * `onGetChallenge` / `solver` / `onCaptcha` / `doSubmit` therefore
//     collapse into one [`AuthSubmitButtonProps::on_submit`] click intent, and
//     the Vue `error` EMIT has no producer (the mirror renders the `error`
//     prop; the host that catches the failure sets it).
//   * `variant` is the crate's [`ButtonVariant`], a superset of Vue's
//     `"primary" | "secondary" | "ghost"` union: `Danger` / `Outline` also
//     resolve (they are shared button voices, not auth-specific ones), and
//     `size` is [`ButtonSize`], a superset of Vue's `"sm" | "md" | "lg"`.
//   * the caption is passed to the mirrored `Button`'s `label` prop, so it
//     lands inside `.hk-btn-label` (Vue passes it as the default slot, i.e. a
//     bare text node) and the button also publishes `aria-label` with that
//     same string. The visible and accessible name are identical either way;
//     only the wrapping element differs.

use hikari_i18n::t;

use crate::basic::{Button, ButtonProps, ButtonSize, ButtonVariant};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AuthSubmitButtonComponent;

/// Vue's `busy` computed: the external in-flight state OR the in-component
/// challenge solve.
pub fn auth_submit_busy(loading: bool, solving: bool) -> bool {
    loading || solving
}

/// Vue's button `disabled` expression: `props.disabled || busy`.
pub fn auth_submit_disabled(disabled: bool, busy: bool) -> bool {
    disabled || busy
}

/// Vue's `handleClick` guard: a second click while busy is dropped instead of
/// queueing a second challenge round.
pub fn auth_submit_can_start(busy: bool) -> bool {
    !busy
}

/// Vue's caption switch: while solving, a non-empty `solvingLabel` replaces
/// the label (an empty one is falsy and keeps the regular caption — the
/// spinner-beside-the-label default the component was asked to keep).
pub fn auth_submit_caption<'a>(
    label: &'a str,
    solving_label: Option<&'a str>,
    solving: bool,
) -> &'a str {
    if solving && let Some(text) = solving_label.filter(|text| !text.is_empty()) {
        return text;
    }
    label
}

/// Vue's `props.error && <p>`: only a non-empty message renders the line.
pub fn auth_submit_error_line(error: Option<&str>) -> Option<&str> {
    error.filter(|message| !message.is_empty())
}

/// Vue: `props.label` is required; the mirror falls back to the locale string
/// so an unlabelled button still has a name.
pub fn auth_submit_label(explicit: Option<&str>) -> String {
    explicit
        .map(str::to_string)
        .unwrap_or_else(|| t("components.hk.authSubmitButton.label", "Sign in"))
}

#[define_props]
pub struct AuthSubmitButtonProps {
    /// Submit caption (Vue: `label`, required); `None` uses the locale
    /// string.
    pub label: Option<String>,

    /// Caption shown while the challenge is being solved (Vue:
    /// `solvingLabel`). Unset keeps the regular label beside the spinner.
    pub solving_label: Option<String>,

    /// External in-flight state (the consumer's request/in-flight flag).
    #[default]
    pub loading: bool,

    /// In-component challenge state — Vue's local `solving` ref, promoted to a
    /// controlled prop (see the file header delta).
    #[default]
    pub solving: bool,

    /// Extra guard on top of the built-in busy lock.
    #[default]
    pub disabled: bool,

    /// Failure message rendered under the button (Vue: `error`).
    pub error: Option<String>,

    /// Full-width presentation (Vue: `block`).
    #[default]
    pub block: bool,

    /// Button size step (Vue: `"sm" | "md" | "lg"`, default `md`).
    #[default]
    pub size: ButtonSize,

    /// Button voice (Vue: `"primary" | "secondary" | "ghost"`, default
    /// `primary`).
    #[default]
    pub variant: ButtonVariant,

    /// The click intent — Vue's `doSubmit` entry point (the challenge
    /// lifecycle itself is host-owned; see the file header delta).
    pub on_submit: Option<EventHandler<()>>,

    /// Host class, appended to the `.s-auth-submit` wrapper (Vue falls
    /// `attrs.class` through to the root element).
    #[default]
    pub class: String,
}

#[component]
pub fn AuthSubmitButton(props: AuthSubmitButtonProps) -> Element {
    let label = auth_submit_label(props.label.as_deref());
    let busy = auth_submit_busy(props.loading, props.solving);
    let disabled = auth_submit_disabled(props.disabled, busy);
    let caption =
        auth_submit_caption(&label, props.solving_label.as_deref(), props.solving).to_string();
    let error = auth_submit_error_line(props.error.as_deref()).map(str::to_string);

    let mut root_classes = String::from("s-auth-submit");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    let on_submit = props.on_submit.clone();

    rsx! {
        div { class: root_classes,
            Button {
                variant: props.variant,
                size: props.size,
                block: props.block,
                loading: busy,
                disabled: disabled,
                label: Some(caption),
                onclick: Some(event_handler(move |_: MouseEvent| {
                    // Vue's `handleClick` early return.
                    if auth_submit_can_start(busy)
                        && let Some(handler) = on_submit.as_ref()
                    {
                        handler.call(());
                    }
                })),
            }
            if let Some(error) = error {
                p { class: "s-auth-submit-error", "{error}" }
            }
        }
    }
}

impl StyledComponent for AuthSubmitButtonComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.s-auth-submit*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkAuthSubmitButton.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "auth-submit-button"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_submit_button_defaults_match_the_vue_props() {
        let props = AuthSubmitButtonProps::default();
        // Vue requires `label`; the mirror defaults it to the locale string.
        assert_eq!(props.label, None);
        assert_eq!(auth_submit_label(props.label.as_deref()), "Sign in");
        assert_eq!(props.solving_label, None);
        assert!(!props.loading);
        assert!(!props.solving);
        assert!(!props.disabled);
        assert_eq!(props.error, None);
        assert!(!props.block);
        // Vue: size "md", variant "primary".
        assert_eq!(props.size, ButtonSize::Md);
        assert_eq!(props.variant, ButtonVariant::Primary);
        assert!(props.on_submit.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn auth_submit_busy_and_disabled_derive_like_the_vue_computed() {
        // `busy = loading || solving`.
        assert!(!auth_submit_busy(false, false));
        assert!(auth_submit_busy(true, false));
        assert!(auth_submit_busy(false, true));
        assert!(auth_submit_busy(true, true));
        // `disabled || busy` — the extra guard can only ever lock it harder.
        assert!(!auth_submit_disabled(false, false));
        assert!(auth_submit_disabled(true, false));
        assert!(auth_submit_disabled(false, true));
        assert!(auth_submit_disabled(true, true));
        // The click gate is the inverse of busy.
        assert!(auth_submit_can_start(false));
        assert!(!auth_submit_can_start(true));
    }

    #[test]
    fn auth_submit_caption_switches_only_while_solving() {
        // Idle: the regular label, whatever `solvingLabel` says.
        assert_eq!(auth_submit_caption("Sign in", None, false), "Sign in");
        assert_eq!(
            auth_submit_caption("Sign in", Some("Solving…"), false),
            "Sign in"
        );
        // Solving: a non-empty solving label wins…
        assert_eq!(
            auth_submit_caption("Sign in", Some("Solving…"), true),
            "Solving…"
        );
        // …and an absent/empty one falls back (Vue's truthiness test).
        assert_eq!(auth_submit_caption("Sign in", None, true), "Sign in");
        assert_eq!(auth_submit_caption("Sign in", Some(""), true), "Sign in");
    }

    #[test]
    fn auth_submit_error_line_matches_the_vue_truthiness_test() {
        // Vue: `props.error && <p>` — an empty message renders nothing.
        assert_eq!(auth_submit_error_line(None), None);
        assert_eq!(auth_submit_error_line(Some("")), None);
        assert_eq!(
            auth_submit_error_line(Some("Invalid credentials")),
            Some("Invalid credentials")
        );
        // An explicit caption always wins over the locale fallback (nullish).
        assert_eq!(auth_submit_label(Some("Log in")), "Log in");
        assert_eq!(auth_submit_label(Some("")), "");
    }

    #[test]
    fn auth_submit_button_renders_the_vue_dom_contract() {
        // Idle default: the wrapper, the shared button voice, the caption in
        // the label box, no error line, no busy markers.
        let html = AuthSubmitButton(AuthSubmitButtonProps::default()).render_to_html();
        assert!(html.contains(r#"class="s-auth-submit""#), "{html}");
        assert!(
            html.contains(r#"class="hk-btn hk-btn-primary hk-btn-md""#),
            "{html}"
        );
        assert!(html.contains(r#"type="button""#), "{html}");
        assert!(html.contains(r#"class="hk-btn-label""#), "{html}");
        assert!(html.contains("Sign in"), "{html}");
        assert!(!html.contains("hk-btn-block"), "{html}");
        assert!(!html.contains("hk-btn-loading"), "{html}");
        assert!(!html.contains("aria-busy"), "{html}");
        assert!(!html.contains("s-auth-submit-error"), "{html}");
        assert!(!html.contains(r#"disabled="#), "{html}");

        // Busy: `loading` alone flips the loading look, `aria-busy` and the
        // native disabled attribute (Vue: `disabled || busy`).
        let html = AuthSubmitButton(AuthSubmitButtonProps {
            loading: true,
            block: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-btn-loading"), "{html}");
        assert!(html.contains("hk-btn-block"), "{html}");
        assert!(html.contains(r#"aria-busy="true""#), "{html}");
        assert!(html.contains(r#"disabled="disabled""#), "{html}");
        assert!(html.contains("hk-btn-ring"), "{html}");

        // `solving` is the mirror of Vue's local ref — same busy look, and the
        // challenge caption replaces the label.
        let html = AuthSubmitButton(AuthSubmitButtonProps {
            solving: true,
            solving_label: Some("Solving…".to_string()),
            size: ButtonSize::Lg,
            variant: ButtonVariant::Ghost,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-btn-loading"), "{html}");
        assert!(html.contains("Solving…"), "{html}");
        assert!(!html.contains(">Sign in<"), "{html}");
        assert!(
            html.contains(r#"class="hk-btn hk-btn-ghost hk-btn-lg hk-btn-loading""#),
            "{html}"
        );

        // The error line sits AFTER the button, inside the same wrapper.
        let html = AuthSubmitButton(AuthSubmitButtonProps {
            error: Some("Invalid credentials".to_string()),
            class: "host-class".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains(r#"class="s-auth-submit host-class""#),
            "{html}"
        );
        assert!(html.contains(r#"class="s-auth-submit-error""#), "{html}");
        assert!(html.contains("Invalid credentials"), "{html}");
        let button = html.find("hk-btn").unwrap();
        let error_line = html.find("s-auth-submit-error").unwrap();
        assert!(button < error_line, "{html}");
    }

    #[test]
    fn auth_submit_button_styles_come_from_the_canonical_vue_sheet() {
        let css = AuthSubmitButtonComponent::styles();
        assert!(css.contains(".s-auth-submit"), "{css}");
        assert!(css.contains(".s-auth-submit-error"), "{css}");
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored auth submit sheet"
        );
        // The button voice belongs to the composed `Button` sheet, not to this
        // one: `.hk-btn*` rules must NOT be duplicated here.
        assert!(
            !css.contains(".hk-btn"),
            "the button voice is the mirrored HkButton sheet's job"
        );
        assert_eq!(AuthSubmitButtonComponent::name(), "auth-submit-button");
    }
}
