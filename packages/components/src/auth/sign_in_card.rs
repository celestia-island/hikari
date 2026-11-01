// hi-components/src/auth/sign_in_card.rs
// SignInCard — mirror of the canonical Vue `HkSignInCard`: the shared
// credential form every Celestia front end mounts (username + password +
// block submit, inside the auth card shell).
//
// Vue ships NO sheet for this component: the shell, the header and the form
// vocabulary are `HkAuthCard` + the `s-*` auth geometry in
// `packages/vue/src/styles/admin-tokens.scss` (vendored byte-identically
// under `src/styles/vue-mirror/styles/`, registered as the `vue-admin-tokens`
// chrome layer — see `auth/auth_card.rs`). [`SignInCardComponent::styles`]
// therefore returns `""`: this mirror owns the COMPOSITION only (DOM + class
// names) and builds it out of the already mirrored `AuthCard` / `Input` /
// `AuthSubmitButton` (which carries the `HkButton` voice).
//
// DOM contract (mirrors `HkSignInCard.tsx`, which composes `HkAuthCard`):
//
//   div.s-auth-card-height
//     div.s-auth-card
//       div.s-auth-header
//         {logo}                       (logo element, else logoSrc <img>)
//           img.hk-logo-img            alt="" style="width:3.5rem;height:3.5rem"
//         h1.s-auth-title              {title}
//         p.s-auth-subtitle            (subtitle truthy)
//       div.s-auth-form
//         {top}                        (top slot — OUTSIDE the <form>, so a tab
//                                       or SSO click can never submit)
//         form
//           div.hk-input-wrapper       (Input, name="signin-username")
//             span.hk-input-affix.hk-input-prefix > user glyph host
//           div.hk-input-wrapper       (Input, name="signin-password",
//                                       type="password"; only with password_field)
//           div.s-auth-submit > button.hk-btn…
//       div.s-auth-methods?            (forwarded methods slot ONLY)
//       div.s-auth-footer?             (forwarded footer slot ONLY)
//
// Vue prop mapping: `title` / `subtitle` / `logoSrc` / `logo` slot /
// `loading` / `disabled` / `top` slot / `usernameType` /
// `usernamePlaceholder` / `usernameAutocomplete` / `passwordAutocomplete` /
// `submitLabel` / `passwordField` / `footer` slot / `methods` slot →
// the same-named fields on [`SignInCardProps`]. The `submit(username, password)`
// emit → [`SignInCardProps::on_submit`], carrying [`SignInSubmit`].
//
// Control contract: Vue keeps `username` / `password` in local refs and
// `initialUsername` seeds the first. The mirror is fully CONTROLLED — the host
// owns both strings ([`SignInCardProps::username`] /
// [`SignInCardProps::password`]) and feeds every keystroke back through
// [`SignInCardProps::on_username_change`] / [`SignInCardProps::on_password_change`].
// `initialUsername` is therefore retired: passing the value IS the seed, and a
// step-flow remount carries it the same way (L48 — props only, no signals).
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * the password field renders the mirrored `Input` with the native
//     `type="password"` element. Vue uses `HkInput variant="password"`, whose
//     canvas dot-matrix surface (`HkPasswordSurface`) has no Rust mirror in
//     this wave — `basic/input.rs`'s `InputVariant` defers it — so the field
//     falls back to the browser's own masking while keeping Vue's
//     `name` / `autocomplete` / `placeholder` contract byte for byte.
//   * `credentialAutocomplete`'s Tauri branch has no Rust analogue: `isNative()`
//     is a Vue-runtime predicate and the crate ships no webview detector, so
//     the fallback is the BROWSER token (`username` / `current-password`). A
//     Tauri host passes the suppression tokens (`off` / `new-password`)
//     explicitly — the Vue prop surface already allows exactly that.
//   * the `<form>` DOES cancel its own submit event (Vue's
//     `onSubmit → preventDefault + attemptSubmit`), so a host that nests a
//     submit control cannot navigate the page away.
//   * the logo keeps Vue's `.hk-logo-img` class and inline 3.5rem box, but
//     that class's polish (block display, radius, `object-fit`) lives in
//     `HkLogo.scss`, which has no Rust mirror in this wave.
//   * the `footer` slot is forwarded ONLY when the host passes one, so an
//     empty `.s-auth-footer` is not rendered. Vue's `footer: () =>
//     slots.footer?.()` hands `HkAuthCard` a footer function unconditionally,
//     which makes it paint the padded, top-margined footer band even when the
//     consumer passed no footer — the same dead space `HkSignInCard`'s own
//     `methods` comment says must not be rendered. Reproducing that wart byte
//     for byte would add ~2.5rem of empty box to every footer-less card, so
//     the mirror models the INTENT (a footer band exists iff there is footer
//     content); a card that does pass a footer renders the identical DOM.
//
// i18n: the three strings Vue pulls from `hikari::signIn.*` resolve through
// `components.hk.signInCard.*` here (see the helpers below); an explicit prop
// always wins with NULLISH semantics (`??`), so an empty string stays empty.

