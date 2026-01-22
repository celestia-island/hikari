// hi-components/src/basic/icon_button.rs
// IconButton component - Square button with icon only

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{components::ButtonClass, ClassesBuilder};

use crate::{
    feedback::{GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

/// IconButton component
///
/// A square button containing only an icon, with optional glow effects.
/// Based on Ghost button variant but with square aspect ratio.
#[derive(Clone, PartialEq, Props)]
pub struct IconButtonProps {
    /// Icon to display
    icon: MdiIcon,

    /// Icon size in pixels (default: 16)
    #[props(default = 16)]
    size: u32,

    /// Whether to enable glow effect (default: true)
    #[props(default = true)]
    glow: bool,

    /// Glow blur amount (default: Medium)
    #[props(default = GlowBlur::Medium)]
    glow_blur: GlowBlur,

    /// Glow color (default: Primary)
    #[props(default = GlowColor::Primary)]
    glow_color: GlowColor,

    /// Glow intensity (default: Standard)
    #[props(default = GlowIntensity::Standard)]
    glow_intensity: GlowIntensity,

    /// Whether to button is disabled (default: false)
    #[props(default = false)]
    disabled: bool,

    /// Custom CSS classes
    #[props(default)]
    class: String,

    /// Click handler
    onclick: EventHandler<MouseEvent>,
}

/// IconButton component - Square button with icon and glow effects
#[component]
pub fn IconButton(props: IconButtonProps) -> Element {
    let size_px = props.size;

    let button_classes = ClassesBuilder::new()
        .add(ButtonClass::Button)
        .add(ButtonClass::Ghost)
        .add_raw(&props.class)
        .build();

    let icon_classes = ClassesBuilder::new()
        .add_raw("hi-icon-button-icon")
        .add_raw(if props.disabled {
            "hi-icon-button-disabled"
        } else {
            ""
        })
        .build();

    let glow_color = match props.glow_color {
        GlowColor::Primary => "rgba(59, 130, 246, 0.5)",
        GlowColor::Danger => "rgba(255, 76, 0, 0.5)",
        GlowColor::Success => "rgba(14, 184, 64, 0.5)",
        GlowColor::Warning => "rgba(245, 158, 11, 0.5)",
        GlowColor::Info => "rgba(139, 92, 246, 0.5)",
        GlowColor::Ghost | GlowColor::Secondary => "rgba(59, 130, 246, 0.5)",
    };

    let glow_style = if props.glow && !props.disabled {
        format!("box-shadow: 0 0 8px {};", glow_color)
    } else {
        String::new()
    };

    rsx! {
        button {
            class: "{button_classes}",
            disabled: props.disabled,
            onclick: props.onclick,
            style: "{glow_style} width: {size_px}px; height: {size_px}px; padding: 0; display: flex; align-items: center; justify-content: center;",

            Icon {
                icon: props.icon,
                size: props.size,
                class: "{icon_classes}",
            }
        }
    }
}

/// IconButton component wrapper (for StyledComponent)
pub struct IconButtonComponent;

impl StyledComponent for IconButtonComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/icon_button.css"))
    }

    fn name() -> &'static str {
        "icon_button"
    }
}
