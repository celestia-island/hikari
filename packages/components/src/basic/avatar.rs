// hikari-components/src/basic/avatar.rs
//! Avatar component for user profile images

use animation::style::{CssProperty, StyleStringBuilder};
use dioxus::prelude::*;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum AvatarSize {
    Xs,
    Sm,
    Md,
    Lg,
    Xl,
}

impl AvatarSize {
    pub fn pixels(&self) -> u32 {
        match self {
            AvatarSize::Xs => 24,
            AvatarSize::Sm => 32,
            AvatarSize::Md => 40,
            AvatarSize::Lg => 48,
            AvatarSize::Xl => 64,
        }
    }

    pub fn icon_size(&self) -> u32 {
        match self {
            AvatarSize::Xs => 14,
            AvatarSize::Sm => 18,
            AvatarSize::Md => 22,
            AvatarSize::Lg => 26,
            AvatarSize::Xl => 34,
        }
    }

    pub fn font_size(&self) -> &'static str {
        match self {
            AvatarSize::Xs => "0.625rem",
            AvatarSize::Sm => "0.75rem",
            AvatarSize::Md => "0.875rem",
            AvatarSize::Lg => "1rem",
            AvatarSize::Xl => "1.25rem",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum AvatarVariant {
    Circular,
    Rounded,
    Square,
}

impl AvatarVariant {
    pub fn as_str(&self) -> &'static str {
        match self {
            AvatarVariant::Circular => "50%",
            AvatarVariant::Rounded => "8px",
            AvatarVariant::Square => "0",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Default)]
pub enum AvatarFallbackMode {
    #[default]
    Initial,
    Icon,
    None,
}

#[component]
pub fn Avatar(
    #[props(default)] src: Option<String>,

    #[props(default = "Avatar".to_string())] alt: String,

    #[props(default = AvatarSize::Md)] size: AvatarSize,

    #[props(default = AvatarVariant::Circular)] variant: AvatarVariant,

    #[props(default)] fallback: Option<String>,

    #[props(default)] fallback_mode: AvatarFallbackMode,

    #[props(default)] class: String,
) -> Element {
    let size_px = size.pixels();
    let icon_size = size.icon_size();
    let font_size = size.font_size();

    let container_style = StyleStringBuilder::new()
        .add_px(CssProperty::Width, size_px)
        .add_px(CssProperty::Height, size_px)
        .add(CssProperty::BorderRadius, variant.as_str())
        .add(CssProperty::Display, "flex")
        .add(CssProperty::AlignItems, "center")
        .add(CssProperty::JustifyContent, "center")
        .add(CssProperty::Overflow, "hidden")
        .build_clean();

    let img_style = StyleStringBuilder::new()
        .add_px(CssProperty::Width, size_px)
        .add_px(CssProperty::Height, size_px)
        .add(CssProperty::ObjectFit, "cover")
        .build_clean();

    let base_class = if class.is_empty() {
        "hi-avatar".to_string()
    } else {
        format!("hi-avatar {}", class)
    };

    let fallback_text = fallback.clone().unwrap_or_else(|| {
        alt.chars()
            .find(|c| c.is_alphabetic() || c.is_numeric())
            .map(|c| c.to_uppercase().to_string())
            .unwrap_or_else(|| "?".to_string())
    });

    rsx! {
        div {
            class: "{base_class}",
            style: "{container_style}",

            if let Some(img_src) = src {
                img {
                    class: "hi-avatar-img",
                    src: "{img_src}",
                    alt: "{alt}",
                    style: "{img_style}",
                }
            } else {
                match fallback_mode {
                    AvatarFallbackMode::Icon => rsx! {
                        svg {
                            class: "hi-avatar-icon",
                            width: "{icon_size}",
                            height: "{icon_size}",
                            view_box: "0 0 24 24",
                            fill: "currentColor",
                            path {
                                d: "M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z"
                            }
                        }
                    },
                    AvatarFallbackMode::Initial => rsx! {
                        span {
                            class: "hi-avatar-fallback",
                            style: "font-size: {font_size};",
                            "{fallback_text}"
                        }
                    },
                    AvatarFallbackMode::None => rsx! {
                        span {
                            class: "hi-avatar-fallback",
                            style: "font-size: {font_size};",
                            "{fallback_text}"
                        }
                    },
                }
            }
        }
    }
}
