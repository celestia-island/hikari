// hi-components/src/feedback/alert.rs
// Alert component with Arknights + FUI styling

#![expect(clippy::needless_update)]

use hikari_icons::{Icon, MdiIcon};
use hikari_palette::classes::{TypedClass, AlertClass, ClassesBuilder};

use crate::{
    basic::{IconButton, IconButtonSize, IconButtonVariant},
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    prelude::*,
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

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AlertSize {
    #[default]
    Md,
    Sm,
    Lg,
}

#[define_props]
pub struct AlertProps {
    pub variant: AlertVariant,
    pub size: AlertSize,
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

    let size_class = match props.size {
        AlertSize::Sm => AlertClass::Sm,
        AlertSize::Md => AlertClass::Md,
        AlertSize::Lg => AlertClass::Lg,
    };

    let glow_color = match props.variant {
        AlertVariant::Info => GlowColor::Info,
        AlertVariant::Success => GlowColor::Success,
        AlertVariant::Warning => GlowColor::Warning,
        AlertVariant::Error => GlowColor::Danger,
    };

    let alert_classes = ClassesBuilder::new()
        .add_typed(AlertClass::Alert)
        .add_typed(variant_class)
        .add_typed(size_class)
        .add(&props.class)
        .build();

    let default_icon: Option<Element> = match props.variant {
        AlertVariant::Info => Some(rsx! {
            Icon {
                icon: MdiIcon::Information,
                class: AlertClass::AlertIcon.class_name().to_string(),
                size: 20,
                color: "var(--hi-color-primary)".to_string(),
            }
        }),
        AlertVariant::Success => Some(rsx! {
            Icon {
                icon: MdiIcon::Check,
                class: AlertClass::AlertIcon.class_name().to_string(),
                size: 20,
                color: "var(--hi-color-success)".to_string(),
            }
        }),
        AlertVariant::Warning => Some(rsx! {
            Icon {
                icon: MdiIcon::AlertTriangle,
                class: AlertClass::AlertIcon.class_name().to_string(),
                size: 20,
                color: "var(--hi-color-warning)".to_string(),
            }
        }),
        AlertVariant::Error => Some(rsx! {
            Icon {
                icon: MdiIcon::Alert,
                class: AlertClass::AlertIcon.class_name().to_string(),
                size: 20,
                color: "var(--hi-color-danger)".to_string(),
            }
        }),
    };

    let icon = props.icon.as_ref().or(default_icon.as_ref());

    let icon_wrapper_class = AlertClass::AlertIconWrapper.class_name();
    let content_class = AlertClass::AlertContent.class_name();
    let title_class = AlertClass::AlertTitle.class_name();
    let description_class = AlertClass::AlertDescription.class_name();

    // Pre-compute onclick handler for closable button
    let on_close_handler = props.on_close.clone();

    let aria_role = match props.variant {
        AlertVariant::Error | AlertVariant::Warning => "alert",
        AlertVariant::Info | AlertVariant::Success => "status",
    };

    let aria_live = match props.variant {
        AlertVariant::Error | AlertVariant::Warning => "assertive",
        AlertVariant::Info | AlertVariant::Success => "polite",
    };

    rsx! {
        Glow {
            class: "hi-alert-glow-wrapper".to_string(),
            blur: GlowBlur::Light,
            color: glow_color,
            intensity: GlowIntensity::Soft,
            block: true,
            div { class: alert_classes, role: "{aria_role}", "aria-live": "{aria_live}",

                if icon.is_some() {
                    div { class: icon_wrapper_class, {icon.unwrap().clone()} }
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
                        onclick: Some(
                            EventHandler::new(move |e| {
                                if let Some(handler) = on_close_handler.as_ref() {
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

impl StyledComponent for AlertComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/alert.css"))
    }

    fn name() -> &'static str {
        "alert"
    }
}
