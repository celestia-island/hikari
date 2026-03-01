// hi-components/src/basic/icon_button.rs
// IconButton component - Square button with icon only
// Three-layer CSS variable system:
// - Layer1: Foundation variables (foundation.scss)
// - Layer2: Component variables (icon-button-vars.scss)
// - Custom: Runtime overrides via icon_color, animation_id

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
use palette::classes::{components::ButtonClass, ClassesBuilder};

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
/// Supports three-layer CSS variable architecture for runtime customization.
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

    /// Custom icon color (Layer2/Custom override)
    /// Overrides default icon color from CSS variables
    #[props(default)]
    pub icon_color: Option<String>,

    /// Custom background color (Layer2/Custom override)
    /// Overrides default background color from CSS variables
    #[props(default)]
    pub background_color: Option<String>,

    /// Custom border radius (Layer2/Custom override)
    /// Overrides default border radius from CSS variables
    #[props(default)]
    pub border_radius: Option<String>,

    /// Animation ID for AnimationBuilder integration (Custom layer)
    /// Use this to apply runtime animations via AnimationBuilder
    #[props(default)]
    pub animation_id: Option<String>,

    /// Custom CSS variable overrides (Custom layer)
    /// Apply arbitrary CSS variable overrides at runtime
    #[props(default)]
    pub css_vars: Option<Vec<(&'static str, String)>>,

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
    #[props(default = GlowIntensity::Soft)]
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
///
/// # Three-Layer CSS Variable System
///
/// This component supports three-layer CSS variable architecture:
///
/// ## Layer1 - Foundation (Global)
/// Variables defined in `foundation.scss` provide global defaults.
///
/// ## Layer2 - Component
/// Variables defined in `icon-button-vars.scss` provide component-specific defaults.
///
/// ## Custom - Runtime
/// Use `icon_color`, `background_color`, `border_radius`,
/// `animation_id`, or `css_vars` props for runtime overrides.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::IconButton;
/// use hikari_icons::MdiIcon;
///
/// fn app() -> Element {
///     rsx! {
///         // Basic icon button
///         IconButton {
///             icon: MdiIcon::Magnify,
///             onclick: |_| println!("Search clicked"),
///         }
///
///         // With custom color (Custom layer)
///         IconButton {
///             icon: MdiIcon::Heart,
///             icon_color: Some("#ff0000".to_string()),
///             onclick: |_| println!("Like clicked"),
///         }
///
///         // With CSS variable overrides (Custom layer)
///         IconButton {
///             icon: MdiIcon::Star,
///             css_vars: Some(vec![
///                 ("--hi-icon-button-radius", "50%".to_string()),
///                 ("--hi-icon-button-bg-hover", "rgba(255, 215, 0, 0.2)".to_string()),
///             ]),
///             onclick: |_| println!("Star clicked"),
///         }
///     }
/// }
/// ```
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

    let mut css_vars_string = String::new();

    if let Some(color) = &props.icon_color {
        css_vars_string.push_str(&format!("--hi-icon-button-icon-color:{};", color));
        css_vars_string.push_str(&format!("--hi-icon-button-icon-color-hover:{};", color));
        css_vars_string.push_str(&format!("--hi-icon-button-icon-color-active:{};", color));
    }

    if let Some(color) = &props.background_color {
        css_vars_string.push_str(&format!("--hi-icon-button-bg:{};", color));
        css_vars_string.push_str(&format!("--hi-icon-button-bg-hover:{};", color));
    }

    if let Some(radius) = &props.border_radius {
        css_vars_string.push_str(&format!("--hi-icon-button-radius:{};", radius));
    }

    if let Some(vars) = &props.css_vars {
        for (name, value) in vars {
            css_vars_string.push_str(&format!("{}:{};", name, value));
        }
    }

    let style_attr = if css_vars_string.is_empty() {
        None
    } else {
        Some(css_vars_string)
    };

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
            style: style_attr,
            "data-animation-id": props.animation_id,
            disabled: props.disabled,
            onclick: props.onclick,

            Icon {
                icon: props.icon,
                size: icon_size,
                class: "{icon_classes}",
                color: props.icon_color.clone().unwrap_or_else(|| "inherit".to_string()),
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
