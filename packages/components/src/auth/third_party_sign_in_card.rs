// hi-components/src/auth/third_party_sign_in_card.rs
// ThirdPartySignInCard — mirror of the canonical Vue `HkThirdPartySignInCard`:
// the passwordless sign-in card, i.e. the auth shell whose PRIMARY AND ONLY
// body content is the third-party provider row.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkThirdPartySignInCard.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the two seam classes
// (`.s-auth-third-party-body`, and the tile bump scoped through it) are
// literal and identical in both forms. NO SHELL IS RE-IMPLEMENTED where a
// mirror already exists — exactly the Vue composition:
//   * the card frame/header/body/footer IS the mirrored `AuthCard`
//     (`auth/auth_card.rs`, Vue's `HkAuthCard`),
//   * the provider row IS the mirrored `AuthMethodList`
//     (`auth/auth_method_list.rs`, Vue's `HkAuthMethodList`).
// The DOM contract (mirrors the Vue render output one-to-one):
//
//   div.s-auth-card-height                          (AuthCard wrapper)
//     div.s-auth-card
//       div.s-auth-header
//         {logo} | img.hk-logo-img [src]            (logo slot / logoSrc)
//         h1.s-auth-title                            {title}
//         p.s-auth-subtitle                          {subtitle, when set}
//       div.s-auth-form
//         {top}                                      (Vue: the `top` slot)
//         div.s-auth-methods.s-auth-third-party-body
//           div.s-auth-methods-list                  (AuthMethodList: the row)
//             div.s-auth-methods-divider?            (the forwarded `divider`)
//             div.s-auth-methods-tiles
//               span.hk-tooltip-wrapper > button.s-auth-methods-tile  ×N
//       div.s-auth-footer                            (Vue: the `footer` slot)
//         {footer}
//
// Prop mapping: `title` → [`ThirdPartySignInCardProps::title`] (required in
// Vue, `""` here), `subtitle`, `logoSrc` → `logo_src`, `loading`,
// `divider` (forwarded to the list, consumer-localized on purpose), `methods`
// → [`HkAuthMethodEntry`] (exactly `HkAuthMethodList`'s entry contract — one
// shape for both cards), the `select` emit → `on_select` (carries the method
// `key`; the host binds it to the OAuth redirect/popup), the `top` / `footer`
// / `logo` slots → the same three `Element` props.
//
// The body wrapper carries BOTH classes, like Vue: `s-auth-methods` is the
// container the list's scoped rules resolve against (tile-row centering,
// tooltip-wrapper sizing) and `s-auth-third-party-body` re-positions it as the
// card body (zeroed margin/padding, centered, tiles one size step up).
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * **`loading` still maps onto each entry's own disabled bit** (an entry's
//     own bit survives — OR, not replace), which is Vue's mapping; the list
//     therefore renders dead tiles that swallow clicks during the OAuth hop.
//   * `logoSrc` renders Vue's `<img class="hk-logo-img">` with the same inline
//     3.5rem box; `HkLogo.scss` is not part of this wave's mirrored set, so
//     the inline size (not the sheet) is what sizes the glyph and the class's
//     polish (block display, radius, `object-fit`) is absent — the exact delta
//     `auth/sign_in_card.rs` documents for the sibling card.
//   * the `footer` slot is forwarded ONLY when the host passes one (Vue's
//     `footer: () => slots.footer?.()` hands `HkAuthCard` a footer function
//     unconditionally, painting an empty padded band on every footer-less card
//     — the wart `auth/sign_in_card.rs` documents and drops).
//   * `AuthCard`'s own documented inert `smoothHeight` delta applies: the
//     `.s-auth-card-height` wrapper renders, but no height is seeded, so a
//     body-height change snaps instead of animating.
//   * the card is consumer-localized exactly like Vue: `title`, `subtitle` and
//     `divider` carry no dictionary, so this file adds no `hikari_i18n` keys.

use crate::auth::auth_card::{AuthCard, AuthCardProps};
// `AuthMethodListProps` is imported for the `rsx!` call site: the macro expands
// a component tag into `AuthMethodList(AuthMethodListProps { … })`, and the
// crate prelude carries no `auth` Props struct (this module is newer than it).
use crate::auth::auth_method_list::{AuthMethodList, AuthMethodListProps, HkAuthMethodEntry};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ThirdPartySignInCardComponent;