use hikari_i18n::t;

use crate::auth::auth_card::{AuthCard, AuthCardProps};
use crate::auth::auth_submit_button::{AuthSubmitButton, AuthSubmitButtonProps};
use crate::basic::{Input, InputProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SignInCardComponent;

/// Browser autocomplete token for the username field (Vue:
/// `credentialAutocomplete("username", "username")`'s browser branch).
pub const SIGN_IN_USERNAME_AUTOCOMPLETE: &str = "username";

/// Browser autocomplete token for the password field (Vue:
/// `credentialAutocomplete("password", "current-password")`'s browser branch).
pub const SIGN_IN_PASSWORD_AUTOCOMPLETE: &str = "current-password";

/// The payload Vue's `submit` emit carries as `(username, password)`. The
/// username is the TRIMMED value; the password is raw, and empty in
/// account-first mode (`passwordField: false`) — Vue emits `""` there, never
/// the field's stale contents.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SignInSubmit {
    pub username: String,
    pub password: String,
}

/// The user glyph Vue hand-writes into the username field's `prefixIcon`
/// slot (`HkSignInCard.tsx`), byte-identical: the 24-unit stroke glyph sized
/// by the `.s-auth-card-field-icon` rule in the vendored admin tokens. Emitted
/// through `dangerous_inner_html` (L49 — trusted static markup; no caller data
/// is interpolated) because tairitsu creates elements without the SVG
/// namespace.
pub const SIGN_IN_CARD_USER_ICON_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="s-auth-card-field-icon" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>"#;

/// Vue's `attemptSubmit` guard: never while busy (external `loading`) or
/// `disabled`, never with a blank username, and — only when the password
/// field is on — never with an empty password. The username is trimmed for
/// the check but the password is compared raw (Vue: `!password.value`).
pub fn sign_in_can_submit(
    username: &str,
    password: &str,
    password_field: bool,
    loading: bool,
    disabled: bool,
) -> bool {
    if loading || disabled {
        return false;
    }
    if username.trim().is_empty() {
        return false;
    }
    if password_field && password.is_empty() {
        return false;
    }
    true
}

/// The submit button's `disabled` expression, exactly as `HkSignInCard` writes
/// it: `disabled || !username.trim() || (passwordField && !password)`. The
/// in-flight state is NOT part of it — it rides the button's `loading` prop,
/// which the mirrored `AuthSubmitButton` folds into `disabled || busy`.
pub fn sign_in_submit_disabled(
    username: &str,
    password: &str,
    password_field: bool,
    disabled: bool,
) -> bool {
    disabled || username.trim().is_empty() || (password_field && password.is_empty())
}

/// The payload the gate would emit, or `None` when it refuses. Both the Enter
/// path and the button path go through here, so they can never disagree.
pub fn sign_in_submit_payload(
    username: &str,
    password: &str,
    password_field: bool,
    loading: bool,
    disabled: bool,
) -> Option<SignInSubmit> {
    if !sign_in_can_submit(username, password, password_field, loading, disabled) {
        return None;
    }
    Some(SignInSubmit {
        username: username.trim().to_string(),
        password: if password_field {
            password.to_string()
        } else {
            String::new()
        },
    })
}

