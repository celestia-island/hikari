// hi-components/src/feedback/tooltip.rs
// Tooltip component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, TooltipClass, UtilityClass};

use crate::styled::StyledComponent;

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

    #[props(default = true)]
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

#[component]
pub fn Tooltip(props: TooltipProps) -> Element {
    let mut is_visible = use_signal(|| false);

    let placement_class = match props.placement {
        TooltipPlacement::Top => TooltipClass::TooltipTop,
        TooltipPlacement::Bottom => TooltipClass::TooltipBottom,
        TooltipPlacement::Left => TooltipClass::TooltipLeft,
        TooltipPlacement::Right => TooltipClass::TooltipRight,
    };

    let wrapper_classes = ClassesBuilder::new()
        .add(TooltipClass::TooltipWrapper)
        .add_raw(&props.class)
        .build();

    let tooltip_classes = ClassesBuilder::new()
        .add(TooltipClass::Tooltip)
        .add(placement_class)
        .add_if(TooltipClass::TooltipVisible, move || is_visible())
        .build();

    let handle_mouse_enter = move |_| {
        is_visible.set(true);
    };

    let handle_mouse_leave = move |_| {
        is_visible.set(false);
    };

    rsx! {
        div {
            class: "{wrapper_classes}",

            div {
                class: "{TooltipClass::TooltipTrigger.as_class()}",
                onmouseenter: handle_mouse_enter,
                onmouseleave: handle_mouse_leave,
                { props.children }
            }

            if is_visible() {
                div {
                    class: "{tooltip_classes}",

                    div { class: "{TooltipClass::TooltipContent.as_class()}",
                        "{props.content}"
                    }

                    if props.arrow {
                        div { class: "hi-tooltip-arrow" }
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