/// The two class hooks this card itself emits (the shell classes belong to
/// [`AuthCard`], the row classes to [`AuthMethodList`]).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ThirdPartySignInCardClass {
    /// The methods container promoted to card body — BOTH classes, one
    /// attribute, exactly Vue's
    /// `class="s-auth-methods s-auth-third-party-body"`.
    Body,
    /// The header logo image (Vue: `HkLogo` / `img.hk-logo-img`).
    Logo,
}

impl ThirdPartySignInCardClass {
    /// The class(es) exactly as the Vue sheets spell them.
    pub fn class_name(self) -> &'static str {
        match self {
            ThirdPartySignInCardClass::Body => "s-auth-methods s-auth-third-party-body",
            ThirdPartySignInCardClass::Logo => "hk-logo-img",
        }
    }
}

/// Vue's loading mapping: an in-flight OAuth hop marks EVERY entry dead while
/// each entry's own `disabled` bit survives (the OR of the two, never a
/// replacement) — the list itself then renders dead, click-swallowing tiles.
pub fn third_party_tile_disabled(entry_disabled: bool, loading: bool) -> bool {
    entry_disabled || loading
}

/// The provider list as the body renders it: the entries themselves while
/// idle, the same entries with their disabled bit forced on while loading
/// (Vue: `props.methods.map(method => ({ ...method, disabled: true }))`).
pub fn third_party_methods(methods: &[HkAuthMethodEntry], loading: bool) -> Vec<HkAuthMethodEntry> {
    methods
        .iter()
        .map(|method| HkAuthMethodEntry {
            disabled: third_party_tile_disabled(method.disabled, loading),
            ..method.clone()
        })
        .collect()
}

/// Vue's `props.subtitle && …` truthiness: an empty subtitle renders no `p`
/// (`AuthCard` reads the same rule on its `Option`).
pub fn third_party_subtitle_text(subtitle: &str) -> Option<String> {
    if subtitle.is_empty() {
        None
    } else {
        Some(subtitle.to_string())
    }
}

/// Vue's `props.logoSrc ? <img …/> : null` truthiness: only a non-empty source
/// renders the header image.
pub fn third_party_logo_src(logo_src: Option<&str>) -> Option<String> {
    logo_src
        .map(str::trim)
        .filter(|src| !src.is_empty())
        .map(str::to_string)
}

#[define_props]
pub struct ThirdPartySignInCardProps {
    /// Card title (Vue: `title`, required there — `""` renders an empty `h1`
    /// rather than panicking here).
    #[default]
    pub title: String,

    /// Card subtitle; an empty string renders no line (Vue's `subtitle`
    /// default is `""`).
    #[default]
    pub subtitle: String,

    /// Header logo URL (Vue: `logoSrc`); the `logo` slot wins over it.
    pub logo_src: Option<String>,

    /// Header logo slot (Vue: the `logo` slot); wins over
    /// [`ThirdPartySignInCardProps::logo_src`], exactly like Vue.
    pub logo: Option<Element>,

    /// External in-flight state: every tile renders dead for the duration.
    #[default]
    pub loading: bool,

    /// Divider text above the row, forwarded to the list (consumer-localized
    /// on purpose, like Vue).
    #[default]
    pub divider: String,

    /// Provider entries in render order (Vue: `methods`, required there).
    #[default]
    pub methods: Vec<HkAuthMethodEntry>,

    /// Content between the header and the tiles (Vue: the `top` slot — channel
    /// tabs and similar; there is no `<form>` to keep it out of).
    pub top: Option<Element>,

    /// Centered footer rows (Vue: the `footer` slot — remember-me / protocol
    /// rows).
    pub footer: Option<Element>,

    /// A provider tile was pressed; carries the method `key` (Vue: the
    /// `select` emit). The host binds this to the OAuth redirect/popup.
    pub on_select: Option<EventHandler<String>>,
}

/// The header logo node: the slot first, Vue's `logoSrc` image second, nothing
/// third.
fn third_party_logo_node(logo: Option<Element>, logo_src: Option<&str>) -> Option<Element> {
    if let Some(logo) = logo {
        return Some(logo);
    }
    third_party_logo_src(logo_src).map(|src| {
        rsx! {
            img {
                class: ThirdPartySignInCardClass::Logo.class_name(),
                src: src,
                alt: "",
                style: "width:3.5rem;height:3.5rem",
            }
        }
    })
}

