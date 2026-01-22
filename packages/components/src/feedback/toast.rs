// hi-components/src/feedback/toast.rs
// Toast component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, ToastClass, UtilityClass};

use crate::styled::StyledComponent;

/// Toast 组件的类型包装器（用于实现 StyledComponent）
pub struct ToastComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ToastVariant {
    #[default]
    Info,
    Success,
    Warning,
    Error,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ToastPosition {
    #[default]
    TopRight,
    TopCenter,
    TopLeft,
    BottomRight,
    BottomCenter,
    BottomLeft,
}

#[derive(Clone, PartialEq, Props)]
pub struct ToastProps {
    #[props(default)]
    pub variant: ToastVariant,

    #[props(default)]
    pub message: String,

    #[props(default)]
    pub title: Option<String>,

    #[props(default)]
    pub duration: Option<u64>,

    #[props(default)]
    pub position: ToastPosition,

    #[props(default)]
    pub closable: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub on_close: Option<EventHandler<MouseEvent>>,
}

impl Default for ToastProps {
    fn default() -> Self {
        Self {
            variant: Default::default(),
            message: String::default(),
            title: None,
            duration: None,
            position: Default::default(),
            closable: true,
            class: String::default(),
            on_close: None,
        }
    }
}

/// Toast component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Toast, ToastVariant, ToastPosition};
///
/// fn app() -> Element {
///     rsx! {
///         Toast {
///             variant: ToastVariant::Success,
///             message: "Operation completed successfully!".to_string(),
///             position: ToastPosition::TopRight,
///             duration: Some(3000),
///         }
///     }
/// }
/// ```
#[component]
pub fn Toast(props: ToastProps) -> Element {
    let variant_class = match props.variant {
        ToastVariant::Info => ToastClass::ToastInfo,
        ToastVariant::Success => ToastClass::ToastSuccess,
        ToastVariant::Warning => ToastClass::ToastWarning,
        ToastVariant::Error => ToastClass::ToastError,
    };

    let position_class = match props.position {
        ToastPosition::TopRight => ToastClass::ToastTopRight,
        ToastPosition::TopCenter => ToastClass::ToastTopCenter,
        ToastPosition::TopLeft => ToastClass::ToastTopLeft,
        ToastPosition::BottomRight => ToastClass::ToastBottomRight,
        ToastPosition::BottomCenter => ToastClass::ToastBottomCenter,
        ToastPosition::BottomLeft => ToastClass::ToastBottomLeft,
    };

    let toast_classes = ClassesBuilder::new()
        .add(ToastClass::Toast)
        .add(variant_class)
        .add(position_class)
        .add_raw(&props.class)
        .build();

    let default_icon = match props.variant {
        ToastVariant::Info => rsx! {
            svg {
                class: "{ToastClass::ToastIcon.as_class()}",
                view_box: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                stroke_width: "2",
                circle { cx: "12", cy: "12", r: "10" }
                line { x1: "12", y1: "16", x2: "12", y2: "12" }
                line { x1: "12", y1: "8", x2: "12.01", y2: "8" }
            }
        },
        ToastVariant::Success => rsx! {
            svg {
                class: "{ToastClass::ToastIcon.as_class()}",
                view_box: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                stroke_width: "2",
                path { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }
                polyline { points: "22 4 12 14.01 9 11.01" }
            }
        },
        ToastVariant::Warning => rsx! {
            svg {
                class: "{ToastClass::ToastIcon.as_class()}",
                view_box: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                stroke_width: "2",
                path { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }
                line { x1: "12", y1: "9", x2: "12", y2: "13" }
                line { x1: "12", y1: "17", x2: "12.01", y2: "17" }
            }
        },
        ToastVariant::Error => rsx! {
            svg {
                class: "{ToastClass::ToastIcon.as_class()}",
                view_box: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                stroke_width: "2",
                circle { cx: "12", cy: "12", r: "10" }
                line { x1: "15", y1: "9", x2: "9", y2: "15" }
                line { x1: "9", y1: "9", x2: "15", y2: "15" }
            }
        },
    };

    rsx! {
        div {
            class: "{toast_classes}",

            div { class: "{ToastClass::ToastIconWrapper.as_class()}",
                { default_icon }
            }

            div { class: "{ToastClass::ToastContent.as_class()}",

                if let Some(title) = props.title {
                    div { class: "{ToastClass::ToastTitle.as_class()}", "{title}" }
                }

                div { class: "{ToastClass::ToastMessage.as_class()}", "{props.message}" }
            }

            if props.closable {
                button {
                    class: "{ToastClass::ToastClose.as_class()}",
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

impl StyledComponent for ToastComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/toast.css"))
    }

    fn name() -> &'static str {
        "toast"
    }
}
