// hi-components/src/auth/alt_sign_in.rs
// AltSignIn — mirror of the canonical Vue `HkAltSignIn`: the shared
// "alternative sign-in" disclosure inside auth cards (platform passkey,
// third-party OAuth, …). A muted trigger row that opens a menu of provider
// entries, so every auth surface offers the same affordance and differs only
// in content.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkAltSignIn.scss`, vendored byte-identically
// under `src/styles/vue-mirror/components/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-alt-signin*` class names are literal and identical in both forms. The
// ROW grammar is not this sheet's: it is the shared menu-item spec
// (`components/_menu-item.scss`, reached through the registered
// `vue-hk-menu` chrome), which Vue uses by composing `HkMenuActionItem`.
//
// DOM contract (attribute-for-attribute with `HkAltSignIn.tsx` +
// `HkMenuActionItem.tsx`):
//
//   div.hk-alt-signin                       [host class]
//     button.hk-alt-signin__trigger
//            type="button" aria-haspopup="menu" aria-expanded="true|false"
//            [disabled]
//       span.hk-alt-signin__rule            (decorative leading rule)
//       span.hk-alt-signin__label           {label}
//       span.hk-alt-signin__rule            (decorative trailing rule)
//     div.hk-alt-signin__panel              (only while open)
//            role="menu"
//       button.hk-menu-action-item [.hk-menu-action-item--danger]
//              type="button" role="menuitem" [data-danger="true"]
//         span.hk-menu-action-item__icon    (entry icon, when given)
//         span.hk-menu-action-item__label   {entry label}
//
// Vue prop mapping: `label` (required in Vue) → [`AltSignInProps::label`]
// (`None` falls back to the `components.hk.altSignIn.label` locale string),
// `entries` → [`AltSignInProps::providers`] ([`AltSignInProvider`]), the
// `select(key)` emit → [`AltSignInProps::on_select`].
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * `open` is a controlled prop plus [`AltSignInProps::on_open_change`];
//     Vue keeps it in a local `ref(false)` and re-emits it through
//     `HkPopover`'s `v-model`. The mirror holds no component state (L48 —
//     props only), so the host owns the disclosure. `choose(key)` keeps Vue's
//     order: close first, then select.
//   * NO FLOATING LAYER. Vue renders the panel through `HkPopover`, which
//     measures its trigger (`anchorRef`) and positions a fixed layer, flipping
//     sides and turning into a bottom sheet on mobile. tairitsu 0.5.22 has no
//     per-instance element ref + measurement pass a render-time mirror could
//     use, so `.hk-alt-signin__panel` renders IN FLOW directly under the
//     trigger (its sheet is a flex column, `min-width: 12rem`). Consequences,
//     all documented rather than silent: the `placement` prop is not carried
//     (it would have nothing to place), and there is no scrim, backdrop or
//     outside-click close — the host closes the panel (`on_open_change(false)`,
//     e.g. from its own blur/outside handler) exactly as it opens it.
//   * the entry ICON is an `Element` (the Rust icon set is a typed enum with
//     no runtime name registry), mirroring `basic/button.rs`'s `icon` slot
//     delta; Vue types it as a loose object and renders it into the same
//     `.hk-menu-action-item__icon` cell.
//   * entries are rendered verbatim: no filtering, no re-keying, no
//     disabled state (Vue passes none of those through either). `danger` maps
//     to the strict `entry.danger === true` test, i.e. the crate's `bool`.
//
// i18n: Vue deliberately takes `label` from the consumer ("hikari ships no
// dictionary dependency onto hosts here"); the mirror keeps that contract and
// only supplies a locale fallback for the required-but-absent case.

use hikari_i18n::t;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AltSignInComponent;

/// One alternative sign-in entry (Vue: `HkAltSignInEntry`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct AltSignInProvider {
    /// Stable selection key reported through `on_select` (Vue: `key`).
    pub key: String,

    /// Row label (Vue: `label`).
    pub label: String,

    /// Leading glyph (Vue: `icon`), rendered inside the spec's icon cell.
    pub icon: Option<Element>,

    /// Destructive styling (Vue: `danger`, `=== true`).
    pub danger: bool,
}

