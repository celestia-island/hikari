// hi-components/src/data/pagination_button.rs
// Unified pagination button component with consistent structure

use crate::prelude::*;
use hikari_palette::classes::{ClassesBuilder, PaginationClass};

use crate::{
    basic::{Arrow, ArrowDirection},
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

pub struct PaginationButtonComponent;

#[derive(Clone, PartialEq, Props)]
pub struct PaginationButtonProps {
    pub content: PaginationButtonContent,

    #[props(default = false)]
    pub active: bool,

    #[props(default = false)]
    pub disabled: bool,

    #[props(default)]
    pub class: String,

    pub onclick: EventHandler<MouseEvent>,

    #[props(default = GlowBlur::Medium)]
    pub glow_blur: GlowBlur,

    #[props(default = GlowColor::Primary)]
    pub glow_color: GlowColor,

    #[props(default = GlowIntensity::Dim)]
    pub glow_intensity: GlowIntensity,
}

#[derive(Clone, PartialEq)]
pub enum PaginationButtonContent {
    Arrow {
        direction: ArrowDirection,
        size: u32,
    },

    Text { text: String, font_size: u32 },

    Ellipsis,
}

#[component]
pub fn PaginationButton(props: PaginationButtonProps) -> Element {
    // Build base classes
    let mut builder = ClassesBuilder::new().add(PaginationClass::PaginationItem);

    // Add active state class
    if props.active {
        builder = builder.add(PaginationClass::PaginationActive);
    }

    let button_classes = builder.build();

    // Render button content based on type - ALL buttons use same structure
    let button_element = match props.content {
        PaginationButtonContent::Arrow { direction, size } => rsx! {
            div {
                class: "{button_classes}",
                style: "display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; cursor: pointer; user-select: none;",
                onclick: props.onclick,

                Arrow {
                    direction: direction,
                    size: size,
                }
            }
        },
        PaginationButtonContent::Text { text, font_size: _ } => rsx! {
            div {
                class: "{button_classes}",
                style: "display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; cursor: pointer; user-select: none;",
                onclick: props.onclick,
                "{text}"
            }
        },
        PaginationButtonContent::Ellipsis => rsx! {
            div {
                class: "{button_classes}",
                style: "display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; cursor: pointer; user-select: none; font-size: 14px; font-weight: 600; color: var(--hi-color-text-secondary); letter-spacing: 0.1em;",
                onclick: props.onclick,
                "..."
            }
        },
    };

    // Wrap with glow container for all non-disabled buttons (ghost button style with spotlight)
    if !props.disabled {
        rsx! {
            Glow {
                blur: props.glow_blur,
                color: props.glow_color,
                intensity: props.glow_intensity,
                { button_element }
            }
        }
    } else {
        button_element
    }
}

impl StyledComponent for PaginationButtonComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/pagination.css"))
    }

    fn name() -> &'static str {
        "pagination"
    }
}
