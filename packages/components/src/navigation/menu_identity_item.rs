// hi-components/src/navigation/menu_identity_item.rs
// MenuIdentityItem — mirror of the canonical Vue `HkMenuIdentityItem`: the
// standard menu identity row. An avatar (image URL, with a letter fallback)
// beside name/subtitle and an optional badges run, sharing the nav row's
// padding constraint so it lines up with `HkMenuActionItem` rows and the nav
// items above (see `HkMenuPanel`).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkMenuIdentityItem.scss`, vendored under
// `src/styles/vue-mirror/` and listed in the mirror manifest), compiled with
// `no_hash` so the `.hk-menu-identity-item*` class names are literal and
// identical in both forms. DOM contract (mirrors the Vue render output):
//
//   div.hk-menu-identity-item [role=presentation]
//     div.hk-menu-identity-item__avatar aria-hidden=true
//       img.hk-menu-identity-item__img [src] [alt]      (avatar_url truthy)
//       | span.hk-menu-identity-item__fallback {initial}
//     div.hk-menu-identity-item__text
//       span.hk-menu-identity-item__name?               (name truthy)
//       span.hk-menu-identity-item__subtitle?           (subtitle truthy)
//       div.hk-menu-identity-item__badges?              (#badges slot given)
//
// Vue prop mapping: `avatarUrl` → [`MenuIdentityItemProps::avatar_url`],
// `name`/`subtitle`/`avatarAlt` → the like-named fields (all default `""`),
// the `#badges` slot → [`MenuIdentityItemProps::badges`]. The slot WRAPPER
// renders whenever the slot was provided (Vue: `slots.badges && <div …>`),
// even when its content is empty — `Some(empty)` keeps the padded band,
// exactly like a provided-but-empty Vue slot.
//
// Vue truthiness ports: an EMPTY string is falsy for `avatarUrl` (fallback
// letter renders), for `name`/`subtitle` (the span is omitted), and for the
// img `alt` (`props.avatarAlt || props.name` — an empty `avatarAlt` falls
// back to `name`).
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * the fallback letter takes the name's first CHAR, uppercased
//     ([`menu_identity_fallback_initial`]); JavaScript's `charAt(0)` reads a
//     UTF-16 code unit, so an astral name (an emoji) yields its surrogate's
//     uppercasing in Vue and the full character here — a Rust `char` is one
//     scalar, the letter itself.
//   * NO INTERACTION: the Vue row is `role="presentation"` with no listeners,
//     so the mirror binds none (the wave's mouse-family rule has nothing to
//     bind here).

// These kernels are line-for-line ports of the upstream JS math: the negated
// comparisons, manual clamps and inline tuple types keep the port auditable
// against the source, so the idiomatic-rewrite lints are off here.
#![allow(clippy::neg_cmp_op_on_partial_ord)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::type_complexity)]
#![allow(clippy::too_many_arguments)]
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct MenuIdentityItemComponent;

/// Vue's fallback letter: `(props.name || "?").charAt(0).toUpperCase()` — an
/// unnamed row shows `"?"`, a named one shows its first character uppercased
/// (Rust's `char::to_uppercase` may expand, e.g. `"ß"` → `"SS"`, exactly like
/// JavaScript's `String.prototype.toUpperCase`).
pub fn menu_identity_fallback_initial(name: &str) -> String {
    let initial = name.chars().next().unwrap_or('?');
    initial.to_uppercase().collect()
}

/// Vue's img `alt`: `props.avatarAlt || props.name` — an empty `avatarAlt`
/// falls back to the name (and an empty name stays empty, Vue's `"" || ""`).
pub fn menu_identity_img_alt(avatar_alt: &str, name: &str) -> String {
    if avatar_alt.is_empty() {
        name.to_string()
    } else {
        avatar_alt.to_string()
    }
}

#[define_props]
pub struct MenuIdentityItemProps {
    /// Avatar image URL; empty renders the letter fallback (Vue: `avatarUrl`).
    pub avatar_url: String,

    /// Primary line (Vue: `name`, default `""`).
    pub name: String,

    /// Secondary line under the name — login email, department… (Vue:
    /// `subtitle`, default `""`).
    pub subtitle: String,

    /// Accessible label for the avatar image; empty falls back to `name`
    /// (Vue: `avatarAlt`, default `""`).
    pub avatar_alt: String,

    /// The badges run (Vue: the `#badges` slot). `Some(..)` renders the
    /// wrapper band even when the element is empty, exactly a provided Vue
    /// slot.
    pub badges: Option<Element>,
}

