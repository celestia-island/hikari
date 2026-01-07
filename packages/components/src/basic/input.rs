// hi-components/src/basic/input.rs
// Input component with Arknights + FUI styling

use dioxus::prelude::*;

use crate::styled::StyledComponent;
use crate::feedback::Spotlight;
use crate::feedback::SpotlightColor;

/// Input 组件的类型包装器（用于实现 StyledComponent）
pub struct InputComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum InputSize {
    #[default]
    Medium,
    Small,
    Large,
}

#[derive(Clone, PartialEq, Props, Default)]
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

    /// Enable spotlight effect (uses Theme color for solid backgrounds)
    #[props(default)]
    pub spotlight: bool,
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
    let size_class = match props.size {
        InputSize::Small => "hi-input-sm",
        InputSize::Medium => "hi-input-md",
        InputSize::Large => "hi-input-lg",
    };

    let disabled_class = if props.disabled {
        "hi-input-disabled"
    } else {
        ""
    };

    let input_content = rsx! {
        div { class: format!("hi-input-wrapper {size_class} {}", props.class),

            if let Some(icon) = props.prefix_icon {
                span { class: "hi-input-prefix", { icon } }
            }

            input {
                class: format!("hi-input {disabled_class}"),
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
                span { class: "hi-input-suffix", { icon } }
            }
        }
    };

    // Wrap with spotlight if enabled
    if props.spotlight {
        rsx! {
            Spotlight {
                color: SpotlightColor::Theme,
                class: "has-solid-bg", // Enable blend mode for solid backgrounds
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
