// hi-components/src/feedback/spotlight.rs
// Spotlight container component - wraps any component to add mouse-following glow effect

use dioxus::prelude::*;

/// Spotlight color mode
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SpotlightColor {
    /// Auto: black for light mode, white for dark mode
    /// Best for colored backgrounds (Primary, Success, Danger buttons)
    #[default]
    Auto,
    /// Theme color (blue by default)
    /// Best for solid white/black backgrounds (Input, Card, Ghost buttons)
    Theme,
}

#[derive(Clone, PartialEq, Props)]
pub struct SpotlightProps {
    /// Child elements to wrap
    children: Element,

    /// Spotlight color mode
    #[props(default)]
    color: SpotlightColor,

    /// Additional CSS classes
    #[props(default)]
    class: String,
}

/// Spotlight container component
///
/// Wraps any component to add a mouse-following glow/spotlight effect.
/// The spotlight automatically tracks mouse position and creates a radial gradient overlay.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Spotlight, SpotlightColor, Button};
///
/// fn app() -> Element {
///     rsx! {
///         // For colored buttons (Primary, Danger, Success)
///         Spotlight {
///             color: SpotlightColor::Auto,
///             Button { variant: ButtonVariant::Primary, "Click me" }
///         }
///
///         // For solid backgrounds (Input, Card)
///         Spotlight {
///             color: SpotlightColor::Theme,
///             Input { placeholder: "Enter text..." }
///         }
///     }
/// }
/// ```
#[component]
pub fn Spotlight(props: SpotlightProps) -> Element {
    let color_class = match props.color {
        SpotlightColor::Auto => "hi-spotlight-auto",
        SpotlightColor::Theme => "hi-spotlight-theme",
    };

    rsx! {
        div {
            class: format!("hi-spotlight-wrapper {color_class} {}", props.class),
            "data-spotlight": "true",
            { props.children }
        }
    }
}

/// Type wrapper for styling
pub struct SpotlightComponent;

impl crate::styled::StyledComponent for SpotlightComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/spotlight.css"))
    }

    fn name() -> &'static str {
        "spotlight"
    }
}