#[component]
pub fn MenuIdentityItem(props: MenuIdentityItemProps) -> Element {
    // Vue truthiness: empty strings are falsy for every branch below.
    let has_avatar = !props.avatar_url.is_empty();
    let name_text = props.name.clone();
    let has_name = !name_text.is_empty();
    let subtitle = props.subtitle.clone();
    let has_subtitle = !subtitle.is_empty();
    let badges = props.badges.clone();

    rsx! {
        div {
            class: "hk-menu-identity-item",
            "role": "presentation",
            div {
                class: "hk-menu-identity-item__avatar",
                "aria-hidden": "true",
                if has_avatar {
                    img {
                        class: "hk-menu-identity-item__img",
                        src: props.avatar_url.clone(),
                        alt: menu_identity_img_alt(&props.avatar_alt, &props.name),
                    }
                } else {
                    span {
                        class: "hk-menu-identity-item__fallback",
                        {menu_identity_fallback_initial(&props.name)}
                    }
                }
            }
            div {
                class: "hk-menu-identity-item__text",
                if has_name {
                    span { class: "hk-menu-identity-item__name", {name_text} }
                }
                if has_subtitle {
                    span { class: "hk-menu-identity-item__subtitle", {subtitle} }
                }
                if let Some(badges) = badges {
                    div { class: "hk-menu-identity-item__badges", {badges} }
                }
            }
        }
    }
}

impl StyledComponent for MenuIdentityItemComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-menu-identity-item*` names literal so this CSS matches the
        // Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkMenuIdentityItem.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "menu-identity-item"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn menu_identity_defaults_match_the_vue_props() {
        let props = MenuIdentityItemProps::default();
        assert_eq!(props.avatar_url, "");
        assert_eq!(props.name, "");
        assert_eq!(props.subtitle, "");
        assert_eq!(props.avatar_alt, "");
        assert!(props.badges.is_none());
    }

    #[test]
    fn menu_identity_fallback_initial_follows_vue() {
        // Vue: `(props.name || "?").charAt(0).toUpperCase()`.
        assert_eq!(menu_identity_fallback_initial(""), "?");
        assert_eq!(menu_identity_fallback_initial("ada lovelace"), "A");
        assert_eq!(menu_identity_fallback_initial("河豚"), "河");
        // Both engines expand the sharp s: JS `"ß".toUpperCase()` is "SS".
        assert_eq!(menu_identity_fallback_initial("ß"), "SS");
    }

    #[test]
    fn menu_identity_img_alt_falls_back_to_the_name() {
        assert_eq!(menu_identity_img_alt("", "Ada"), "Ada");
        assert_eq!(menu_identity_img_alt("Portrait", "Ada"), "Portrait");
        // Vue's `"" || ""` — an all-empty row ships an empty alt.
        assert_eq!(menu_identity_img_alt("", ""), "");
    }

    #[test]
    fn menu_identity_renders_the_vue_contract_with_an_avatar() {
        let html = MenuIdentityItem(MenuIdentityItemProps {
            avatar_url: "https://img/ada.png".to_string(),
            name: "Ada".to_string(),
            subtitle: "ada@celestia.world".to_string(),
            avatar_alt: "Portrait".to_string(),
            badges: Some(rsx! { span { "PRO" } }),
        })
        .render_to_html();

        for needle in [
            r#"class="hk-menu-identity-item""#,
            r#"role="presentation""#,
            r#"class="hk-menu-identity-item__avatar""#,
            r#"aria-hidden="true""#,
            r#"class="hk-menu-identity-item__img""#,
            r#"src="https://img/ada.png""#,
            r#"alt="Portrait""#,
            r#"class="hk-menu-identity-item__text""#,
            r#"class="hk-menu-identity-item__name">Ada<"#,
            r#"class="hk-menu-identity-item__subtitle">ada@celestia.world<"#,
            r#"class="hk-menu-identity-item__badges""#,
            ">PRO<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The image branch renders no fallback letter.
        assert!(!html.contains("hk-menu-identity-item__fallback"), "{html}");
    }

    #[test]
    fn menu_identity_renders_the_fallback_letter_without_an_avatar() {
        let html = MenuIdentityItem(MenuIdentityItemProps {
            name: "ada".to_string(),
            // Provided-but-empty badges keep the (padded) wrapper band.
            badges: Some(empty_vnode()),
            ..Default::default()
        })
        .render_to_html();

        assert!(
            html.contains(r#"class="hk-menu-identity-item__fallback">A<"#),
            "{html}"
        );
        // alt only exists on the img branch.
        assert!(!html.contains("alt="), "{html}");
        // A set name renders its span (Vue's `props.name &&` arm);
        // no subtitle → no subtitle span.
        assert!(
            html.contains(r#"class="hk-menu-identity-item__name">ada<"#),
            "{html}"
        );
        assert!(!html.contains("hk-menu-identity-item__subtitle"), "{html}");
        // …and a provided badges slot keeps its wrapper.
        assert!(html.contains("hk-menu-identity-item__badges"), "{html}");
    }

    #[test]
    fn menu_identity_styles_come_from_the_canonical_vue_sheet() {
        let css = MenuIdentityItemComponent::styles();
        for class in [
            ".hk-menu-identity-item",
            ".hk-menu-identity-item__avatar",
            ".hk-menu-identity-item__img",
            ".hk-menu-identity-item__fallback",
            ".hk-menu-identity-item__text",
            ".hk-menu-identity-item__name",
            ".hk-menu-identity-item__subtitle",
            ".hk-menu-identity-item__badges",
        ] {
            assert!(
                css.contains(class),
                "menu-identity-item css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored menu-identity-item sheet"
        );
        assert_eq!(MenuIdentityItemComponent::name(), "menu-identity-item");
    }
}
