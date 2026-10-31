// hi-components/src/basic/avatar.rs
// Avatar — mirror of the canonical Vue `HkAvatar`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkAvatar.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash`.
//
//   div.hk-avatar.hk-avatar-{size}
//     img[src alt={name}]                 (when `src` is set)
//     span.hk-avatar-fallback  {initial}  (otherwise: the name's first char,
//                                          upper-cased; "?" when no name)
//
// Delta vs Vue (documented): the fallback character is the localized
// `hikari::avatar.fallback` string in Vue; the Rust locale tables carry the
// `hk.*` key family, so the mirror uses the English fallback literal — same
// as the other mirrored components (see the wave's PR note).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AvatarComponent;

/// The three size steps (Vue default `md`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AvatarSize {
    Sm,
    #[default]
    Md,
    Lg,
}

impl AvatarSize {
    /// The `hk-avatar-{size}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            AvatarSize::Sm => "hk-avatar-sm",
            AvatarSize::Md => "hk-avatar-md",
            AvatarSize::Lg => "hk-avatar-lg",
        }
    }
}

/// The fallback initial, exactly as Vue derives it:
/// `name?.charAt(0)?.toUpperCase() ?? "?"` — so a NULL name falls to `?`,
/// while an EMPTY-string name renders an empty initial (the nullish operator
/// does not catch `""`).
pub fn avatar_fallback_initial(name: Option<&str>) -> String {
    match name {
        None => "?".to_string(),
        Some(name) => name
            .chars()
            .next()
            .map(|c| c.to_uppercase().to_string())
            .unwrap_or_default(),
    }
}

#[define_props]
pub struct AvatarProps {
    /// Image source; when absent the initial fallback renders.
    pub src: Option<String>,

    /// User name (also the image `alt`).
    pub name: Option<String>,

    #[default]
    pub size: AvatarSize,
}

#[component]
pub fn Avatar(props: AvatarProps) -> Element {
    let size_class = props.size.class_name();
    match &props.src {
        Some(src) => rsx! {
            div {
                class: format!("hk-avatar {size_class}"),
                img {
                    src: src.clone(),
                    alt: props.name.clone().unwrap_or_default(),
                }
            }
        },
        None => {
            let initial = avatar_fallback_initial(props.name.as_deref());
            rsx! {
                div {
                    class: format!("hk-avatar {size_class}"),
                    span { class: "hk-avatar-fallback", "{initial}" }
                }
            }
        }
    }
}

impl StyledComponent for AvatarComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkAvatar.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "avatar"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn avatar_size_classes_match_vue() {
        assert_eq!(AvatarSize::Sm.class_name(), "hk-avatar-sm");
        assert_eq!(AvatarSize::Md.class_name(), "hk-avatar-md");
        assert_eq!(AvatarSize::Lg.class_name(), "hk-avatar-lg");
    }

    #[test]
    fn avatar_fallback_initial_matches_vue() {
        assert_eq!(avatar_fallback_initial(Some("alice")), "A");
        assert_eq!(avatar_fallback_initial(Some("Bob")), "B");
        // An empty name renders an EMPTY initial in Vue (`??` is nullish-only).
        assert_eq!(avatar_fallback_initial(Some("")), "");
        assert_eq!(avatar_fallback_initial(None), "?");
    }

    #[test]
    fn avatar_defaults_match_the_vue_props() {
        let props = AvatarProps::default();
        assert_eq!(props.size, AvatarSize::Md);
        assert!(props.src.is_none());
        assert!(props.name.is_none());
    }

    #[test]
    fn avatar_styles_come_from_the_canonical_vue_sheet() {
        let css = AvatarComponent::styles();
        assert!(
            css.contains(".hk-avatar"),
            "avatar css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored avatar sheet"
        );
    }
}
