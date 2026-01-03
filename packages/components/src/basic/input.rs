// hikari-components/src/basic/input.rs
// Input component with Arknights + FUI styling

use dioxus::prelude::*;

use crate::styled::StyledComponent;

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
        InputSize::Small => "hikari-input-sm",
        InputSize::Medium => "hikari-input-md",
        InputSize::Large => "hikari-input-lg",
    };

    let disabled_class = if props.disabled {
        "hikari-input-disabled"
    } else {
        ""
    };

    rsx! {
        div { class: format!("hikari-input-wrapper {size_class} {}", props.class),

            if let Some(icon) = props.prefix_icon {
                span { class: "hikari-input-prefix", { icon } }
            }

            input {
                class: format!("hikari-input {disabled_class}"),
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
                span { class: "hikari-input-suffix", { icon } }
            }
        }
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
