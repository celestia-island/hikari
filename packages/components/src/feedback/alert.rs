// hi-components/src/feedback/alert.rs
// Alert component with Arknights + FUI styling

use crate::prelude::*;
use hikari_icons::{Icon, MdiIcon};
use hikari_palette::classes::{AlertClass, ClassesBuilder, UtilityClass};

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

#[define_props]
pub struct AlertProps {
    pub variant: AlertVariant,
    pub title: Option<String>,
    pub description: Option<String>,
    pub closable: bool,
    pub icon: Option<Element>,
    pub class: String,
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
                color: "var(--hi-color-primary)".to_string(),
            }
        }),
        AlertVariant::Success => Some(rsx! {
            Icon {
                icon: MdiIcon::Check,
                class: AlertClass::AlertIcon.as_class().to_string(),
                size: 20,
                color: "var(--hi-color-success)".to_string(),
            }
        }),
        AlertVariant::Warning => Some(rsx! {
            Icon {
                icon: MdiIcon::AlertTriangle,
                class: AlertClass::AlertIcon.as_class().to_string(),
                size: 20,
                color: "var(--hi-color-warning)".to_string(),
            }
        }),
        AlertVariant::Error => Some(rsx! {
            Icon {
                icon: MdiIcon::Alert,
                class: AlertClass::AlertIcon.as_class().to_string(),
                size: 20,
                color: "var(--hi-color-danger)".to_string(),
            }
        }),
    };

    let icon = props.icon.as_ref().or(default_icon.as_ref());

    let icon_wrapper_class = AlertClass::AlertIconWrapper.as_class();
    let content_class = AlertClass::AlertContent.as_class();
    let title_class = AlertClass::AlertTitle.as_class();
    let description_class = AlertClass::AlertDescription.as_class();

    // Pre-compute onclick handler for closable button
    let on_close_handler = props.on_close.clone();

    rsx! {
        Glow {
            class: "hi-alert-glow-wrapper".to_string(),
            blur: GlowBlur::Light,
            color: glow_color,
            intensity: GlowIntensity::Soft,
            div {
                class: alert_classes,

                if icon.is_some() {
                    div { class: icon_wrapper_class,
                        { icon.unwrap().clone() }
                    }
                }

                div { class: content_class,

                    if props.title.is_some() {
                        div { class: title_class, "{props.title.as_ref().unwrap()}" }
                    }

                    if props.description.is_some() {
                        div { class: description_class, "{props.description.as_ref().unwrap()}" }
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
                            if let Some(handler) = on_close_handler.as_ref() {
                                handler(e);
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
