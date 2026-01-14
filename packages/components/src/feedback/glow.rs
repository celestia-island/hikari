// hi-components/src/feedback/glow.rs
// Unified glow effect component with mouse-following spotlight and acrylic blur

use dioxus::prelude::*;

/// Glow blur intensity levels
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GlowBlur {
    /// No blur
    None,
    /// Light blur (5px)
    Light,
    /// Medium blur (10px, default)
    #[default]
    Medium,
    /// Heavy blur (20px)
    Heavy,
}

/// Glow color mode - automatically adapts to theme
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GlowColor {
    /// Auto: use theme color for light backgrounds, white for dark backgrounds
    #[default]
    Auto,
    /// Always use theme color
    Theme,
    /// Always use white
    White,
}

/// Glow intensity
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum GlowIntensity {
    /// Subtle glow
    #[default]
    Subtle,
    /// Standard glow
    Standard,
    /// Intense glow
    Intense,
}

#[derive(Clone, PartialEq, Props)]
pub struct GlowProps {
    /// Child elements to wrap
    children: Element,

    /// Blur intensity
    #[props(default)]
    blur: GlowBlur,

    /// Glow color mode
    #[props(default)]
    color: GlowColor,

    /// Glow intensity
    #[props(default)]
    intensity: GlowIntensity,

    /// Additional CSS classes
    #[props(default)]
    class: String,
}

/// Unified glow component with mouse-following effect
///
/// Combines spotlight (mouse-following glow) and acrylic (blur) effects.
/// Automatically adapts to theme colors.
#[component]
pub fn Glow(props: GlowProps) -> Element {
    let blur_class = match props.blur {
        GlowBlur::None => "hi-glow-blur-none",
        GlowBlur::Light => "hi-glow-blur-light",
        GlowBlur::Medium => "hi-glow-blur-medium",
        GlowBlur::Heavy => "hi-glow-blur-heavy",
    };

    let color_class = match props.color {
        GlowColor::Auto => "hi-glow-auto",
        GlowColor::Theme => "hi-glow-theme",
        GlowColor::White => "hi-glow-white",
    };

    let intensity_class = match props.intensity {
        GlowIntensity::Subtle => "hi-glow-subtle",
        GlowIntensity::Standard => "hi-glow-standard",
        GlowIntensity::Intense => "hi-glow-intense",
    };

    rsx! {
        div {
            class: format!("hi-glow-wrapper {blur_class} {color_class} {intensity_class} {}", props.class),
            "data-glow": "true",
            { props.children }
        }
    }
}

/// Type wrapper for styling
pub struct GlowComponent;

impl crate::styled::StyledComponent for GlowComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/glow.css"))
    }

    fn name() -> &'static str {
        "glow"
    }
}

// Re-exports for backward compatibility
pub use Glow as Acrylic;
pub use GlowBlur as AcrylicBlur;
pub use GlowColor as AcrylicMode;
pub use GlowIntensity as AcrylicIntensity;
