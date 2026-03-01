// hi-components/src/basic/button.rs
// Button component with Arknights + FUI styling
// Three-layer CSS variable system:
// - Layer1: Foundation variables (foundation.scss)
// - Layer2: Component variables (button-vars.scss)
// - Custom: Runtime overrides via icon_color, text_color, animation_id

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

    /// Custom icon color (Layer2/Custom override)
    /// Overrides the default icon color from CSS variables
    #[props(default)]
    pub icon_color: Option<String>,

    /// Custom text color (Layer2/Custom override)
    /// Overrides the default text color from CSS variables
    #[props(default)]
    pub text_color: Option<String>,

    /// Custom background color (Layer2/Custom override)
    /// Overrides the default background color from CSS variables
    #[props(default)]
    pub background_color: Option<String>,

    /// Custom border color (Layer2/Custom override)
    /// Overrides the default border color from CSS variables
    #[props(default)]
    pub border_color: Option<String>,

    /// Animation ID for AnimationBuilder integration (Custom layer)
    /// Use this to apply runtime animations via AnimationBuilder
    #[props(default)]
    pub animation_id: Option<String>,

    /// Custom CSS variable overrides (Custom layer)
    /// Apply arbitrary CSS variable overrides at runtime
    #[props(default)]
    pub css_vars: Option<Vec<(&'static str, String)>>,

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
            glow_intensity: crate::feedback::GlowIntensity::Soft,
            glow_color: None,
            icon_color: None,
            text_color: None,
            background_color: None,
            border_color: None,
            animation_id: None,
            css_vars: None,
            onclick: None,
        }
    }
}

/// Button component with Arknights + FUI styling
///
/// # Three-Layer CSS Variable System
///
/// This component supports the three-layer CSS variable architecture:
///
/// ## Layer1 - Foundation (Global)
/// Variables defined in `foundation.scss` provide global defaults.
///
/// ## Layer2 - Component
/// Variables defined in `button-vars.scss` provide component-specific defaults.
///
/// ## Custom - Runtime
/// Use `icon_color`, `text_color`, `background_color`, `border_color`,
/// `animation_id`, or `css_vars` props for runtime overrides.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Button;
///
/// fn app() -> Element {
///     rsx! {
///         // Basic button
///         Button { variant: ButtonVariant::Primary, "Click me" }
///
///         // With custom colors (Custom layer)
///         Button {
///             variant: ButtonVariant::Primary,
///             icon_color: Some("#ff0000".to_string()),
///             text_color: Some("#ffffff".to_string()),
///             "Custom Colors"
///         }
///
///         // With CSS variable overrides (Custom layer)
///         Button {
///             variant: ButtonVariant::Ghost,
///             css_vars: Some(vec![
///                 ("--hi-button-radius", "16px".to_string()),
///                 ("--hi-button-bg-hover", "rgba(255, 0, 0, 0.1)".to_string()),
///             ]),
///             "CSS Vars Override"
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

    let animation_attr = match props.animation {
        ButtonAnimation::None => None,
        ButtonAnimation::Scale => Some("scale"),
        ButtonAnimation::ScaleElevate => Some("scale-elevate"),
        ButtonAnimation::Ripple => Some("ripple"),
        ButtonAnimation::IconRotate => Some("icon-rotate"),
    };

    let mut css_vars_string = String::new();

    if let Some(color) = &props.icon_color {
        css_vars_string.push_str(&format!("--hi-button-icon-color:{};", color));
        css_vars_string.push_str(&format!("--hi-button-icon-color-hover:{};", color));
        css_vars_string.push_str(&format!("--hi-button-icon-color-active:{};", color));
    }

    if let Some(color) = &props.text_color {
        css_vars_string.push_str(&format!("--hi-button-text-color:{};", color));
        css_vars_string.push_str(&format!("--hi-button-text-color-hover:{};", color));
        css_vars_string.push_str(&format!("--hi-button-text-color-active:{};", color));
    }

    if let Some(color) = &props.background_color {
        css_vars_string.push_str(&format!("--hi-button-bg:{};", color));
        css_vars_string.push_str(&format!("--hi-button-bg-hover:{};", color));
    }

    if let Some(color) = &props.border_color {
        css_vars_string.push_str(&format!("--hi-button-border-color:{};", color));
        css_vars_string.push_str(&format!("--hi-button-border-color-focus:{};", color));
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

    let button_content = rsx! {
        button {
            class: "{classes}",
            style: style_attr,
            "data-button-animation": animation_attr,
            "data-animation-id": props.animation_id,
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

    if props.glow {
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

        // 统一使用 4px 圆角
        let glow_radius = "4px";

        rsx! {
            Glow {
                blur: props.glow_blur,
                color: glow_color,
                intensity: props.glow_intensity,
                radius: Some(glow_radius.to_string()),
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
