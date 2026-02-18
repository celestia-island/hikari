// hi-components/src/basic/icon_button.rs
// IconButton component - Square button with icon only

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{ClassesBuilder, components::ButtonClass};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

/// IconButton size variants
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconButtonSize {
    Small,
    Medium,
    #[default]
    Large,
}

/// IconButton color variants
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconButtonVariant {
    /// Ghost/Borderless - transparent background
    #[default]
    Ghost,
    /// Primary - solid primary color
    Primary,
    /// Secondary - solid secondary color
    Secondary,
    /// Danger - solid danger color
    Danger,
    /// Success - solid success color
    Success,
}

/// IconButton component
///
/// A square button containing only an icon, with optional glow effects.
#[derive(Clone, PartialEq, Props)]
pub struct IconButtonProps {
    /// Icon to display
    pub icon: MdiIcon,

    /// Button size (default: Large = 40px)
    #[props(default)]
    pub size: IconButtonSize,

    /// Button variant/color (default: Ghost)
    #[props(default)]
    pub variant: IconButtonVariant,

    /// Whether to enable glow effect (default: true)
    #[props(default = true)]
    pub glow: bool,

    /// Glow blur amount (default: Medium)
    #[props(default = GlowBlur::Medium)]
    pub glow_blur: GlowBlur,

    /// Glow color (default: Primary)
    #[props(default = GlowColor::Primary)]
    pub glow_color: GlowColor,

    /// Glow intensity (default: Standard)
    #[props(default = GlowIntensity::Seventy)]
    pub glow_intensity: GlowIntensity,

    /// Whether to button is disabled (default: false)
    #[props(default = false)]
    pub disabled: bool,

    /// Custom CSS classes
    #[props(default)]
    pub class: String,

    /// Click handler
    pub onclick: EventHandler<MouseEvent>,
}

/// IconButton component - Square button with icon and glow effects
#[component]
pub fn IconButton(props: IconButtonProps) -> Element {
    let icon_size = 14;

    let size_class = match props.size {
        IconButtonSize::Small => Some(ButtonClass::IconButtonSize24),
        IconButtonSize::Medium => Some(ButtonClass::IconButtonSize32),
        IconButtonSize::Large => Some(ButtonClass::IconButtonSize40),
    };

    let variant_class = match props.variant {
        IconButtonVariant::Ghost => ButtonClass::IconButtonGhost,
        IconButtonVariant::Primary => ButtonClass::IconButtonPrimary,
        IconButtonVariant::Secondary => ButtonClass::IconButtonSecondary,
        IconButtonVariant::Danger => ButtonClass::IconButtonDanger,
        IconButtonVariant::Success => ButtonClass::IconButtonSuccess,
    };

    let mut builder = ClassesBuilder::new()
        .add(ButtonClass::Button)
        .add(ButtonClass::IconButton)
        .add(variant_class);

    if let Some(size) = size_class {
        builder = builder.add(size);
    }

    if props.disabled {
        builder = builder.add(ButtonClass::Disabled);
    }

    let button_classes = builder.add_raw(&props.class).build();

    let icon_classes = ClassesBuilder::new()
        .add(ButtonClass::IconButtonIcon)
        .add_if(ButtonClass::IconButtonDisabled, || props.disabled)
        .build();

    // Determine glow color based on variant
    let glow_color = match props.variant {
        IconButtonVariant::Ghost => props.glow_color,
        IconButtonVariant::Primary => GlowColor::Primary,
        IconButtonVariant::Secondary => GlowColor::Secondary,
        IconButtonVariant::Danger => GlowColor::Danger,
        IconButtonVariant::Success => GlowColor::Success,
    };

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

    if props.glow {
        rsx! {
            Glow {
                blur: props.glow_blur,
                color: glow_color,
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