impl AltSignInProvider {
    /// A labelled entry with no icon and no danger styling.
    pub fn new(key: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            label: label.into(),
            icon: None,
            danger: false,
        }
    }

    /// Vue: `danger={entry.danger === true}`.
    pub fn with_danger(mut self, danger: bool) -> Self {
        self.danger = danger;
        self
    }

    /// Vue: `icon={entry.icon}`.
    pub fn with_icon(mut self, icon: Element) -> Self {
        self.icon = Some(icon);
        self
    }

    /// The danger flag (Vue: `entry.danger === true`).
    pub fn is_danger(&self) -> bool {
        self.danger
    }
}

/// The trigger caption fallback (Vue: `label` is required and
/// consumer-localized; see the file header note).
pub fn alt_sign_in_label(explicit: Option<&str>) -> String {
    explicit
        .map(str::to_string)
        .unwrap_or_else(|| t("components.hk.altSignIn.label", "Other sign-in options"))
}

/// The trigger's `aria-expanded` token (Vue: `aria-expanded={open}` — a
/// boolean attribute serialized as the string).
pub fn alt_sign_in_expanded(open: bool) -> &'static str {
    if open { "true" } else { "false" }
}

/// Vue: the trigger toggles only while enabled (`if (!props.disabled)`).
pub fn alt_sign_in_can_toggle(disabled: bool) -> bool {
    !disabled
}

/// The value a trigger click asks for: Vue's `open.value = !open.value`.
pub fn alt_sign_in_next_open(open: bool) -> bool {
    !open
}

/// The row class list, exactly `HkMenuActionItem`'s computed (the danger
/// modifier is appended only for a destructive entry).
pub fn alt_sign_in_row_classes(danger: bool) -> &'static str {
    if danger {
        "hk-menu-action-item hk-menu-action-item--danger"
    } else {
        "hk-menu-action-item"
    }
}

/// Resolve a selection key back to its provider. Vue captures the key in the
/// row's own closure, so it never needs this lookup; the mirror exposes it for
/// hosts that receive the key later (an async or persisted selection) and must
/// reject a key whose provider left the list. Unknown keys yield `None`; the
/// first match wins.
pub fn alt_sign_in_resolve<'a>(
    providers: &'a [AltSignInProvider],
    key: &str,
) -> Option<&'a AltSignInProvider> {
    providers.iter().find(|provider| provider.key == key)
}

#[define_props]
pub struct AltSignInProps {
    /// Trigger caption (Vue: `label`, required); `None` uses the locale
    /// string.
    pub label: Option<String>,

    /// The provider list (Vue: `entries`, required). Rendered in order.
    pub providers: Vec<AltSignInProvider>,

    /// Controlled disclosure state (Vue: the local `open` ref). The panel
    /// renders only while true.
    #[default]
    pub open: bool,

    /// Disables the trigger row (Vue: `disabled`).
    #[default]
    pub disabled: bool,

    /// Disclosure change request — the trigger asks for the opposite of
    /// [`AltSignInProps::open`], and a row selection asks for `false` (Vue:
    /// `open.value = !open.value` / `choose()`'s close-then-select).
    pub on_open_change: Option<EventHandler<bool>>,

    /// A provider was chosen (Vue: the `select(key)` emit).
    pub on_select: Option<EventHandler<String>>,

    /// Host class, appended to the `.hk-alt-signin` root (Vue falls
    /// `attrs.class` through to the root element).
    #[default]
    pub class: String,
}

