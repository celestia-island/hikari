// hi-components/src/basic/badge.rs
// Badge component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{BadgeClass, ClassesBuilder, Display};

use crate::styled::StyledComponent;

/// Badge 组件的类型包装器（用于实现 StyledComponent）
pub struct BadgeComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum BadgeVariant {
    #[default]
    Default,
    Primary,
    Secondary,
    Success,
    Warning,
    Danger,
    Info,
}

#[derive(Clone, PartialEq, Props)]
pub struct BadgeProps {
    #[props(default)]
    pub variant: BadgeVariant,

    #[props(default)]
    pub dot: bool,

    #[props(default)]
    pub count: Option<i32>,

    #[props(default)]
    pub max: Option<i32>,

    #[props(default)]
    pub show_zero: bool,

    #[props(default)]
    pub class: String,

    pub children: Element,
}

impl Default for BadgeProps {
    fn default() -> Self {
        Self {
            variant: Default::default(),
            dot: false,
            count: None,
            max: None,
            show_zero: false,
            class: String::default(),
            children: VNode::empty(),
        }
    }
}

#[component]
pub fn Badge(props: BadgeProps) -> Element {
    let display_count = if let Some(count) = props.count {
        if count == 0 && !props.show_zero {
            None
        } else if let Some(max) = props.max {
            if count > max {
                Some(format!("{max}+"))
            } else {
                Some(format!("{count}"))
            }
        } else {
            Some(format!("{count}"))
        }
    } else {
        None
    };

    let variant_class = match props.variant {
        BadgeVariant::Default => None,
        BadgeVariant::Primary => Some(BadgeClass::Primary),
        BadgeVariant::Secondary => Some(BadgeClass::Secondary),
        BadgeVariant::Success => Some(BadgeClass::Success),
        BadgeVariant::Warning => Some(BadgeClass::Warning),
        BadgeVariant::Danger => Some(BadgeClass::Danger),
        BadgeVariant::Info => Some(BadgeClass::Info),
    };

    let is_standalone = !props.dot && display_count.is_none();

    if is_standalone {
        let mut builder = ClassesBuilder::new()
            .add(BadgeClass::Badge)
            .add(Display::InlineFlex);

        if let Some(vc) = variant_class {
            builder = builder.add(vc);
        }

        let badge_classes = builder.add_raw(&props.class).build();

        rsx! {
            span { class: "{badge_classes}",
                {props.children}
            }
        }
    } else {
        let mut builder = ClassesBuilder::new()
            .add(BadgeClass::Badge)
            .add(BadgeClass::Dot);

        if let Some(vc) = variant_class {
            builder = builder.add(vc);
        }

        let badge_classes = builder.build();

        rsx! {
            div { class: format!("hi-badge-wrapper {}", props.class),

                {props.children}

                span { class: "{badge_classes}",

                    if props.dot {
                        span { class: "hi-badge-dot-inner" }
                    } else if let Some(count) = display_count {
                        "{count}"
                    }
                }
            }
        }
    }
}

impl StyledComponent for BadgeComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/badge.css"))
    }

    fn name() -> &'static str {
        "badge"
    }
}
