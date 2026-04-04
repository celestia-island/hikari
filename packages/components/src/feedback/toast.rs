// hi-components/src/feedback/toast.rs
// Toast component with Arknights + FUI styling

#![expect(clippy::needless_update)]

use hikari_icons::{Icon, MdiIcon};
use hikari_palette::classes::{TypedClass, ClassesBuilder, ToastClass};

use crate::{
    basic::{IconButton, IconButtonSize, IconButtonVariant},
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    prelude::*,
    styled::StyledComponent,
};

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

#[define_props]
pub struct ToastProps {
    pub variant: ToastVariant,
    pub message: String,
    pub title: Option<String>,
    pub duration: Option<u64>,
    pub position: ToastPosition,
    #[default(true)]
    pub closable: bool,
    pub class: String,
    pub on_close: Option<EventHandler<MouseEvent>>,
}

#[component]
pub fn Toast(props: ToastProps) -> Element {
    let variant_class = match props.variant {
        ToastVariant::Info => ToastClass::ToastInfo,
        ToastVariant::Success => ToastClass::ToastSuccess,
        ToastVariant::Warning => ToastClass::ToastWarning,
        ToastVariant::Error => ToastClass::ToastError,
    };

    let glow_color = match props.variant {
        ToastVariant::Info => GlowColor::Info,
        ToastVariant::Success => GlowColor::Success,
        ToastVariant::Warning => GlowColor::Warning,
        ToastVariant::Error => GlowColor::Danger,
    };

    let toast_classes = ClassesBuilder::new()
        .add_typed(ToastClass::Toast)
        .add_typed(variant_class)
        .add(&props.class)
        .build();

    let default_icon = match props.variant {
        ToastVariant::Info => rsx! {
            Icon {
                icon: MdiIcon::Information,
                class: ToastClass::ToastIcon.class_name().to_string(),
                size: 20,
                color: "var(--hi-color-white-100)".to_string(),
            }
        },
        ToastVariant::Success => rsx! {
            Icon {
                icon: MdiIcon::Check,
                class: ToastClass::ToastIcon.class_name().to_string(),
                size: 20,
                color: "var(--hi-color-white-100)".to_string(),
            }
        },
        ToastVariant::Warning => rsx! {
            Icon {
                icon: MdiIcon::AlertTriangle,
                class: ToastClass::ToastIcon.class_name().to_string(),
                size: 20,
                color: "var(--hi-color-white-100)".to_string(),
            }
        },
        ToastVariant::Error => rsx! {
            Icon {
                icon: MdiIcon::Alert,
                class: ToastClass::ToastIcon.class_name().to_string(),
                size: 20,
                color: "var(--hi-color-white-100)".to_string(),
            }
        },
    };

    rsx! {
        Glow {
            class: "hi-toast-glow-wrapper".to_string(),
            blur: GlowBlur::Medium,
            color: glow_color,
            intensity: GlowIntensity::Soft,
            block: true,
            div { class: toast_classes,

                div { class: ToastClass::ToastIconWrapper.class_name(), {default_icon} }

                div { class: ToastClass::ToastContent.class_name(),

                    if let Some(title) = props.title {
                        div { class: ToastClass::ToastTitle.class_name(), "{title}" }
                    }

                    div { class: ToastClass::ToastMessage.class_name(), "{props.message}" }
                }

                if props.closable {
                    IconButton {
                        icon: MdiIcon::Close,
                        size: IconButtonSize::Small,
                        variant: IconButtonVariant::Ghost,
                        class: "hi-toast-close".to_string(),
                        icon_color: Some("var(--hi-color-white-100)".to_string()),
                        glow: false,
                        onclick: Some(
                            EventHandler::new(move |e| {
                                if let Some(handler) = props.on_close.as_ref() {
                                    handler(e);
                                }
                            }),
                        ),
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
