// hi-components/src/basic/divider.rs
// Divider component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, Display};

use crate::styled::StyledComponent;

/// Divider component type wrapper (for implementing StyledComponent)
pub struct DividerComponent;

/// Divider orientation
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DividerOrientation {
    /// Horizontal divider (default)
    #[default]
    Horizontal,
    /// Vertical divider
    Vertical,
}

/// Divider text position
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DividerTextPosition {
    /// No text (default)
    #[default]
    None,
    /// Text in the center
    Center,
    /// Text on the left
    Left,
    /// Text on the right
    Right,
}

#[derive(Clone, PartialEq, Props)]
#[derive(Default)]
pub struct DividerProps {
    /// Divider orientation
    #[props(default)]
    pub orientation: DividerOrientation,

    /// Text to display in the divider
    #[props(into, default)]
    pub text: String,

    /// Text position
    #[props(default)]
    pub text_position: DividerTextPosition,

    /// Custom CSS class
    #[props(into, default)]
    pub class: String,
}


/// Divider component
///
/// A simple divider line that can be horizontal or vertical,
/// with optional text in the center, left, or right.
///
/// # Example
///
/// ```rust,ignore
/// use hikari_components::Divider;
///
/// rsx! {
///     // Simple horizontal divider
///     Divider {}
///
///     // Divider with text
///     Divider { text: "Section" }
///
///     // Vertical divider
///     Divider { orientation: DividerOrientation::Vertical }
/// }
/// ```
#[component]
pub fn Divider(props: DividerProps) -> Element {
    let orientation_class = match props.orientation {
        DividerOrientation::Horizontal => "hi-divider-horizontal",
        DividerOrientation::Vertical => "hi-divider-vertical",
    };

    let text_position_class = match props.text_position {
        DividerTextPosition::None => "",
        DividerTextPosition::Center => "hi-divider-text-center",
        DividerTextPosition::Left => "hi-divider-text-left",
        DividerTextPosition::Right => "hi-divider-text-right",
    };

    let base_classes = ClassesBuilder::new().add(Display::Flex).build();

    let divider_classes = format!(
        "hi-divider {} {} {} {}",
        base_classes,
        orientation_class,
        if props.text.is_empty() {
            ""
        } else {
            "hi-divider-with-text"
        },
        text_position_class
    );

    if props.text.is_empty() {
        rsx! {
            div {
                class: "{divider_classes} {props.class}",
                div { class: "hi-divider-line" }
            }
        }
    } else {
        let show_text = props.text_position != DividerTextPosition::None;

        rsx! {
            div {
                class: "{divider_classes} {props.class}",

                if show_text && props.text_position != DividerTextPosition::Right {
                    div { class: "hi-divider-line" }
                }

                if show_text {
                    span { class: "hi-divider-text", "{props.text}" }
                }

                if show_text && props.text_position != DividerTextPosition::Left {
                    div { class: "hi-divider-line" }
                }
            }
        }
    }
}

impl StyledComponent for DividerComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/divider.css"))
    }

    fn name() -> &'static str {
        "divider"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_divider_props_default() {
        let props = DividerProps::default();
        assert_eq!(props.orientation, DividerOrientation::Horizontal);
        assert_eq!(props.text, "");
        assert_eq!(props.text_position, DividerTextPosition::None);
    }

    #[test]
    fn test_divider_orientation() {
        let h = DividerOrientation::Horizontal;
        let v = DividerOrientation::Vertical;
        assert_ne!(h, v);
    }

    #[test]
    fn test_divider_text_position() {
        let none = DividerTextPosition::None;
        let center = DividerTextPosition::Center;
        let left = DividerTextPosition::Left;
        let right = DividerTextPosition::Right;

        assert_eq!(none, DividerTextPosition::default());
        assert_ne!(none, center);
        assert_ne!(center, left);
        assert_ne!(left, right);
    }

    #[test]
    fn test_divider_component_name() {
        assert_eq!(DividerComponent::name(), "divider");
    }
}
