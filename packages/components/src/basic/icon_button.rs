// hi-components/src/basic/icon_button.rs
// IconButton component - Square button with icon only

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{components::ButtonClass, ClassesBuilder};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconButtonSize {
    Small,
    Medium,
    #[default]
    Large,
}

/// IconButton component
///
/// A square button containing only an icon, with optional glow effects.
/// Based on Ghost button variant but with square aspect ratio.
#[derive(Clone, PartialEq, Props)]
pub struct IconButtonProps {
    /// Icon to display
    icon: MdiIcon,

    /// Button size (default: Large = 36px)
    #[props(default)]
    size: IconButtonSize,

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
    // Icon size is always 14px, independent of button size
    let icon_size = 14;

    // Determine size class based on button size
    let size_class = match props.size {
        IconButtonSize::Small => Some(ButtonClass::IconButtonSize24),
        IconButtonSize::Medium => Some(ButtonClass::IconButtonSize32),
        IconButtonSize::Large => Some(ButtonClass::IconButtonSize40),
    };

    // Build button classes
    let mut builder = ClassesBuilder::new()
        .add(ButtonClass::Button)
        .add(ButtonClass::Borderless)
        .add(ButtonClass::IconButton);

    // Add size class if valid
    if let Some(size) = size_class {
        builder = builder.add(size);
    }

    // Add disabled class
    if props.disabled {
        builder = builder.add(ButtonClass::Disabled);
    }

    let button_classes = builder.build();

    // Build icon classes using enums
    let mut icon_builder = ClassesBuilder::new().add(ButtonClass::IconButtonIcon);

    if props.disabled {
        icon_builder = icon_builder.add(ButtonClass::IconButtonDisabled);
    }

    let icon_classes = icon_builder.build();

    let button_content = rsx! {
        button {
            class: "{button_classes}",
            disabled: props.disabled,
            onclick: props.onclick,

            Icon {
                icon: props.icon,
                size: icon_size,
                class: "{icon_classes}",
            }
        }
    };

    // Wrap with glow container if enabled
    if props.glow {
        rsx! {
            Glow {
                blur: props.glow_blur,
                color: props.glow_color,
                intensity: props.glow_intensity,
                { button_content }
            }
        }
    } else {
        button_content
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
