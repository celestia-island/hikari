// hi-components/src/feedback/tooltip.rs
// Tooltip component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, TooltipClass, UtilityClass};

use crate::styled::StyledComponent;

/// Tooltip 组件的类型包装器（用于实现 StyledComponent）
pub struct TooltipComponent;

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
        TooltipPlacement::Top => TooltipClass::TooltipTop,
        TooltipPlacement::Bottom => TooltipClass::TooltipBottom,
        TooltipPlacement::Left => TooltipClass::TooltipLeft,
        TooltipPlacement::Right => TooltipClass::TooltipRight,
    };

    let arrow_class = match props.placement {
        TooltipPlacement::Top => TooltipClass::TooltipArrowTop,
        TooltipPlacement::Bottom => TooltipClass::TooltipArrowBottom,
        TooltipPlacement::Left => TooltipClass::TooltipArrowLeft,
        TooltipPlacement::Right => TooltipClass::TooltipArrowRight,
    };

    let wrapper_classes = ClassesBuilder::new()
        .add(TooltipClass::TooltipWrapper)
        .add_raw(&props.class)
        .build();

    let tooltip_classes = ClassesBuilder::new()
        .add(TooltipClass::Tooltip)
        .add(placement_class)
        .build();

    let arrow_classes = ClassesBuilder::new()
        .add(TooltipClass::TooltipArrow)
        .add(arrow_class)
        .build();

    rsx! {
        div {
            class: "{wrapper_classes}",

            div {
                class: "{TooltipClass::TooltipTrigger.as_class()}",
                { props.children }
            }

            div {
                class: "{tooltip_classes}",

                div { class: "{TooltipClass::TooltipContent.as_class()}",
                    "{props.content}"

                    if props.arrow {
                        div { class: "{arrow_classes}" }
                    }
                }
            }
        }
    }
}

impl StyledComponent for TooltipComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/tooltip.css"))
    }

    fn name() -> &'static str {
        "tooltip"
    }
}
