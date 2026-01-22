// hi-components/src/feedback/modal.rs
// Modal component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::ClassesBuilder;

use crate::styled::StyledComponent;

/// Modal 组件的类型包装器（用于实现 StyledComponent）
pub struct ModalComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ModalSize {
    #[default]
    Md,
    Sm,
    Lg,
    Xl,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ModalPosition {
    #[default]
    Center,
    Top,
}

#[derive(Clone, PartialEq, Props)]
pub struct ModalProps {
    #[props(default)]
    pub open: bool,

    #[props(default)]
    pub title: Option<String>,

    #[props(default)]
    pub size: ModalSize,

    #[props(default)]
    pub position: ModalPosition,

    #[props(default)]
    pub closable: bool,

    #[props(default)]
    pub mask_closable: bool,

    #[props(default)]
    pub footer: Option<Element>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub on_close: Option<EventHandler<MouseEvent>>,

    children: Element,
}

/// Modal component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Modal, ModalSize};
///
/// fn app() -> Element {
///     let mut open = use_signal(|| false);
///
///     rsx! {
///         button { onclick: move |_| open.set(true), "Open Modal" }
///
///         Modal {
///             open: open(),
///             title: "Modal Title".to_string(),
///             size: ModalSize::Md,
///             on_close: move |_| open.set(false),
///             "Modal content goes here"
///         }
///     }
/// }
/// ```
#[component]
pub fn Modal(props: ModalProps) -> Element {
    if !props.open {
        return rsx! { div {} };
    }

    let size_class = match props.size {
        ModalSize::Sm => "hi-modal-sm",
        ModalSize::Md => "hi-modal-md",
        ModalSize::Lg => "hi-modal-lg",
        ModalSize::Xl => "hi-modal-xl",
    };

    let position_class = match props.position {
        ModalPosition::Center => "hi-modal-center",
        ModalPosition::Top => "hi-modal-top",
    };

    rsx! {
        div { class: "hi-modal-overlay",
            onclick: move |e| {
                if props.mask_closable {
                    if let Some(handler) = props.on_close.as_ref() {
                        handler.call(e);
                    }
                }
            },

            div { class: ClassesBuilder::new()
                .add_raw("hi-modal")
                .add_raw(size_class)
                .add_raw(position_class)
                .add_raw(&props.class)
                .build(),

                // Header
                div { class: "hi-modal-header",
                    if let Some(title) = props.title {
                        h3 { class: "hi-modal-title", "{title}" }
                    }

                    if props.closable {
                        button { class: "hi-modal-close",
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

                // Body
                div { class: "hi-modal-body",
                    { props.children }
                }

                // Footer
                if let Some(footer_element) = props.footer {
                    div { class: "hi-modal-footer",
                        { footer_element }
                    }
                }
            }
        }
    }
}

impl StyledComponent for ModalComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/modal.css"))
    }

    fn name() -> &'static str {
        "modal"
    }
}
