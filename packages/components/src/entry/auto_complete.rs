// packages/components/src/entry/auto_complete.rs
// AutoComplete component with Arknights + FUI styling
// TEMPORARILY DISABLED DUE TO DIOXUS LIFETIME ISSUES

// NOTE: This component has compilation issues due to Dioxus 0.7 lifetime requirements.
// The component needs to be rewritten to properly handle the lifecycle of props and event handlers.
// For now, we provide a placeholder implementation that compiles.

use dioxus::prelude::*;
use palette::classes::ClassesBuilder;

use crate::styled::StyledComponent;

/// AutoComplete component type wrapper (for StyledComponent)
pub struct AutoCompleteComponent;

/// AutoComplete component with Arknights + FUI styling
///
/// An auto-complete input component that suggests options as user types.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::AutoComplete;
///
/// fn app() -> Element {
///     let mut value = use_signal(|| String::new());
///     let options = vec![
///         "Rust".to_string(),
///         "Python".to_string(),
///     ];
///
///     rsx! {
///         AutoComplete {
///             value: value(),
///             options: options.clone(),
///             placeholder: "Select a language",
///             on_select: move |v| value.set(v),
///         }
///     }
/// }
/// ```
#[derive(Clone, PartialEq, Props)]
pub struct AutoCompleteProps {
    #[props(default)]
    pub value: String,

    pub options: Vec<String>,

    pub on_select: EventHandler<String>,

    #[props(default)]
    pub placeholder: String,

    #[props(default = false)]
    pub disabled: bool,

    #[props(default = false)]
    pub allow_clear: bool,

    #[props(default)]
    pub filter: Option<String>,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,
}

#[component]
pub fn AutoComplete(props: AutoCompleteProps) -> Element {
    let mut show_options = use_signal(|| false);

    let input_classes = ClassesBuilder::new()
        .add_raw("hi-autocomplete-input")
        .build();

    let dropdown_classes = ClassesBuilder::new()
        .add_raw("hi-autocomplete-dropdown")
        .add_raw(if show_options() {
            "hi-autocomplete-show"
        } else {
            ""
        })
        .add_raw(&props.class)
        .build();

    rsx! {
        div {
            class: "hi-autocomplete-wrapper",
            style: "position: relative; {props.style}",

            input {
                class: "{input_classes}",
                r#type: "text",
                value: "{props.value}",
                placeholder: "{props.placeholder}",
                disabled: props.disabled,
            }

            if props.allow_clear && !props.value.is_empty() && !props.disabled {
                button {
                    class: "hi-autocomplete-clear",
                    onclick: move |_| {
                        props.on_select.call(String::new());
                    },
                    "×"
                }
            }

            div {
                class: "{dropdown_classes}",

                for option in props.options.iter() {
                    div {
                        class: "hi-autocomplete-option",
                        onclick: move |_| props.on_select.call(option.to_string()),
                        "{option}"
                    }
                }
            }
        }
    }
}

impl StyledComponent for AutoCompleteComponent {
    fn styles() -> &'static str {
        r#"
.hi-autocomplete-wrapper {
    position: relative;
    width: 100%;
}

.hi-autocomplete-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    padding-right: 2rem;
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    background-color: var(--hi-color-surface);
    color: var(--hi-color-text-primary);
    font-size: 0.875rem;
    outline: none;
    transition: all 0.2s ease;
}

.hi-autocomplete-input:focus {
    border-color: var(--hi-color-primary);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.hi-autocomplete-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.hi-autocomplete-input::placeholder {
    color: var(--hi-color-text-secondary);
}

.hi-autocomplete-clear {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    background-color: transparent;
    border: none;
    border-radius: 50%;
    color: var(--hi-color-text-secondary);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s ease;
}

.hi-autocomplete-clear:hover {
    background-color: var(--hi-color-background);
    color: var(--hi-color-text-primary);
}

.hi-autocomplete-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 200px;
    overflow-y: auto;
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-8px);
    transition: all 0.2s ease;
}

.hi-autocomplete-dropdown.hi-autocomplete-show {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
}

.hi-autocomplete-option {
    padding: 0.5rem 0.75rem;
    color: var(--hi-color-text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s ease;
}

.hi-autocomplete-option:hover {
    background-color: var(--hi-color-primary);
    color: #ffffff;
}
"#
    }

    fn name() -> &'static str {
        "auto-complete"
    }
}