#[component]
pub fn ThirdPartySignInCard(props: ThirdPartySignInCardProps) -> Element {
    let body_methods = third_party_methods(&props.methods, props.loading);
    let on_select = props.on_select.clone();

    // Vue's default slot: the `top` slot, then the methods block promoted to
    // the card body. `AuthCard` renders this inside `.s-auth-form`, which is
    // what lets the sheet's `.s-auth-form .s-auth-third-party-body` seam (and
    // the list's `.s-auth-methods`-scoped rules) resolve.
    let mut body: Vec<VNode> = Vec::with_capacity(2);
    if let Some(top) = props.top.clone() {
        body.push(top);
    }
    body.push(rsx! {
        div {
            class: ThirdPartySignInCardClass::Body.class_name(),
            AuthMethodList {
                divider: props.divider.clone(),
                methods: body_methods,
                on_select: on_select,
            }
        }
    });

    AuthCard(AuthCardProps {
        title: props.title.clone(),
        subtitle: third_party_subtitle_text(&props.subtitle),
        logo: third_party_logo_node(props.logo.clone(), props.logo_src.as_deref()),
        children: VNode::Fragment(body),
        footer: props.footer.clone(),
        ..Default::default()
    })
}

impl StyledComponent for ThirdPartySignInCardComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.s-auth-third-party-body` seam literal so this CSS matches Vue).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkThirdPartySignInCard.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "third-party-sign-in-card"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(key: &str, label: &str) -> HkAuthMethodEntry {
        HkAuthMethodEntry::new(key, label)
    }

    #[test]
    fn third_party_class_names_match_the_sheets() {
        // The body carries BOTH classes in one attribute, like Vue.
        assert_eq!(
            ThirdPartySignInCardClass::Body.class_name(),
            "s-auth-methods s-auth-third-party-body"
        );
        assert_eq!(ThirdPartySignInCardClass::Logo.class_name(), "hk-logo-img");
    }

    #[test]
    fn third_party_defaults_match_the_vue_props() {
        let props = ThirdPartySignInCardProps::default();
        assert_eq!(props.title, "");
        assert_eq!(props.subtitle, "");
        assert!(props.logo_src.is_none());
        assert!(props.logo.is_none());
        assert!(!props.loading);
        assert_eq!(props.divider, "");
        assert!(props.methods.is_empty());
        assert!(props.top.is_none());
        assert!(props.footer.is_none());
        assert!(props.on_select.is_none());
    }

    #[test]
    fn third_party_loading_is_an_or_rule_on_each_entry() {
        assert!(!third_party_tile_disabled(false, false));
        assert!(third_party_tile_disabled(true, false));
        assert!(third_party_tile_disabled(false, true));
        // An entry's own bit survives the loading pass (OR, never replace).
        assert!(third_party_tile_disabled(true, true));

        let methods = vec![entry("feishu", "Feishu"), entry("github", "GitHub")];
        let idle = third_party_methods(&methods, false);
        assert_eq!(idle, methods);
        let busy = third_party_methods(&methods, true);
        assert!(busy.iter().all(|method| method.disabled));
        // Everything but the disabled bit is untouched by the mapping.
        assert_eq!(busy[0].key, "feishu");
        assert_eq!(busy[1].label, "GitHub");
        // An entry that was already dead stays dead when the hop ends.
        let dead = vec![HkAuthMethodEntry {
            disabled: true,
            ..entry("feishu", "Feishu")
        }];
        assert!(third_party_methods(&dead, false)[0].disabled);
    }

    #[test]
    fn third_party_header_gates_match_vue_truthiness() {
        assert_eq!(third_party_subtitle_text(""), None);
        assert_eq!(
            third_party_subtitle_text("Welcome back"),
            Some("Welcome back".to_string())
        );
        assert_eq!(third_party_logo_src(None), None);
        assert_eq!(third_party_logo_src(Some("")), None);
        // Whitespace is not a source either — Vue's truthiness would build a
        // broken `<img src="  ">`; the mirror trims before deciding.
        assert_eq!(third_party_logo_src(Some("   ")), None);
        assert_eq!(
            third_party_logo_src(Some("/logo.webp")),
            Some("/logo.webp".to_string())
        );
    }

    #[test]
    fn third_party_card_renders_the_vue_shell_contract() {
        let html = ThirdPartySignInCard(ThirdPartySignInCardProps {
            title: "Sign in".to_string(),
            subtitle: "Welcome back".to_string(),
            logo_src: Some("/logo.webp".to_string()),
            divider: "Or continue with".to_string(),
            methods: vec![entry("feishu", "Feishu"), entry("github", "GitHub")],
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // The composed AuthCard shell.
            r#"class="s-auth-card-height""#,
            r#"class="s-auth-card""#,
            r#"class="s-auth-header""#,
            r#"class="s-auth-title""#,
            r#"class="s-auth-subtitle""#,
            "Sign in",
            "Welcome back",
            r#"class="hk-logo-img""#,
            r#"src="/logo.webp""#,
            r#"class="s-auth-form""#,
            // The body wrapper carries both Vue classes, inside the form body.
            r#"class="s-auth-methods s-auth-third-party-body""#,
            r#"class="s-auth-methods-divider""#,
            "Or continue with",
            r#"class="s-auth-methods-tiles""#,
            r#"data-key="feishu""#,
            r#"data-key="github""#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Primary and ONLY content: no credentials form, no submit button, no
        // button-family surface (Vue's own suite pins the same three).
        assert!(!html.contains("<form"), "{html}");
        assert!(!html.contains(r#"type="submit""#), "{html}");
        assert!(!html.contains("hk-btn"), "{html}");
        // Exactly one methods block, and it IS the card body.
        assert_eq!(
            html.matches("s-auth-methods s-auth-third-party-body")
                .count(),
            1,
            "{html}"
        );
        // No footer slot → no footer band (the documented Vue-wart drop).
        assert!(!html.contains("s-auth-footer"), "{html}");
        // The body sits inside the form column, not in the methods slot.
        let form_at = html.find(r#"class="s-auth-form""#).expect("form body");
        let body_at = html.find("s-auth-third-party-body").expect("body");
        assert!(form_at < body_at, "the body belongs to the form: {html}");
    }

    #[test]
    fn third_party_card_renders_the_slot_and_loading_arms() {
        let html = ThirdPartySignInCard(ThirdPartySignInCardProps {
            title: "T".to_string(),
            loading: true,
            top: Some(rsx! {
                div { id: "top-slot", "tabs" }
            }),
            footer: Some(rsx! {
                div { class: "footer-probe", "footer" }
            }),
            logo: Some(rsx! {
                span { class: "brand-logo" }
            }),
            logo_src: Some("/ignored.webp".to_string()),
            methods: vec![entry("feishu", "Feishu")],
            ..Default::default()
        })
        .render_to_html();

        // The top slot sits in the card body, above the tiles.
        assert!(html.contains(r#"id="top-slot""#), "{html}");
        assert!(html.contains(r#"class="footer-probe""#), "{html}");
        assert!(
            html.contains(r#"class="s-auth-footer""#),
            "the footer slot gets the centered band: {html}"
        );
        // The logo slot wins over logoSrc (Vue's slot priority).
        assert!(html.contains(r#"class="brand-logo""#), "{html}");
        assert!(!html.contains("ignored.webp"), "{html}");
        // Loading forces every tile dead.
        assert!(html.contains(r#"disabled="disabled""#), "{html}");
        // … and an empty subtitle renders no line at all.
        assert!(!html.contains("s-auth-subtitle"), "{html}");
        // The top slot precedes the tile row.
        let top_at = html.find("top-slot").expect("top slot");
        let tiles_at = html.find("s-auth-methods-tiles").expect("tile row");
        assert!(top_at < tiles_at, "top slot must precede the tiles: {html}");
    }

    #[test]
    fn third_party_styles_come_from_the_canonical_vue_sheet() {
        let css = ThirdPartySignInCardComponent::styles();
        // The sheet's two seams: the body re-positioning and the tile bump.
        for needle in [
            ".s-auth-form .s-auth-third-party-body",
            "justify-content: center",
            ".s-auth-third-party-body .s-auth-methods-tile",
            "3.25rem",
        ] {
            assert!(
                css.contains(needle),
                "third-party css must carry the vue seam {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored third-party sheet"
        );
        assert_eq!(
            ThirdPartySignInCardComponent::name(),
            "third-party-sign-in-card"
        );
    }
}
