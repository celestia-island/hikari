// hi-components/src/basic/input.rs
// Input component with Arknights + FUI styling

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
    #[default]
    Medium,
    Small,
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
}

impl Default for InputProps {
    fn default() -> Self {
        Self {
            size: Default::default(),
            disabled: false,
            readonly: false,
            placeholder: None,
            value: None,
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
        }
    }
}

/// Input component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Input;
///
/// fn app() -> Element {
///     rsx! {
///         Input {
///             placeholder: "Enter your name",
///             value: "Hello",
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

    let input_content = rsx! {
        div { class: "{wrapper_classes}",

            if let Some(icon) = props.prefix_icon {
                span { class: "{InputClass::InputPrefix.as_class()}", { icon } }
            }

            input {
                class: "{input_classes}",
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

    // Wrap with glow if enabled
    if props.glow {
        rsx! {
            Glow {
                blur: props.glow_blur,
                color: props.glow_color,
                intensity: props.glow_intensity,
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
