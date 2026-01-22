// hi-components/src/basic/badge.rs
// Badge component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{BadgeClass, ClassesBuilder};

use crate::styled::StyledComponent;

/// Badge 组件的类型包装器（用于实现 StyledComponent）
pub struct BadgeComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum BadgeVariant {
    #[default]
    Default,
    Primary,
    Success,
    Warning,
    Danger,
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

/// Badge component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Badge, BadgeVariant};
///
/// fn app() -> Element {
///     rsx! {
///         Badge {
///             variant: BadgeVariant::Primary,
///             count: 5,
///             Button { "Notifications" }
///         }
///     }
/// }
/// ```
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

    // Pre-compute badge classes outside rsx
    let badge_classes = if props.dot || display_count.is_some() {
        ClassesBuilder::new()
            .add(BadgeClass::Badge)
            .add_if(BadgeClass::Dot, || props.dot)
            .build()
    } else {
        String::new()
    };

    rsx! {
        div { class: format!("hi-badge-wrapper {}", props.class),

            { props.children }

            if !badge_classes.is_empty() {
                span {
                    class: "{badge_classes}",

                    if props.dot {
                        span { class: "hi-badge-dot" }
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
