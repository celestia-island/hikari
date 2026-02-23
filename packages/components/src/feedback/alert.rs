// hi-components/src/feedback/alert.rs
// Alert component with Arknights + FUI styling

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{AlertClass, ClassesBuilder, UtilityClass};

use crate::{
    basic::{IconButton, IconButtonSize, IconButtonVariant},
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

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

#[component]
pub fn Alert(props: AlertProps) -> Element {
    let variant_class = match props.variant {
        AlertVariant::Info => AlertClass::AlertInfo,
        AlertVariant::Success => AlertClass::AlertSuccess,
        AlertVariant::Warning => AlertClass::AlertWarning,
        AlertVariant::Error => AlertClass::AlertError,
    };

    let glow_color = match props.variant {
        AlertVariant::Info => GlowColor::Info,
        AlertVariant::Success => GlowColor::Success,
        AlertVariant::Warning => GlowColor::Warning,
        AlertVariant::Error => GlowColor::Danger,
    };

    let alert_classes = ClassesBuilder::new()
        .add(AlertClass::Alert)
        .add(variant_class)
        .add_raw(&props.class)
        .build();

    let default_icon: Option<Element> = match props.variant {
        AlertVariant::Info => Some(rsx! {
            Icon {
                icon: MdiIcon::Information,
                class: AlertClass::AlertIcon.as_class().to_string(),
                size: 20,
                color: "var(--hi-color-primary)",
            }
        }),
        AlertVariant::Success => Some(rsx! {
            Icon {
                icon: MdiIcon::Check,
                class: AlertClass::AlertIcon.as_class().to_string(),
                size: 20,
                color: "var(--hi-color-success)",
            }
        }),
        AlertVariant::Warning => Some(rsx! {
            Icon {
                icon: MdiIcon::AlertTriangle,
                class: AlertClass::AlertIcon.as_class().to_string(),
                size: 20,
                color: "var(--hi-color-warning)",
            }
        }),
        AlertVariant::Error => Some(rsx! {
            Icon {
                icon: MdiIcon::Alert,
                class: AlertClass::AlertIcon.as_class().to_string(),
                size: 20,
                color: "var(--hi-color-danger)",
            }
        }),
    };

    let icon = props.icon.as_ref().or(default_icon.as_ref());

    rsx! {
        Glow {
            class: "hi-alert-glow-wrapper",
            blur: GlowBlur::Light,
            color: glow_color,
            intensity: GlowIntensity::Soft,
            div {
                class: "{alert_classes}",

                if let Some(icon_element) = icon {
                    div { class: "{AlertClass::AlertIconWrapper.as_class()}",
                        { icon_element }
                    }
                }

                div { class: "{AlertClass::AlertContent.as_class()}",

                    if let Some(title) = props.title {
                        div { class: "{AlertClass::AlertTitle.as_class()}", "{title}" }
                    }

                    if let Some(description) = props.description {
                        div { class: "{AlertClass::AlertDescription.as_class()}", "{description}" }
                    }
                }

                if props.closable {
                    IconButton {
                        icon: MdiIcon::Close,
                        size: IconButtonSize::Small,
                        variant: IconButtonVariant::Ghost,
                        class: "hi-alert-close".to_string(),
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

impl StyledComponent for AlertComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/alert.css"))
    }

    fn name() -> &'static str {
        "alert"
    }
}
