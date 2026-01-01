// hikari-components/src/feedback/tooltip.rs
// Tooltip component with Arknights + FUI styling

use dioxus::prelude::*;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TooltipPlacement {
    #[default]
    Top,
    Bottom,
    Left,
    Right,
}

#[derive(Clone, PartialEq, Props)]
pub struct TooltipProps {
    #[props(default)]
    pub content: String,

    #[props(default)]
    pub placement: TooltipPlacement,

    #[props(default)]
    pub delay: Option<u64>,

    #[props(default)]
    pub arrow: bool,

    #[props(default)]
    pub class: String,

    pub children: Element,
}

impl Default for TooltipProps {
    fn default() -> Self {
        Self {
            content: String::default(),
            placement: Default::default(),
            delay: None,
            arrow: true,
            class: String::default(),
            children: VNode::empty(),
        }
    }
}

/// Tooltip component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Tooltip, TooltipPlacement};
///
/// fn app() -> Element {
///     rsx! {
///         Tooltip {
///             content: "This is a helpful tooltip".to_string(),
///             placement: TooltipPlacement::Top,
///             Button { "Hover me" }
///         }
///     }
/// }
/// ```
#[component]
pub fn Tooltip(props: TooltipProps) -> Element {
    let placement_class = match props.placement {
        TooltipPlacement::Top => "hikari-tooltip-top",
        TooltipPlacement::Bottom => "hikari-tooltip-bottom",
        TooltipPlacement::Left => "hikari-tooltip-left",
        TooltipPlacement::Right => "hikari-tooltip-right",
    };

    let arrow_class = match props.placement {
        TooltipPlacement::Top => "hikari-tooltip-arrow-top",
        TooltipPlacement::Bottom => "hikari-tooltip-arrow-bottom",
        TooltipPlacement::Left => "hikari-tooltip-arrow-left",
        TooltipPlacement::Right => "hikari-tooltip-arrow-right",
    };

    rsx! {
        div {
            class: format!("hikari-tooltip-wrapper {}", props.class),

            div {
                class: "hikari-tooltip-trigger",
                { props.children }
            }

            div {
                class: format!("hikari-tooltip {placement_class}"),

                div { class: "hikari-tooltip-content",
                    "{props.content}"

                    if props.arrow {
                        div { class: format!("hikari-tooltip-arrow {arrow_class}") }
                    }
                }
            }
        }
    }
}
