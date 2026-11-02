// hi-components/src/theme/avatar_button.rs
// AvatarButton — mirror of the canonical Vue `HkAvatarButton`: the avatar
// trigger button, ONE component for every face (extracted from HkAdminHeader,
// shell-unify wave 7). The button owns the shared avatar grammar: the round
// trigger, the image with its graceful letter fallback, and the failed-load
// latch that resets when the URL changes (an account switch or avatar upload
// deserves a fresh attempt). Hosts with their own header chrome render it
// directly; the geometry has exactly one definition instead of one per face.
//
// NO OWN SHEET (W2a finding): `HkAvatarButton.tsx` ships no
// `HkAvatarButton.scss` — its styles live in the shared admin-tokens sheet
// (`.s-admin-header-avatar`, `.s-admin-header-avatar-img`, `.s-user-avatar`),
// vendored at `src/styles/vue-mirror/styles/admin-tokens.scss` and registered
// ONCE as the `vue-admin-tokens` chrome by `StyleRegistry::register_vue_chrome`
// (`styled.rs`). [`AvatarButtonComponent::styles`] therefore returns `""`: the
// 28px full-box round trigger (`width/height: var(--space-28)`, radius-full,
// overflow hidden), the covering image and the filled-circle letter all come
// from that chrome, and an empty registration adds no second copy of it to the
// bundle.
//
// DOM contract (mirrors the Vue render output):
//
//   button.s-admin-header-avatar [aria-label] [aria-haspopup] [aria-expanded]
//     img.s-admin-header-avatar-img [src alt]   (avatar_url && !failed)
//     | span.s-user-avatar {initial}
//
// Deliberately NO hover veil, exactly Vue: every face's trigger opens the
// user MENU (the avatar edit lives one row down as the Camera item), so a
// camera overlay would promise click-to-change and lie (user report
// 2026-09-16).
//
// STATE CONTRACT (ledger L48): tairitsu 0.5.22 has no per-instance component
// state (`use_signal` allocates a fresh signal per render, `use_state` shares
// ONE slot per component type), so Vue's internal `avatarFailed` ref becomes
// the CONTROLLED [`AvatarButtonProps::failed`] prop and every transition
// leaves through a callback: `on_error` fires when the image fails (the host
// sets `failed`), and the URL-change reset — Vue's `watch(avatarUrl)` — is
// HOST-DRIVEN (the host clears `failed` when it writes a new `avatar_url`).
// The same controlled split `layout/admin_header.rs` documents for its two
// inlined copies of this grammar.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO ATTR FALLTHROUGH: Vue's single-root `inheritAttrs` drops extra attrs
//     (data-image, testids) onto the button; tairitsu props are typed fields,
//     so a host needing such hooks wraps the button (its own element carries
//     them) — the rendered button itself is byte-identical.
//   * INTERACTION rides the mouse family (ledger L67): `onclick` forwards the
//     `MouseEvent` verbatim (Vue's `click` emit). No stopPropagation here —
//     faces that need it (the admin header's outside-click shield) stop the
//     press at their own layer.
//   * NO i18n: the `?` fallback letter is a literal in Vue too; the component
//     carries no bundle keys.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AvatarButtonComponent;

/// The `aria-haspopup` value (Vue: `popup`): "menu" (dropdown) or "dialog"
/// (drawer). `None` omits the attribute.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum AvatarButtonPopup {
    Menu,
    Dialog,
}

impl AvatarButtonPopup {
    /// The `aria-haspopup` token exactly as Vue emits it.
    pub fn aria_value(self) -> &'static str {
        match self {
            AvatarButtonPopup::Menu => "menu",
            AvatarButtonPopup::Dialog => "dialog",
        }
    }
}

/// Vue's fallback letter: `props.username?.charAt(0).toUpperCase() || "?"` —
/// the `||` catches the EMPTY name (and a missing first char) alike, so both
/// render `?` (the same derivation `admin_header_avatar_initial` documents).
pub fn avatar_button_initial(username: &str) -> String {
    match username.chars().next() {
        Some(first) if !username.is_empty() => first.to_uppercase().to_string(),
        _ => "?".to_string(),
    }
}

