// packages/components/src/entry/auto_complete.rs
// AutoComplete component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{AutoCompleteClass, ClassesBuilder, UtilityClass};

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
///         "TypeScript".to_string(),
///     ];
///
///     rsx! {
///         AutoComplete {
///             value: value(),
///             options: options,
///             placeholder: "Select a language",
///             on_select: move |v| value.set(v),
///         }
///     }
/// }
/// ```
#[derive(Clone, PartialEq, Props)]
pub struct AutoCompleteProps {
    /// Current input value
    #[props(default)]
    pub value: String,

    /// All available options
    pub options: Vec<String>,

    /// Callback when option is selected
    #[props(default)]
    pub on_select: EventHandler<String>,

    /// Placeholder text
    #[props(default)]
    pub placeholder: String,

    /// Whether component is disabled
    #[props(default = false)]
    pub disabled: bool,

    /// Whether to show clear button
    #[props(default = false)]
    pub allow_clear: bool,

    /// Custom classes
    #[props(default)]
    pub class: String,

    /// Custom styles
    #[props(default)]
    pub style: String,
}

impl Default for AutoCompleteProps {
    fn default() -> Self {
        Self {
            value: String::new(),
            options: vec![],
            on_select: EventHandler::new(|_: String| {}),
            placeholder: String::new(),
            disabled: false,
            allow_clear: false,
            class: String::new(),
            style: String::new(),
        }
    }
}

#[component]
pub fn AutoComplete(props: AutoCompleteProps) -> Element {
    let mut is_open = use_signal(|| false);
    let mut focused_index = use_signal(|| 0);
    let mut filtered_options = use_signal(Vec::new);

    // Clone props values before using in effects
    let props_value = props.value.clone();
    let props_options = props.options.clone();

    // Update filtered options when props change
    use_effect(move || {
        let value_lower = props_value.to_lowercase();
        let filtered = props_options
            .iter()
            .filter(|option| {
                option.to_lowercase().starts_with(&value_lower) || value_lower.is_empty()
            })
            .cloned()
            .collect::<Vec<_>>();
        filtered_options.set(filtered);
    });

    // Handle input change
    let handle_input = {
        let on_select = props.on_select;
        move |e: Event<FormData>| {
            on_select.call(e.value());
            is_open.set(true);
            focused_index.set(0);
        }
    };

    // Handle focus
    let handle_focus = move |_| {
        if !props.disabled {
            is_open.set(true);
            focused_index.set(0);
        }
    };

    // Handle blur (close dropdown immediately)
    let handle_blur = move |_| {
        is_open.set(false);
    };

    // Handle option click
    let mut handle_option_click = {
        let on_select = props.on_select;
        move |option: String| {
            on_select.call(option);
            is_open.set(false);
        }
    };

    // Handle keyboard navigation
    let handle_keydown = {
        move |e: KeyboardEvent| {
            if props.disabled {
                return;
            }

            let options = filtered_options.read().clone();
            let current = *focused_index.read();

            match e.key() {
                Key::Enter => {
                    e.prevent_default();
                    if !options.is_empty() && current < options.len() {
                        let selected_option = options[current].clone();
                        handle_option_click(selected_option);
                    }
                }
                Key::ArrowDown => {
                    e.prevent_default();
                    if !options.is_empty() {
                        let next = (current + 1) % options.len();
                        focused_index.set(next);
                    }
                }
                Key::ArrowUp => {
                    e.prevent_default();
                    if !options.is_empty() {
                        let len = options.len();
                        let prev = (current + len - 1) % len;
                        focused_index.set(prev);
                    }
                }
                Key::Escape => {
                    e.prevent_default();
                    is_open.set(false);
                }
                _ => {}
            }
        }
    };

    // Handle clear button
    let handle_clear = {
        let on_select = props.on_select;
        move |_| {
            on_select.call(String::new());
            is_open.set(false);
        }
    };

    let input_classes = ClassesBuilder::new()
        .add(AutoCompleteClass::Input)
        .build();

    let is_open_value = *is_open.read();
    let focused_index_value = *focused_index.read();
    let options_arr = filtered_options.read().clone();

    let wrapper_class = AutoCompleteClass::Wrapper.as_class();

    rsx! {
        div {
            class: "{wrapper_class}",
            style: "position: relative; {props.style}",

            input {
                class: "{input_classes}",
                r#type: "text",
                value: "{props.value}",
                placeholder: "{props.placeholder}",
                disabled: props.disabled,
                oninput: handle_input,
                onfocus: handle_focus,
                onblur: handle_blur,
                onkeydown: handle_keydown,
            }

            if props.allow_clear && !props.value.is_empty() && !props.disabled {
                button {
                    class: "{AutoCompleteClass::Clear.as_class()}",
                    onclick: handle_clear,
                    type: "button",
                    "×"
                }
            }

            if is_open_value && !options_arr.is_empty() {
                div {
                    class: ClassesBuilder::new()
                        .add(AutoCompleteClass::Dropdown)
                        .add(AutoCompleteClass::Show)
                        .add_raw(&props.class)
                        .build(),

                    for index in 0..options_arr.len() {
                        div {
                            class: ClassesBuilder::new()
                                .add(AutoCompleteClass::Option)
                                .add_if(AutoCompleteClass::OptionFocused, || index == focused_index_value)
                                .build(),
                            onclick: move |_| {
                                let options = filtered_options.read();
                                if index < options.len() {
                                    handle_option_click(options[index].clone())
                                }
                            },
                            "{options_arr[index]}"
                        }
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

.hi-autocomplete-option:hover,
.hi-autocomplete-option.hi-autocomplete-option-focused {
    background-color: var(--hi-color-primary);
    color: #ffffff;
}
"#
    }

    fn name() -> &'static str {
        "autocomplete"
    }
}
