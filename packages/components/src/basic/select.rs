// hi-components/src/basic/select.rs
// Select component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::ClassesBuilder;

use crate::styled::StyledComponent;

/// Select 组件的类型包装器（用于实现 StyledComponent）
pub struct SelectComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SelectSize {
    #[default]
    Md,
    Sm,
    Lg,
}

#[derive(Clone, PartialEq, Props, Default)]
pub struct SelectOption {
    pub label: String,
    pub value: String,
}

#[derive(Clone, PartialEq, Props, Default)]
pub struct SelectProps {
    #[props(default)]
    pub options: Vec<SelectOption>,

    #[props(default)]
    pub placeholder: Option<String>,

    #[props(default)]
    pub size: SelectSize,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub on_change: Option<EventHandler<String>>,
}

/// Select component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Select, SelectOption, SelectSize};
///
/// fn app() -> Element {
///     let mut selected = use_signal(|| String::new());
///
///     rsx! {
///         Select {
///             placeholder: "Select an option".to_string(),
///             size: SelectSize::Md,
///             options: vec![
///                 SelectOption { label: "Option 1".to_string(), value: "1".to_string() },
///                 SelectOption { label: "Option 2".to_string(), value: "2".to_string() },
///             ],
///             on_change: move |value| selected.set(value),
///         }
///     }
/// }
/// ```
#[component]
pub fn Select(props: SelectProps) -> Element {
    let size_class = match props.size {
        SelectSize::Sm => "hi-select-sm",
        SelectSize::Md => "hi-select-md",
        SelectSize::Lg => "hi-select-lg",
    };

    rsx! {
        select {
            class: ClassesBuilder::new()
                .add_raw("hi-select")
                .add_raw(size_class)
                .add_raw(&props.class)
                .add_raw(if props.disabled { "hi-select-disabled" } else { "" })
                .build(),

            disabled: props.disabled,

            onchange: move |e| {
                if let Some(handler) = props.on_change.as_ref() {
                    handler.call(e.value());
                }
            },

            if let Some(placeholder) = props.placeholder {
                option { value: "", disabled: true, selected: true, "{placeholder}" }
            }

            for option in props.options.iter() {
                option { value: "{option.value}", "{option.label}" }
            }
        }
    }
}

impl StyledComponent for SelectComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/select.css"))
    }

    fn name() -> &'static str {
        "select"
    }
}