/// Vue's image branch gate: `props.avatarUrl && !avatarFailed.value` — an
/// empty URL never mounts the image, and the failed latch falls back to the
/// letter even with a URL.
pub fn avatar_button_image_shown(avatar_url: &str, failed: bool) -> bool {
    !avatar_url.is_empty() && !failed
}

/// Vue's `aria-expanded={props.expanded}` (default `undefined`): `Some(false)`
/// renders the literal `aria-expanded="false"` (drawer-mode hosts omit the
/// attribute — no open state to announce); `None` omits it entirely.
pub fn avatar_button_expanded_attr(expanded: Option<bool>) -> Option<&'static str> {
    expanded.map(|expanded| if expanded { "true" } else { "false" })
}

#[define_props]
pub struct AvatarButtonProps {
    /// Avatar image URL; empty renders the letter fallback (Vue `avatarUrl`,
    /// default "").
    #[default]
    pub avatar_url: String,

    /// Signed-in name: the fallback letter, and the image's `alt`.
    #[default]
    pub username: String,

    /// Accessible label for the trigger — what it OPENS, not who it is.
    pub label: Option<String>,

    /// `aria-haspopup` value (Vue `popup`).
    pub popup: Option<AvatarButtonPopup>,

    /// `aria-expanded`; omit for drawer-mode triggers (no open state).
    pub expanded: Option<bool>,

    /// CONTROLLED failed-load latch (Vue: the internal `avatarFailed` ref).
    /// The host resets it when `avatar_url` changes (see the header).
    #[default]
    pub failed: bool,

    /// The trigger image failed to load (the host sets `failed`).
    pub on_error: Option<EventHandler<()>>,

    /// Trigger pressed (Vue: the `click` emit, the event verbatim).
    pub on_click: Option<EventHandler<MouseEvent>>,
}

#[component]
pub fn AvatarButton(props: AvatarButtonProps) -> Element {
    let image = avatar_button_image_shown(&props.avatar_url, props.failed);
    let initial = avatar_button_initial(&props.username);
    let on_error = props.on_error.clone();
    let on_click = props.on_click.clone();

    rsx! {
        button {
            class: "s-admin-header-avatar",
            "aria-label": props.label.clone(),
            "aria-haspopup": props.popup.map(AvatarButtonPopup::aria_value),
            "aria-expanded": avatar_button_expanded_attr(props.expanded),
            onclick: move |event: MouseEvent| {
                if let Some(handler) = on_click.as_ref() {
                    handler.call(event);
                }
            },
            if image {
                img {
                    class: "s-admin-header-avatar-img",
                    src: props.avatar_url.clone(),
                    alt: props.username.clone(),
                    onerror: move |_event: Box<dyn EventData>| {
                        if let Some(handler) = on_error.as_ref() {
                            handler.call(());
                        }
                    },
                }
            } else {
                // Letter fallback on the shared avatar primitive — the same
                // filled-circle grammar on every face (user report
                // 2026-09-12: 前后台头像不一致).
                span { class: "s-user-avatar", "{initial}" }
            }
        }
    }
}

