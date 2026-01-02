// hikari-components/src/feedback/alert.rs
// Alert component with Arknights + FUI styling

use dioxus::prelude::*;
use crate::styled::StyledComponent;

/// Alert 组件的类型包装器（用于实现 StyledComponent）
pub struct AlertComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AlertVariant {
    #[default]
    Info,
    Success,
    Warning,
    Error,
}

#[derive(Clone, PartialEq, Props, Default)]
pub struct AlertProps {
    #[props(default)]
    pub variant: AlertVariant,

    #[props(default)]
    pub title: Option<String>,

    #[props(default)]
    pub description: Option<String>,

    #[props(default)]
    pub closable: bool,

    #[props(default)]
    pub icon: Option<Element>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub on_close: Option<EventHandler<MouseEvent>>,
}

/// Alert component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Alert, AlertVariant};
///
/// fn app() -> Element {
///     rsx! {
///         Alert {
///             variant: AlertVariant::Info,
///             title: "Information".to_string(),
///             description: "This is an informational message.".to_string(),
///         }
///     }
/// }
/// ```
#[component]
pub fn Alert(props: AlertProps) -> Element {
    let variant_class = match props.variant {
        AlertVariant::Info => "hikari-alert-info",
        AlertVariant::Success => "hikari-alert-success",
        AlertVariant::Warning => "hikari-alert-warning",
        AlertVariant::Error => "hikari-alert-error",
    };

    let default_icon = match props.variant {
        AlertVariant::Info => Some(rsx! {
            svg {
                class: "hikari-alert-icon",
                view_box: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                stroke_width: "2",
                circle { cx: "12", cy: "12", r: "10" }
                line { x1: "12", y1: "16", x2: "12", y2: "12" }
                line { x1: "12", y1: "8", x2: "12.01", y2: "8" }
            }
        }),
        AlertVariant::Success => Some(rsx! {
            svg {
                class: "hikari-alert-icon",
                view_box: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                stroke_width: "2",
                path { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }
                polyline { points: "22 4 12 14.01 9 11.01" }
            }
        }),
        AlertVariant::Warning => Some(rsx! {
            svg {
                class: "hikari-alert-icon",
                view_box: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                stroke_width: "2",
                path { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }
                line { x1: "12", y1: "9", x2: "12", y2: "13" }
                line { x1: "12", y1: "17", x2: "12.01", y2: "17" }
            }
        }),
        AlertVariant::Error => Some(rsx! {
            svg {
                class: "hikari-alert-icon",
                view_box: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                stroke_width: "2",
                circle { cx: "12", cy: "12", r: "10" }
                line { x1: "15", y1: "9", x2: "9", y2: "15" }
                line { x1: "9", y1: "9", x2: "15", y2: "15" }
            }
        }),
    };

    let icon = props.icon.as_ref().or(default_icon.as_ref());

    rsx! {
        div {
            class: format!("hikari-alert {variant_class} {}", props.class),

            if let Some(icon_element) = icon {
                div { class: "hikari-alert-icon-wrapper",
                    { icon_element }
                }
            }

            div { class: "hikari-alert-content",

                if let Some(title) = props.title {
                    div { class: "hikari-alert-title", "{title}" }
                }

                if let Some(description) = props.description {
                    div { class: "hikari-alert-description", "{description}" }
                }
            }

            if props.closable {
                button {
                    class: "hikari-alert-close",
                    onclick: move |e| {
                        if let Some(handler) = props.on_close.as_ref() {
                            handler.call(e);
                        }
                    },
                    svg {
                        view_box: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        stroke_width: "2",
                        line { x1: "18", y1: "6", x2: "6", y2: "18" }
                        line { x1: "6", y1: "6", x2: "18", y2: "18" }
                    }
                }
            }
        }
    }
}

impl StyledComponent for AlertComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/alert.css"))
    }

    fn name() -> &'static str {
        "alert"
    }
}
