// hi-components/src/basic/input.rs
// Input component with Arknights + FUI styling
// Three-layer CSS variable system:
// - Layer1: Foundation variables (foundation.scss)
// - Layer2: Component variables (input-vars.scss)
// - Custom: Runtime overrides via text_color, border_color, animation_id

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, InputClass, UtilityClass};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

/// Input 组件的类型包装器（用于实现 StyledComponent）
pub struct InputComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum InputSize {
    Small,
    #[default]
    Medium,
    Large,
}

#[derive(Clone, PartialEq, Props)]
pub struct InputProps {
    #[props(default)]
    pub size: InputSize,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub readonly: bool,

    #[props(default)]
    pub placeholder: Option<String>,

    #[props(default)]
    pub value: Option<String>,

    #[props(default)]
    pub input_type: Option<String>,

    #[props(default)]
    pub autofocus: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub prefix_icon: Option<Element>,

    #[props(default)]
    pub suffix_icon: Option<Element>,

    pub oninput: Option<EventHandler<String>>,

    #[props(default)]
    pub onfocus: Option<EventHandler<FocusEvent>>,

    #[props(default)]
    pub onblur: Option<EventHandler<FocusEvent>>,

    pub onkeydown: Option<EventHandler<KeyboardEvent>>,

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
    /// Uses Ghost glow color (black/white based on theme)
    #[props(default)]
    pub glow_color: GlowColor,

    /// Custom text color (Layer2/Custom override)
    /// Overrides default text color from CSS variables
    #[props(default)]
    pub text_color: Option<String>,

    /// Custom placeholder color (Layer2/Custom override)
    /// Overrides default placeholder color from CSS variables
    #[props(default)]
    pub placeholder_color: Option<String>,

    /// Custom border color (Layer2/Custom override)
    /// Overrides default border color from CSS variables
    #[props(default)]
    pub border_color: Option<String>,

    /// Custom background color (Layer2/Custom override)
    /// Overrides default background color from CSS variables
    #[props(default)]
    pub background_color: Option<String>,

    /// Animation ID for AnimationBuilder integration (Custom layer)
    /// Use this to apply runtime animations via AnimationBuilder
    #[props(default)]
    pub animation_id: Option<String>,

    /// Custom CSS variable overrides (Custom layer)
    /// Apply arbitrary CSS variable overrides at runtime
    #[props(default)]
    pub css_vars: Option<Vec<(&'static str, String)>>,
}

impl Default for InputProps {
    fn default() -> Self {
        Self {
            size: Default::default(),
            disabled: false,
            readonly: false,
            placeholder: None,
            value: None,
            input_type: None,
            autofocus: false,
            class: String::default(),
            prefix_icon: None,
            suffix_icon: None,
            oninput: None,
            onfocus: None,
            onblur: None,
            onkeydown: None,
            glow: true,
            glow_blur: Default::default(),
            glow_intensity: Default::default(),
            glow_color: GlowColor::Ghost,
            text_color: None,
            placeholder_color: None,
            border_color: None,
            background_color: None,
            animation_id: None,
            css_vars: None,
        }
    }
}

/// Input component with Arknights + FUI styling
///
/// # Three-Layer CSS Variable System
///
/// This component supports three-layer CSS variable architecture:
///
/// ## Layer1 - Foundation (Global)
/// Variables defined in `foundation.scss` provide global defaults.
///
/// ## Layer2 - Component
/// Variables defined in `input-vars.scss` provide component-specific defaults.
///
/// ## Custom - Runtime
/// Use `text_color`, `placeholder_color`, `border_color`, `background_color`,
/// `animation_id`, or `css_vars` props for runtime overrides.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Input;
///
/// fn app() -> Element {
///     rsx! {
///         // Basic input
///         Input {
///             placeholder: "Enter your name",
///             value: "Hello",
///         }
///
///         // With custom colors (Custom layer)
///         Input {
///             placeholder: "Custom styled",
///             text_color: Some("#ff0000".to_string()),
///             border_color: Some("#ff4f00".to_string()),
///         }
///
///         // With CSS variable overrides (Custom layer)
///         Input {
///             placeholder: "CSS Vars Override",
///             css_vars: Some(vec![
///                 ("--hi-input-radius", "16px".to_string()),
///                 ("--hi-input-bg", "rgba(0, 0, 0, 0.1)".to_string()),
///             ]),
///         }
///     }
/// }
/// ```
#[component]
pub fn Input(props: InputProps) -> Element {
    let wrapper_classes = ClassesBuilder::new()
        .add(InputClass::InputWrapper)
        .add(match props.size {
            InputSize::Small => InputClass::InputSm,
            InputSize::Medium => InputClass::InputMd,
            InputSize::Large => InputClass::InputLg,
        })
        .add_raw(&props.class)
        .build();

    let input_classes = ClassesBuilder::new()
        .add(InputClass::Input)
        .add_if(InputClass::InputDisabled, || props.disabled)
        .build();

    let mut css_vars_string = String::new();

    if let Some(color) = &props.text_color {
        css_vars_string.push_str(&format!("--hi-input-text-color:{};", color));
    }

    if let Some(color) = &props.placeholder_color {
        css_vars_string.push_str(&format!("--hi-input-placeholder-color:{};", color));
    }

    if let Some(color) = &props.border_color {
        css_vars_string.push_str(&format!("--hi-input-border-color:{};", color));
        css_vars_string.push_str(&format!("--hi-input-wrapper-border-color:{};", color));
    }

    if let Some(color) = &props.background_color {
        css_vars_string.push_str(&format!("--hi-input-bg:{};", color));
        css_vars_string.push_str(&format!("--hi-input-wrapper-bg:{};", color));
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

    let input_content = rsx! {
        div { 
            class: "{wrapper_classes}",
            style: style_attr,
            "data-animation-id": props.animation_id,

            if let Some(icon) = props.prefix_icon {
                span { class: "{InputClass::InputPrefix.as_class()}", { icon } }
            }

            input {
                class: "{input_classes}",
                r#type: props.input_type.unwrap_or("text".to_string()),
                autofocus: props.autofocus,
                disabled: props.disabled,
                readonly: props.readonly,
                placeholder: props.placeholder,
                value: props.value,
                oninput: move |e| {
                    if let Some(handler) = props.oninput.as_ref() {
                        handler.call(e.data.value());
                    }
                },
                onfocus: move |e| {
                    if let Some(handler) = props.onfocus.as_ref() {
                        handler.call(e);
                    }
                },
                onblur: move |e| {
                    if let Some(handler) = props.onblur.as_ref() {
                        handler.call(e);
                    }
                },
                onkeydown: move |e| {
                    if let Some(handler) = props.onkeydown.as_ref() {
                        handler.call(e);
                    }
                },
            }

            if let Some(icon) = props.suffix_icon {
                span { class: "{InputClass::InputSuffix.as_class()}", { icon } }
            }
        }
    };

    if props.glow {
        // 根据输入框尺寸确定圆角
        let glow_radius = match props.size {
            InputSize::Small => "4px",
            InputSize::Medium => "6px",
            InputSize::Large => "8px",
        };

        rsx! {
            Glow {
                blur: props.glow_blur,
                color: props.glow_color,
                intensity: props.glow_intensity,
                radius: Some(glow_radius.to_string()),
                { input_content }
            }
        }
    } else {
        input_content
    }
}

impl StyledComponent for InputComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/input.css"))
    }

    fn name() -> &'static str {
        "input"
    }
}