/// Vue: `loading || disabled` on BOTH fields (the external in-flight state
/// disables the inputs, not just the button).
pub fn sign_in_field_disabled(loading: bool, disabled: bool) -> bool {
    loading || disabled
}

/// Vue: `usernameAutocomplete ?? credentialAutocomplete("username", "username")`
/// — nullish, so an explicit `""` is kept (see the header delta for the Tauri
/// branch).
pub fn sign_in_username_autocomplete(explicit: Option<&str>) -> &str {
    explicit.unwrap_or(SIGN_IN_USERNAME_AUTOCOMPLETE)
}

/// Vue: `passwordAutocomplete ?? credentialAutocomplete("password",
/// "current-password")` — the same nullish rule.
pub fn sign_in_password_autocomplete(explicit: Option<&str>) -> &str {
    explicit.unwrap_or(SIGN_IN_PASSWORD_AUTOCOMPLETE)
}

/// Vue: `usernamePlaceholder ?? t("hikari::signIn.usernamePlaceholder",
/// "Username")`.
pub fn sign_in_username_placeholder(explicit: Option<&str>) -> String {
    explicit
        .map(str::to_string)
        .unwrap_or_else(|| t("components.hk.signInCard.usernamePlaceholder", "Username"))
}

/// Vue: `t("hikari::signIn.passwordPlaceholder", "Password")` — Vue exposes no
/// override prop for this field.
pub fn sign_in_password_placeholder() -> String {
    t("components.hk.signInCard.passwordPlaceholder", "Password")
}

/// Vue: `submitLabel ?? t("hikari::signIn.submit", "Sign in")`.
pub fn sign_in_submit_label(explicit: Option<&str>) -> String {
    explicit
        .map(str::to_string)
        .unwrap_or_else(|| t("components.hk.signInCard.submit", "Sign in"))
}

#[define_props]
pub struct SignInCardProps {
    /// Card title (Vue: `title`, required).
    #[default]
    pub title: String,

    /// Card subtitle; empty/absent renders no line.
    pub subtitle: Option<String>,

    /// Logo image URL (Vue: `logoSrc`); ignored when `logo` is set.
    pub logo_src: Option<String>,

    /// Logo slot (Vue: the `logo` slot) — wins over `logo_src`, like Vue.
    pub logo: Option<Element>,

    /// External in-flight state; disables both fields and drives the submit
    /// button's loading look.
    #[default]
    pub loading: bool,

    /// Extra guard on top of the built-in empty-field gate (Vue: `disabled`).
    #[default]
    pub disabled: bool,

    /// Content between the card header and the credential form (Vue: the
    /// `top` slot). Rendered outside the `<form>`.
    pub top: Option<Element>,

    /// Controlled username value (Vue: the local `username` ref, seeded by
    /// `initialUsername`).
    #[default]
    pub username: String,

    /// Controlled password value (Vue: the local `password` ref, always "").
    #[default]
    pub password: String,

    /// Username placeholder; `None` falls back to the locale string.
    pub username_placeholder: Option<String>,

    /// Native username field type (Vue: `usernameType`, default `"text"`);
    /// switch to `"email"` for identifier logins.
    #[default("text".to_string())]
    pub username_type: String,

    /// Username autocomplete token; `None` uses the browser default
    /// (`username`).
    pub username_autocomplete: Option<String>,

    /// Password autocomplete token; `None` uses the browser default
    /// (`current-password`).
    pub password_autocomplete: Option<String>,

    /// Submit caption; `None` falls back to the locale string.
    pub submit_label: Option<String>,

    /// Render the password field at all (Vue: `passwordField`, default true).
    /// Account-first flows switch it off — the field is OMITTED, not hidden,
    /// so no credential manager offers to save a password this card never
    /// collects.
    #[default(true)]
    pub password_field: bool,

