// hi-components/src/feedback/toast.rs
// Toast component with Arknights + FUI styling

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{ClassesBuilder, ToastClass, UtilityClass};

use crate::{
    basic::{IconButton, IconButtonSize, IconButtonVariant},
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
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

    #[props(default = true)]
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
        .add(ToastClass::Toast)
        .add(variant_class)
        .add_raw(&props.class)
        .build();

    let default_icon = match props.variant {
        ToastVariant::Info => rsx! {
            Icon {
                icon: MdiIcon::Information,
                class: ToastClass::ToastIcon.as_class().to_string(),
                size: 20,
                color: "var(--hi-color-white-100)",
            }
        },
        ToastVariant::Success => rsx! {
            Icon {
                icon: MdiIcon::Check,
                class: ToastClass::ToastIcon.as_class().to_string(),
                size: 20,
                color: "var(--hi-color-white-100)",
            }
        },
        ToastVariant::Warning => rsx! {
            Icon {
                icon: MdiIcon::AlertTriangle,
                class: ToastClass::ToastIcon.as_class().to_string(),
                size: 20,
                color: "var(--hi-color-white-100)",
            }
        },
        ToastVariant::Error => rsx! {
            Icon {
                icon: MdiIcon::Alert,
                class: ToastClass::ToastIcon.as_class().to_string(),
                size: 20,
                color: "var(--hi-color-white-100)",
            }
        },
    };

    rsx! {
        Glow {
            class: "hi-toast-glow-wrapper",
            blur: GlowBlur::Medium,
            color: glow_color,
            intensity: GlowIntensity::Soft,
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
                    IconButton {
                        icon: MdiIcon::Close,
                        size: IconButtonSize::Small,
                        variant: IconButtonVariant::Ghost,
                        class: "hi-toast-close".to_string(),
                        icon_color: Some("var(--hi-color-white-100)".to_string()),
                        glow: false,
                        onclick: move |e| {
                            if let Some(handler) = props.on_close.as_ref() {
                                handler.call(e);
                            }
                        },
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
