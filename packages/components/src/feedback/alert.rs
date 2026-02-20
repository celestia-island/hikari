// hi-components/src/feedback/alert.rs
// Alert component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{AlertClass, ClassesBuilder, UtilityClass};

use crate::{
    basic::{IconButton, IconButtonSize, IconButtonVariant},
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};
use icons::MdiIcon;

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

    let default_icon = match props.variant {
        AlertVariant::Info => Some(rsx! {
            svg {
                class: "{AlertClass::AlertIcon.as_class()}",
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
                class: "{AlertClass::AlertIcon.as_class()}",
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
                class: "{AlertClass::AlertIcon.as_class()}",
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
                class: "{AlertClass::AlertIcon.as_class()}",
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
        Glow {
            class: "hi-alert-glow-wrapper",
            blur: GlowBlur::Light,
            color: glow_color,
            intensity: GlowIntensity::Seventy,
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