    /// Footer slot (remember-me, protocol links, …), forwarded to the card.
    pub footer: Option<Element>,

    /// Methods slot, forwarded to the card ONLY when provided (an
    /// always-present slot would render the card's padded methods box as dead
    /// space).
    pub methods: Option<Element>,

    /// Field updates (Vue: `update:modelValue` on each `HkInput`) — the host
    /// owns the values.
    pub on_username_change: Option<EventHandler<String>>,

    /// Password field updates (Vue: `update:modelValue`).
    pub on_password_change: Option<EventHandler<String>>,

    /// The credential intent (Vue: the `submit` emit).
    pub on_submit: Option<EventHandler<SignInSubmit>>,

    /// Host class, appended to the card's `.s-auth-card-height` wrapper (Vue
    /// falls `attrs.class` through to the root).
    #[default]
    pub class: String,
}

#[component]
pub fn SignInCard(props: SignInCardProps) -> Element {
    let field_disabled = sign_in_field_disabled(props.loading, props.disabled);
    let submit_disabled = sign_in_submit_disabled(
        &props.username,
        &props.password,
        props.password_field,
        props.disabled,
    );

    // One intent for all three submit paths (Enter in either field, the
    // button, the form event): `Callback` is cloneable, the gate is pure.
    let intent = {
        let username = props.username.clone();
        let password = props.password.clone();
        let password_field = props.password_field;
        let loading = props.loading;
        let disabled = props.disabled;
        let submit = props.on_submit.clone();
        event_handler(move |_: ()| {
            let payload =
                sign_in_submit_payload(&username, &password, password_field, loading, disabled);
            if let Some(payload) = payload
                && let Some(handler) = submit.as_ref()
            {
                handler.call(payload);
            }
        })
    };

    // ── the credential fields ─────────────────────────────────────────────
    let username_placeholder = sign_in_username_placeholder(props.username_placeholder.as_deref());
    let username_autocomplete =
        sign_in_username_autocomplete(props.username_autocomplete.as_deref()).to_string();
    let password_placeholder = sign_in_password_placeholder();
    let password_autocomplete =
        sign_in_password_autocomplete(props.password_autocomplete.as_deref()).to_string();
    let username_value = props.username.clone();
    let password_value = props.password.clone();
    let username_type = props.username_type.clone();
    let password_field = props.password_field;

    let on_username_change = props.on_username_change.clone();
    let on_password_change = props.on_password_change.clone();

    // L49: the glyph travels as trusted static markup inside a
    // `display: contents` host, exactly like the mirrored `SearchInput`.
    let username_icon = rsx! {
        div {
            style: "display:contents",
            dangerous_inner_html: SIGN_IN_CARD_USER_ICON_SVG,
        }
    };

    let submit_label = sign_in_submit_label(props.submit_label.as_deref());

    let form = rsx! {
        form {
            // Vue: `onSubmit={(e) => { e.preventDefault(); attemptSubmit(); }}`.
            // `submit` is not one of the typed `rsx!` events, so the handler
            // receives the boxed payload and cancels it by downcasting.
            onsubmit: {
                let intent = intent.clone();
                move |event: Box<dyn EventData>| {
                    if let Some(submit) = event
                        .as_any()
                        .downcast_ref::<tairitsu_vdom::SubmitEvent>()
                    {
                        submit.prevent_default();
                    }
                    intent.call(());
                }
            },
            Input {
                model_value: username_value,
                input_type: Some(username_type),
                name: Some("signin-username".to_string()),
                autocomplete: Some(username_autocomplete),
                placeholder: Some(username_placeholder),
                disabled: field_disabled,
                submit_on_enter: Some(intent.clone()),
                prefix_icon: Some(username_icon),
                oninput: Some(event_handler(move |value: String| {
                    if let Some(handler) = on_username_change.as_ref() {
                        handler.call(value);
                    }
                })),
            }
            if password_field {
                Input {
                    model_value: password_value,
                    // Vue: `variant="password"` (see the header delta).
                    input_type: Some("password".to_string()),
                    name: Some("signin-password".to_string()),
                    autocomplete: Some(password_autocomplete),
                    placeholder: Some(password_placeholder),
                    disabled: field_disabled,
                    submit_on_enter: Some(intent.clone()),
                    oninput: Some(event_handler(move |value: String| {
                        if let Some(handler) = on_password_change.as_ref() {
                            handler.call(value);
                        }
                    })),
                }
            }
            AuthSubmitButton {
                label: Some(submit_label),
                block: true,
                loading: props.loading,
                disabled: submit_disabled,
                on_submit: Some(intent.clone()),
            }
        }
    };

    // ── the card body: `top` outside the form, then the form ──────────────
    let mut body: Vec<VNode> = Vec::with_capacity(2);
    if let Some(top) = props.top.clone() {
        body.push(top);
    }
    body.push(form);

    // Vue: the `logo` slot wins over `logoSrc`; neither renders nothing.
    let logo = match (props.logo.clone(), props.logo_src.clone()) {
        (Some(slot), _) => Some(slot),
        (None, Some(src)) => Some(rsx! {
            img {
                class: "hk-logo-img",
                src: src,
                alt: "",
                style: "width:3.5rem;height:3.5rem",
            }
        }),
        (None, None) => None,
    };

    let card_props = AuthCardProps {
        title: props.title.clone(),
        subtitle: props.subtitle.clone(),
        logo,
        children: VNode::Fragment(body),
        methods: props.methods.clone(),
        footer: props.footer.clone(),
        class: props.class.clone(),
        ..Default::default()
    };

    AuthCard(card_props)
}

