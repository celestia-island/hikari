// hikari-components/src/basic/avatar.rs
//! Avatar component for user profile images

use dioxus::prelude::*;
use animation::style::{StyleStringBuilder, CssProperty};

/// Avatar size preset
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum AvatarSize {
    /// Extra small - 24px
    Xs,
    /// Small - 32px
    Sm,
    /// Medium - 40px (default)
    Md,
    /// Large - 48px
    Lg,
    /// Extra large - 64px
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
}

/// Avatar variant - border radius style
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum AvatarVariant {
    /// Fully circular (50% border-radius)
    Circular,
    /// Rounded corners (8px border-radius)
    Rounded,
    /// Square corners (0 border-radius)
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

/// Avatar component for displaying user profile images
///
/// Similar to Material UI's Avatar component - displays user avatars
/// with fixed sizes and fallback text support. Uses inline styles
/// to override global img styles from base.scss.
///
/// # Example
///
/// ```rust
/// use hikari_components::basic::{Avatar, AvatarSize, AvatarVariant};
/// use dioxus::prelude::*;
///
/// rsx! {
///     Avatar {
///         src: "/avatars/user.jpg".to_string(),
///         alt: "User Name".to_string(),
///         size: AvatarSize::Md,
///         variant: AvatarVariant::Circular,
///     }
/// }
/// ```
#[component]
pub fn Avatar(
    /// Image source URL
    #[props(default)]
    src: Option<String>,

    /// Alt text for accessibility
    #[props(default = "Avatar".to_string())]
    alt: String,

    /// Avatar size preset
    #[props(default = AvatarSize::Md)]
    size: AvatarSize,

    /// Border radius variant
    #[props(default = AvatarVariant::Circular)]
    variant: AvatarVariant,

    /// Fallback text (shown when no image provided or fails to load)
    #[props(default)]
    fallback: Option<String>,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    let size_px = size.pixels();

    // Build inline styles for avatar container
    let container_style = StyleStringBuilder::new()
        .add_px(CssProperty::Width, size_px)
        .add_px(CssProperty::Height, size_px)
        .add(CssProperty::BorderRadius, variant.as_str())
        .add(CssProperty::Display, "flex")
        .add(CssProperty::AlignItems, "center")
        .add(CssProperty::JustifyContent, "center")
        .add(CssProperty::Overflow, "hidden")
        .build_clean();

    // Build inline styles for img (to override base.scss)
    let img_style = StyleStringBuilder::new()
        .add_px(CssProperty::Width, size_px)
        .add_px(CssProperty::Height, size_px)
        .add(CssProperty::ObjectFit, "cover")
        .build_clean();

    // Build class name
    let base_class = if class.is_empty() {
        "hi-avatar".to_string()
    } else {
        format!("hi-avatar {}", class)
    };

    // Get fallback text (first letter of alt or provided fallback)
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
                span {
                    class: "hi-avatar-fallback",
                    "{fallback_text}"
                }
            }
        }
    }
}
