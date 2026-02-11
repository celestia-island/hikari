// hi-components/src/basic/button.rs
// Button component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ButtonClass, ClassesBuilder, JustifyContent};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

/// Animation types for button hover/focus effects
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonAnimation {
    /// No animation
    #[default]
    None,
    /// Subtle scale animation (1.0 → 1.05)
    Scale,
    /// Scale with shadow elevation
    ScaleElevate,
    /// Ripple effect on click
    Ripple,
    /// Icon rotation (if icon present)
    IconRotate,
}

/// Button component type wrapper (for implementing StyledComponent)
pub struct ButtonComponent;

/// Button visual variants
///
/// Different visual styles for a button component.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonVariant {
    /// Primary button (most prominent, uses primary color)
    #[default]
    Primary,
    /// Secondary button (less prominent)
    Secondary,
    /// Ghost button (transparent background, border only)
    Ghost,
    /// Borderless button (no border, minimal styling)
    Borderless,
    /// Danger button (uses danger color for destructive actions)
    Danger,
    /// Success button (uses success color for positive actions)
    Success,
}

/// Button size variants
///
/// Different size options for a button component.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonSize {
    /// Medium size (default)
    #[default]
    Medium,
    /// Small size (compact)
    Small,
    /// Large size (prominent)
    Large,
}

/// Button width variants
///
/// Different width options for a button component.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonWidth {
    /// Auto width (default)
    #[default]
    Auto,
    /// Fixed width 120px
    Width120,
    /// Fixed width 140px
    Width140,
    /// Fixed width 160px
    Width160,
}

#[derive(Clone, PartialEq, Props)]
pub struct ButtonProps {
    #[props(default)]
    pub variant: ButtonVariant,

    #[props(default)]
    pub size: ButtonSize,

    #[props(default)]
    pub width: ButtonWidth,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub loading: bool,

    #[props(default)]
    pub block: bool,

    /// Prefix icon (displayed before text)
    #[props(default)]
    pub icon: Option<Element>,

    /// Suffix icon (displayed after text)
    #[props(default)]
    pub suffix: Option<Element>,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub animation: ButtonAnimation,

    /// Enable glow effect (Win10-style blur and mouse-following highlight)
    #[props(default = true)]
    pub glow: bool,

    /// Glow blur intensity (requires glow: true)
    #[props(default)]
    pub glow_blur: GlowBlur,

    /// Glow intensity (requires glow: true)
    #[props(default)]
    pub glow_intensity: GlowIntensity,

    /// Glow color mode (requires glow: true)
    /// If not specified, automatically determined by button variant based on background lightness
    #[props(default)]
    pub glow_color: Option<GlowColor>,

    pub onclick: Option<EventHandler<MouseEvent>>,
}

impl Default for ButtonProps {
    fn default() -> Self {
        Self {
            variant: Default::default(),
            size: Default::default(),
            width: Default::default(),
            disabled: false,
            loading: false,
            block: false,
            icon: None,
            suffix: None,
            children: VNode::empty(),
            class: String::default(),
            animation: Default::default(),
            glow: true,
            glow_blur: Default::default(),
            glow_intensity: crate::feedback::GlowIntensity::Seventy,
            glow_color: None,
            onclick: None,
        }
    }
}

/// Button component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Button;
///
/// fn app() -> Element {
///     rsx! {
///         Button { variant: ButtonVariant::Primary, "Click me" }
///         Button { variant: ButtonVariant::Secondary, "Cancel" }
///         Button {
///             variant: ButtonVariant::Primary,
///             spotlight: true,
///             "Button with Spotlight"
///         }
///     }
/// }
/// ```
#[component]
pub fn Button(props: ButtonProps) -> Element {
    let variant_class = match props.variant {
        ButtonVariant::Primary => ButtonClass::Primary,
        ButtonVariant::Secondary => ButtonClass::Secondary,
        ButtonVariant::Ghost => ButtonClass::Ghost,
        ButtonVariant::Borderless => ButtonClass::Borderless,
        ButtonVariant::Danger => ButtonClass::Danger,
        ButtonVariant::Success => ButtonClass::Success,
    };

    let size_class = match props.size {
        ButtonSize::Small => ButtonClass::Sm,
        ButtonSize::Medium => ButtonClass::Md,
        ButtonSize::Large => ButtonClass::Lg,
    };

    let width_class = match props.width {
        ButtonWidth::Auto => ButtonClass::WidthAuto,
        ButtonWidth::Width120 => ButtonClass::Width120,
        ButtonWidth::Width140 => ButtonClass::Width140,
        ButtonWidth::Width160 => ButtonClass::Width160,
    };

    let disabled = props.disabled || props.loading;

    // Auto-determine justify-content: space-between if both icon and suffix exist, else center
    let has_both_sides = props.icon.is_some() && props.suffix.is_some();
    let justify_content = if has_both_sides {
        JustifyContent::Between
    } else {
        JustifyContent::Center
    };

    let classes = ClassesBuilder::new()
        .add(ButtonClass::Button)
        .add(variant_class)
        .add(size_class)
        .add(width_class)
        .add_if(ButtonClass::Loading, || props.loading)
        .add_if(ButtonClass::Block, || props.block)
        .add(justify_content)
        .add_if(ButtonClass::SpaceBetween, || has_both_sides)
        .add_raw(&props.class)
        .build();

    // Convert animation type to data attribute value
    let animation_attr = match props.animation {
        ButtonAnimation::None => None,
        ButtonAnimation::Scale => Some("scale"),
        ButtonAnimation::ScaleElevate => Some("scale-elevate"),
        ButtonAnimation::Ripple => Some("ripple"),
        ButtonAnimation::IconRotate => Some("icon-rotate"),
    };

    let button_content = rsx! {
        button {
            class: "{classes}",
            "data-button-animation": animation_attr,
            disabled: disabled,
            onclick: move |e| {
                if let Some(handler) = props.onclick.as_ref() {
                    handler(e);
                }
            },

            if props.loading {
                span { class: "hi-button-spinner", "" }
            }

            if let Some(icon) = props.icon {
                span {
                    class: "hi-button-icon",
                    "data-button-icon": "true",
                    { icon }
                }
            }

            { props.children }

            if let Some(suffix) = props.suffix {
                span {
                    class: "hi-button-suffix",
                    "data-button-suffix": "true",
                    { suffix }
                }
            }
        }
    };

    // Wrap with glow container if enabled
    if props.glow {
        // Determine glow color based on variant and button background lightness
        let glow_color = if let Some(color) = props.glow_color {
            color
        } else {
            match props.variant {
                ButtonVariant::Ghost => GlowColor::Ghost,
                ButtonVariant::Borderless => GlowColor::Ghost,
                ButtonVariant::Primary => GlowColor::Primary,
                ButtonVariant::Secondary => GlowColor::Secondary,
                ButtonVariant::Danger => GlowColor::Danger,
                ButtonVariant::Success => GlowColor::Success,
            }
        };

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

impl StyledComponent for ButtonComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/button.css"))
    }

    fn name() -> &'static str {
        "button"
    }
}