impl StyledComponent for AvatarButtonComponent {
    fn styles() -> &'static str {
        // NO OWN SHEET: HkAvatarButton has no HkAvatarButton.scss (W2a
        // finding) — its geometry is the shared admin-tokens chrome
        // (`.s-admin-header-avatar*` / `.s-user-avatar`), vendored at
        // src/styles/vue-mirror/styles/admin-tokens.scss and registered once
        // as `vue-admin-tokens` by `StyleRegistry::register_vue_chrome`.
        // Empty: this component contributes no CSS of its own, and the bundle
        // must not carry a second copy of the chrome sheet.
        ""
    }

    fn name() -> &'static str {
        "avatar-button"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn avatar_button_defaults_match_the_vue_props() {
        let props = AvatarButtonProps::default();
        // Vue: `avatarUrl` / `username` default "", `label` / `popup` /
        // `expanded` default undefined, `avatarFailed` starts false.
        assert_eq!(props.avatar_url, "");
        assert_eq!(props.username, "");
        assert!(props.label.is_none());
        assert!(props.popup.is_none());
        assert!(props.expanded.is_none());
        assert!(!props.failed);
        assert!(props.on_error.is_none());
        assert!(props.on_click.is_none());
    }

    #[test]
    fn avatar_button_initial_matches_vue() {
        // `charAt(0).toUpperCase()`.
        assert_eq!(avatar_button_initial("alice"), "A");
        assert_eq!(avatar_button_initial("bob"), "B");
        assert_eq!(avatar_button_initial("cée"), "C");
        // The `||` catches the empty name too — `?`, not an empty chip.
        assert_eq!(avatar_button_initial(""), "?");
    }

    #[test]
    fn avatar_button_image_shown_is_url_and_not_failed() {
        // `avatarUrl && !avatarFailed`.
        assert!(avatar_button_image_shown("/a.png", false));
        assert!(!avatar_button_image_shown("/a.png", true));
        assert!(!avatar_button_image_shown("", false));
        assert!(!avatar_button_image_shown("", true));
    }

    #[test]
    fn avatar_button_popup_tokens_match_vue() {
        assert_eq!(AvatarButtonPopup::Menu.aria_value(), "menu");
        assert_eq!(AvatarButtonPopup::Dialog.aria_value(), "dialog");
    }

    #[test]
    fn avatar_button_expanded_attr_is_tri_state() {
        // `expanded` is tri-state: false renders the literal attribute,
        // `None` omits it entirely (drawer-mode hosts have no open state).
        assert_eq!(avatar_button_expanded_attr(Some(true)), Some("true"));
        assert_eq!(avatar_button_expanded_attr(Some(false)), Some("false"));
        assert_eq!(avatar_button_expanded_attr(None), None);
    }

    #[test]
    fn avatar_button_renders_the_vue_dom_contract() {
        let html = AvatarButton(AvatarButtonProps {
            avatar_url: "/a.png".to_string(),
            username: "alice".to_string(),
            label: Some("Account menu".to_string()),
            popup: Some(AvatarButtonPopup::Menu),
            expanded: Some(false),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="s-admin-header-avatar""#), "{html}");
        assert!(html.contains(r#"aria-label="Account menu""#), "{html}");
        assert!(html.contains(r#"aria-haspopup="menu""#), "{html}");
        assert!(html.contains(r#"aria-expanded="false""#), "{html}");
        assert!(
            html.contains(r#"class="s-admin-header-avatar-img""#),
            "{html}"
        );
        assert!(html.contains(r#"src="/a.png""#), "{html}");
        assert!(html.contains(r#"alt="alice""#), "{html}");
        assert!(!html.contains("s-user-avatar"), "{html}");

        // The failed latch falls back to the letter; the optional aria
        // attributes are absent when their props are `None`.
        let html = AvatarButton(AvatarButtonProps {
            avatar_url: "/a.png".to_string(),
            username: "bob".to_string(),
            failed: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="s-user-avatar""#), "{html}");
        assert!(html.contains(">B<"), "{html}");
        assert!(!html.contains("s-admin-header-avatar-img"), "{html}");
        assert!(!html.contains("aria-label"), "{html}");
        assert!(!html.contains("aria-haspopup"), "{html}");
        assert!(!html.contains("aria-expanded"), "{html}");

        // An empty URL mounts the fallback even without a failure.
        let html = AvatarButton(AvatarButtonProps::default()).render_to_html();
        assert!(html.contains(r#"class="s-user-avatar""#), "{html}");
        assert!(html.contains(">?<"), "{html}");
    }

    #[test]
    fn avatar_button_styles_are_empty_because_geometry_is_chrome() {
        // No HkAvatarButton.scss exists (W2a): the trigger's geometry is the
        // `vue-admin-tokens` chrome registered once by `register_vue_chrome`,
        // so the component itself must contribute no CSS.
        assert_eq!(AvatarButtonComponent::styles(), "");
        assert_eq!(AvatarButtonComponent::name(), "avatar-button");
    }
}
