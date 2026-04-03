// hi-components/src/basic/divider.rs
// Divider component with Arknights + FUI styling

use hikari_palette::classes::{ClassesBuilder, Display};

use crate::{prelude::*, styled::StyledComponent};

pub struct DividerComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DividerOrientation {
    #[default]
    Horizontal,
    Vertical,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DividerTextPosition {
    #[default]
    None,
    Center,
    Left,
    Right,
}

#[define_props]
pub struct DividerProps {
    #[default]
    pub orientation: DividerOrientation,
    #[default]
    pub text: String,
    #[default]
    pub text_position: DividerTextPosition,
    #[default]
    pub class: String,
}

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