#[component]
pub fn AltSignIn(props: AltSignInProps) -> Element {
    let label = alt_sign_in_label(props.label.as_deref());
    let expanded = alt_sign_in_expanded(props.open);
    let can_toggle = alt_sign_in_can_toggle(props.disabled);
    let next_open = alt_sign_in_next_open(props.open);
    let disabled = props.disabled;
    let open = props.open;

    let mut root_classes = String::from("hk-alt-signin");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    let toggle = {
        let on_open_change = props.on_open_change.clone();
        move |_: MouseEvent| {
            if can_toggle && let Some(handler) = on_open_change.as_ref() {
                handler.call(next_open);
            }
        }
    };

    // ── the entry rows (Vue: one `HkMenuActionItem` per entry) ─────────────
    let mut rows: Vec<VNode> = Vec::with_capacity(props.providers.len());
    for provider in &props.providers {
        let key = provider.key.clone();
        let row_label = provider.label.clone();
        let icon = provider.icon.clone();
        let row_classes = alt_sign_in_row_classes(provider.is_danger());
        // Vue: `data-danger={danger || undefined}` — a presence attribute.
        let data_danger = if provider.is_danger() {
            Some("true")
        } else {
            None
        };
        let select = props.on_select.clone();
        let close = props.on_open_change.clone();
        rows.push(rsx! {
            button {
                "type": "button",
                class: row_classes,
                "role": "menuitem",
                "data-danger": data_danger,
                onclick: move |_: MouseEvent| {
                    // Vue's `choose(key)`: close the popover, then emit the
                    // selection.
                    if let Some(handler) = close.as_ref() {
                        handler.call(false);
                    }
                    if let Some(handler) = select.as_ref() {
                        handler.call(key.clone());
                    }
                },
                if let Some(icon) = icon {
                    span { class: "hk-menu-action-item__icon", {icon} }
                }
                span { class: "hk-menu-action-item__label", "{row_label}" }
            }
        });
    }

    rsx! {
        div { class: root_classes,
            button {
                "type": "button",
                class: "hk-alt-signin__trigger",
                "aria-haspopup": "menu",
                "aria-expanded": expanded,
                disabled: disabled,
                onclick: toggle,
                span { class: "hk-alt-signin__rule" }
                span { class: "hk-alt-signin__label", "{label}" }
                span { class: "hk-alt-signin__rule" }
            }
            if open {
                div { class: "hk-alt-signin__panel", "role": "menu",
                    {VNode::Fragment(rows)}
                }
            }
        }
    }
}

