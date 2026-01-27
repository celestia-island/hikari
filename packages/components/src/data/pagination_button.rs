// hi-components/src/data/pagination_button.rs
// Unified pagination button component with consistent structure

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, PaginationClass};

use crate::{
    basic::{Arrow, ArrowDirection},
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

/// Pagination button wrapper (for StyledComponent)
pub struct PaginationButtonComponent;

/// Pagination button props
#[derive(Clone, PartialEq, Props)]
pub struct PaginationButtonProps {
    /// Button content (arrow or text)
    pub content: PaginationButtonContent,

    /// Whether button is active/selected
    #[props(default = false)]
    pub active: bool,

    /// Whether button is disabled
    #[props(default = false)]
    pub disabled: bool,

    /// Custom CSS classes
    #[props(default)]
    pub class: String,

    /// Click handler
    pub onclick: EventHandler<MouseEvent>,

    /// Glow blur amount (default: Medium)
    #[props(default = GlowBlur::Medium)]
    pub glow_blur: GlowBlur,

    /// Glow color (default: Primary)
    #[props(default = GlowColor::Primary)]
    pub glow_color: GlowColor,

    /// Glow intensity (default: Subtle)
    #[props(default = GlowIntensity::Subtle)]
    pub glow_intensity: GlowIntensity,
}

/// Pagination button content types
#[derive(Clone, PartialEq)]
pub enum PaginationButtonContent {
    /// Arrow content with direction and size
    Arrow {
        direction: ArrowDirection,
        size: u32,
    },

    /// Text content with font size
    Text { text: String, font_size: u32 },

    /// Ellipsis for large page counts
    Ellipsis,
}

/// Pagination button component - unified structure solution
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