impl StyledComponent for SignInCardComponent {
    fn styles() -> &'static str {
        // Vue ships no sheet for this component: the geometry comes from the
        // `HkAuthCard` shell (the vendored `admin-tokens` chrome) and the two
        // composed mirrors ship their own sheets.
        ""
    }

    fn name() -> &'static str {
        "sign-in-card"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_in_card_defaults_match_the_vue_props() {
        let props = SignInCardProps::default();
        assert_eq!(props.title, "");
        assert_eq!(props.subtitle, None);
        assert_eq!(props.logo_src, None);
        assert!(props.logo.is_none());
        assert!(!props.loading);
        assert!(!props.disabled);
        assert!(props.top.is_none());
        // Controlled state starts empty (Vue: `ref(props.initialUsername)` / "").
        assert_eq!(props.username, "");
        assert_eq!(props.password, "");
        assert_eq!(props.username_placeholder, None);
        // Vue: `usernameType` defaults to "text".
        assert_eq!(props.username_type, "text");
        assert_eq!(props.username_autocomplete, None);
        assert_eq!(props.password_autocomplete, None);
        assert_eq!(props.submit_label, None);
        // Vue: `passwordField` defaults to true (the classic two-field card).
        assert!(props.password_field);
        assert!(props.footer.is_none());
        assert!(props.methods.is_none());
        assert!(props.on_username_change.is_none());
        assert!(props.on_password_change.is_none());
        assert!(props.on_submit.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn sign_in_submit_gate_matches_the_vue_attempt_submit() {
        // Busy or disabled never submits, whatever the fields hold.
        assert!(!sign_in_can_submit("ada", "pw", true, true, false));
        assert!(!sign_in_can_submit("ada", "pw", true, false, true));
        // A blank (or whitespace-only) username blocks.
        assert!(!sign_in_can_submit("", "pw", true, false, false));
        assert!(!sign_in_can_submit("   ", "pw", true, false, false));
        // An empty password blocks only while the password field is on.
        assert!(!sign_in_can_submit("ada", "", true, false, false));
        assert!(sign_in_can_submit("ada", "", false, false, false));
        assert!(sign_in_can_submit(" ada ", "pw", true, false, false));
        // The password is NOT trimmed in Vue's check either.
        assert!(sign_in_can_submit("ada", " ", true, false, false));
    }

    #[test]
    fn sign_in_submit_payload_trims_the_username_and_zeroes_the_absent_password() {
        assert_eq!(
            sign_in_submit_payload("  ada  ", "s3cret", true, false, false),
            Some(SignInSubmit {
                username: "ada".to_string(),
                password: "s3cret".to_string(),
            })
        );
        // Account-first mode: the emit carries an EMPTY password, never the
        // field's contents (Vue: `props.passwordField ? password.value : ""`).
        assert_eq!(
            sign_in_submit_payload("ada", "stale", false, false, false),
            Some(SignInSubmit {
                username: "ada".to_string(),
                password: String::new(),
            })
        );
        assert_eq!(sign_in_submit_payload("  ", "pw", true, false, false), None);
        assert_eq!(sign_in_submit_payload("ada", "", true, false, false), None);
        assert_eq!(sign_in_submit_payload("ada", "pw", true, true, false), None);
    }

    #[test]
    fn sign_in_submit_button_disabled_matches_the_vue_expression() {
        // Vue: `disabled || !username.trim() || (passwordField && !password)`.
        assert!(sign_in_submit_disabled("", "pw", true, false));
        assert!(sign_in_submit_disabled("  ", "pw", true, false));
        assert!(sign_in_submit_disabled("ada", "", true, false));
        assert!(!sign_in_submit_disabled("ada", "", false, false));
        assert!(sign_in_submit_disabled("ada", "pw", true, true));
        assert!(!sign_in_submit_disabled("ada", "pw", true, false));
        // The in-flight state is the button's `loading`, not this expression.
        assert!(!sign_in_submit_disabled("ada", "pw", true, false));
        // Both fields disable on either flag (Vue: `loading || disabled`).
        assert!(sign_in_field_disabled(true, false));
        assert!(sign_in_field_disabled(false, true));
        assert!(!sign_in_field_disabled(false, false));
    }

    #[test]
    fn sign_in_autocomplete_and_labels_use_nullish_fallbacks() {
        // `??` semantics: an explicit empty token is KEPT.
        assert_eq!(sign_in_username_autocomplete(None), "username");
        assert_eq!(sign_in_password_autocomplete(None), "current-password");
        assert_eq!(sign_in_username_autocomplete(Some("email")), "email");
        assert_eq!(sign_in_username_autocomplete(Some("")), "");
        assert_eq!(
            sign_in_password_autocomplete(Some("new-password")),
            "new-password"
        );
        // The placeholders/labels fall back to the locale strings, and an
        // explicit empty string is preserved.
        assert_eq!(sign_in_username_placeholder(None), "Username");
        assert_eq!(sign_in_username_placeholder(Some("E-mail")), "E-mail");
        assert_eq!(sign_in_username_placeholder(Some("")), "");
        assert_eq!(sign_in_password_placeholder(), "Password");
        assert_eq!(sign_in_submit_label(None), "Sign in");
        assert_eq!(sign_in_submit_label(Some("Log in")), "Log in");
        assert_eq!(sign_in_submit_label(Some("")), "");
    }

    #[test]
    fn sign_in_card_renders_the_vue_dom_contract() {
        let html = SignInCard(SignInCardProps {
            title: "Sign in".to_string(),
            subtitle: Some("Continue to your account".to_string()),
            ..Default::default()
        })
        .render_to_html();
        // The card shell wraps the form (SignInCard composes HkAuthCard).
        assert!(html.contains(r#"class="s-auth-card-height""#), "{html}");
        assert!(html.contains(r#"class="s-auth-card""#), "{html}");
        assert!(html.contains(r#"class="s-auth-title""#), "{html}");
        assert!(html.contains("Sign in"), "{html}");
        assert!(html.contains(r#"class="s-auth-form""#), "{html}");
        assert!(html.contains("<form"), "{html}");
        // Both fields, with Vue's name / type / autocomplete / placeholder
        // contract and the username glyph inside the prefix affix.
        assert!(html.contains(r#"name="signin-username""#), "{html}");
        assert!(html.contains(r#"name="signin-password""#), "{html}");
        assert!(html.contains(r#"type="password""#), "{html}");
        assert!(html.contains(r#"autocomplete="username""#), "{html}");
        assert!(
            html.contains(r#"autocomplete="current-password""#),
            "{html}"
        );
        assert!(html.contains(r#"placeholder="Username""#), "{html}");
        assert!(html.contains(r#"placeholder="Password""#), "{html}");
        assert!(html.contains("hk-input-affix hk-input-prefix"), "{html}");
        assert!(html.contains("s-auth-card-field-icon"), "{html}");
        assert!(html.contains(r#"style="display:contents""#), "{html}");
        // The submit button: block, disabled while the fields are empty.
        assert!(html.contains("s-auth-submit"), "{html}");
        assert!(html.contains("hk-btn-block"), "{html}");
        assert!(html.contains(r#"disabled="disabled""#), "{html}");
        assert!(html.contains("Sign in"), "{html}");

        // Account-first mode omits the password field ENTIRELY.
        let html = SignInCard(SignInCardProps {
            username: "ada".to_string(),
            password_field: false,
            submit_label: Some("Continue".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"name="signin-username""#), "{html}");
        assert!(!html.contains("signin-password"), "{html}");
        assert!(!html.contains(r#"type="password""#), "{html}");
        assert!(html.contains("Continue"), "{html}");

        // logoSrc renders Vue's img (alt "", inline 3.5rem box); a logo
        // element wins over it.
        let html = SignInCard(SignInCardProps {
            logo_src: Some("https://example.test/logo.svg".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="hk-logo-img""#), "{html}");
        assert!(
            html.contains(r#"src="https://example.test/logo.svg""#),
            "{html}"
        );
        assert!(html.contains(r#"alt="""#), "{html}");
        assert!(
            html.contains(r#"style="width:3.5rem;height:3.5rem""#),
            "{html}"
        );
        let html = SignInCard(SignInCardProps {
            logo_src: Some("https://example.test/logo.svg".to_string()),
            logo: Some(rsx! {
                span { class: "test-logo" }
            }),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="test-logo""#), "{html}");
        assert!(!html.contains("hk-logo-img"), "{html}");

        // No footer / methods slot was passed → no bands at all (see the
        // header delta on Vue's unconditional footer lambda).
        let html = SignInCard(SignInCardProps {
            title: "Sign in".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("s-auth-footer"), "{html}");
        assert!(!html.contains("s-auth-methods"), "{html}");

        // A passed footer does render the band, with the methods block
        // between the form and the footer (Vue's slot order).
        let html = SignInCard(SignInCardProps {
            footer: Some(rsx! {
                span { class: "test-footer" }
            }),
            methods: Some(rsx! {
                div { class: "test-methods" }
            }),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("s-auth-footer"), "{html}");
        assert!(html.contains(r#"class="test-footer""#), "{html}");
        assert!(html.contains("s-auth-methods"), "{html}");
        assert!(html.contains(r#"class="test-methods""#), "{html}");
        let form = html.find("s-auth-form").unwrap();
        let methods = html.find("s-auth-methods").unwrap();
        let footer = html.find("s-auth-footer").unwrap();
        assert!(form < methods && methods < footer, "{html}");
    }

    #[test]
    fn sign_in_card_ships_no_sheet_of_its_own() {
        // Vue ships no `HkSignInCard.scss`: the card shell + the composed
        // mirrors own every rule, so this component must stay sheetless.
        assert_eq!(SignInCardComponent::styles(), "");
        assert_eq!(SignInCardComponent::name(), "sign-in-card");
        // The glyph host is the trusted static markup L49 allows.
        assert!(SIGN_IN_CARD_USER_ICON_SVG.starts_with("<svg "));
        assert!(SIGN_IN_CARD_USER_ICON_SVG.ends_with("</svg>"));
        assert!(
            SIGN_IN_CARD_USER_ICON_SVG.contains(r#"class="s-auth-card-field-icon""#),
            "the glyph must keep the class the admin tokens size"
        );
        assert!(SIGN_IN_CARD_USER_ICON_SVG.contains(r#"aria-hidden="true""#));
    }
}