impl StyledComponent for AltSignInComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-alt-signin*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkAltSignIn.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "alt-sign-in"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn providers() -> Vec<AltSignInProvider> {
        vec![
            AltSignInProvider::new("passkey", "Sign in with a passkey"),
            AltSignInProvider::new("feishu", "Feishu").with_danger(true),
        ]
    }

    #[test]
    fn alt_sign_in_defaults_match_the_vue_props() {
        let props = AltSignInProps::default();
        // Vue requires `label`; the mirror defaults it to the locale string.
        assert_eq!(props.label, None);
        assert_eq!(
            alt_sign_in_label(props.label.as_deref()),
            "Other sign-in options"
        );
        assert!(props.providers.is_empty());
        // Vue: `open` starts closed, `disabled` false.
        assert!(!props.open);
        assert!(!props.disabled);
        assert!(props.on_open_change.is_none());
        assert!(props.on_select.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn alt_sign_in_row_classes_match_the_menu_action_item() {
        // HkMenuActionItem's computed: the base class, then the danger
        // modifier only for a destructive entry.
        assert_eq!(alt_sign_in_row_classes(false), "hk-menu-action-item");
        assert_eq!(
            alt_sign_in_row_classes(true),
            "hk-menu-action-item hk-menu-action-item--danger"
        );
        // The provider carries the strict `danger === true` test.
        let plain = AltSignInProvider::new("passkey", "Passkey");
        assert!(!plain.is_danger());
        assert_eq!(
            alt_sign_in_row_classes(plain.is_danger()),
            "hk-menu-action-item"
        );
        let dangerous = AltSignInProvider::new("feishu", "Feishu").with_danger(true);
        assert!(dangerous.is_danger());
        assert!(
            alt_sign_in_row_classes(dangerous.is_danger()).contains("hk-menu-action-item--danger")
        );
    }

    #[test]
    fn alt_sign_in_resolves_a_provider_by_key() {
        let list = providers();
        let resolved = alt_sign_in_resolve(&list, "feishu").expect("known key");
        assert_eq!(resolved.label, "Feishu");
        assert!(resolved.is_danger());
        assert_eq!(
            alt_sign_in_resolve(&list, "passkey").map(|p| p.label.as_str()),
            Some("Sign in with a passkey")
        );
        // A key whose provider left the list is rejected, not guessed.
        assert!(alt_sign_in_resolve(&list, "github").is_none());
        assert!(alt_sign_in_resolve(&[], "passkey").is_none());
        // First match wins (the Vue list is keyed by the consumer, not us).
        let duplicated = vec![
            AltSignInProvider::new("dup", "First"),
            AltSignInProvider::new("dup", "Second"),
        ];
        assert_eq!(
            alt_sign_in_resolve(&duplicated, "dup").map(|p| p.label.as_str()),
            Some("First")
        );
    }

    #[test]
    fn alt_sign_in_trigger_state_matches_the_vue_expressions() {
        // Vue: `aria-expanded={open}` serialized as a token.
        assert_eq!(alt_sign_in_expanded(false), "false");
        assert_eq!(alt_sign_in_expanded(true), "true");
        // Vue: `if (!props.disabled) open.value = !open.value`.
        assert!(alt_sign_in_can_toggle(false));
        assert!(!alt_sign_in_can_toggle(true));
        assert!(alt_sign_in_next_open(false));
        assert!(!alt_sign_in_next_open(true));
        // The caption falls back to the locale string, and an explicit empty
        // caption is preserved (nullish, like Vue's prop default).
        assert_eq!(
            alt_sign_in_label(Some("Other ways to sign in")),
            "Other ways to sign in"
        );
        assert_eq!(alt_sign_in_label(Some("")), "");
    }

    #[test]
    fn alt_sign_in_renders_the_vue_dom_contract() {
        // Closed: the trigger row only — no panel, no rows, no dead markup.
        let html = AltSignIn(AltSignInProps {
            label: Some("Other ways to sign in".to_string()),
            providers: providers(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="hk-alt-signin""#), "{html}");
        assert!(html.contains(r#"class="hk-alt-signin__trigger""#), "{html}");
        assert!(html.contains(r#"type="button""#), "{html}");
        assert!(html.contains(r#"aria-haspopup="menu""#), "{html}");
        assert!(html.contains(r#"aria-expanded="false""#), "{html}");
        assert!(html.contains("hk-alt-signin__label"), "{html}");
        assert!(html.contains("Other ways to sign in"), "{html}");
        // Two decorative rules flank the label (one focusable button only).
        assert_eq!(
            html.matches(r#"class="hk-alt-signin__rule""#).count(),
            2,
            "{html}"
        );
        assert!(!html.contains("hk-alt-signin__panel"), "{html}");
        assert!(!html.contains("hk-menu-action-item"), "{html}");

        // Open: the panel carries the rows, each speaking the menu-item spec.
        let html = AltSignIn(AltSignInProps {
            open: true,
            providers: providers(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"aria-expanded="true""#), "{html}");
        assert!(html.contains("hk-alt-signin__panel"), "{html}");
        assert!(html.contains(r#"role="menu""#), "{html}");
        assert_eq!(html.matches(r#"role="menuitem""#).count(), 2, "{html}");
        assert!(html.contains("Sign in with a passkey"), "{html}");
        assert!(html.contains("Feishu"), "{html}");
        assert!(html.contains("hk-menu-action-item__label"), "{html}");
        // The danger entry alone carries the modifier and the marker.
        assert_eq!(
            html.matches("hk-menu-action-item--danger").count(),
            1,
            "{html}"
        );
        assert_eq!(html.matches(r#"data-danger="true""#).count(), 1, "{html}");
        // No icon was given, so no icon cell is emitted.
        assert!(!html.contains("hk-menu-action-item__icon"), "{html}");

        // Disabled trigger keeps its row content but is not clickable.
        let html = AltSignIn(AltSignInProps {
            disabled: true,
            label: Some("Other ways to sign in".to_string()),
            class: "host-class".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains(r#"class="hk-alt-signin host-class""#),
            "{html}"
        );
        assert!(html.contains(r#"disabled="disabled""#), "{html}");

        // An entry icon renders inside the spec's icon cell.
        let html = AltSignIn(AltSignInProps {
            open: true,
            providers: vec![
                AltSignInProvider::new("passkey", "Passkey").with_icon(rsx! {
                    span { class: "test-glyph" }
                }),
            ],
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains(r#"class="hk-menu-action-item__icon""#),
            "{html}"
        );
        assert!(html.contains(r#"class="test-glyph""#), "{html}");
    }

    #[test]
    fn alt_sign_in_styles_come_from_the_canonical_vue_sheet() {
        let css = AltSignInComponent::styles();
        for class in [
            ".hk-alt-signin",
            ".hk-alt-signin__trigger",
            ".hk-alt-signin__rule",
            ".hk-alt-signin__label",
            ".hk-alt-signin__panel",
        ] {
            assert!(
                css.contains(class),
                "alt-sign-in css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored alt sign-in sheet"
        );
        // The row grammar is the SHARED menu-item spec, not this sheet's.
        assert!(
            !css.contains(".hk-menu-action-item"),
            "the row spec must come from the shared menu-item sheet"
        );
        assert_eq!(AltSignInComponent::name(), "alt-sign-in");
    }
}
