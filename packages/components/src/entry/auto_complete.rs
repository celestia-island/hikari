// packages/components/src/entry/auto_complete.rs
// AutoComplete component with Arknights + FUI styling

use hikari_palette::classes::{AutoCompleteClass, ClassesBuilder, UtilityClass};

use crate::{prelude::*, styled::StyledComponent};

pub struct AutoCompleteComponent;

/// Props for the AutoComplete component
#[define_props]
pub struct AutoCompleteProps {
    pub value: String,

    pub options: Vec<String>,

    #[default(EventHandler::new(|_: String| {}))]
    pub on_select: EventHandler<String>,

    pub placeholder: String,

    #[default(false)]
    pub disabled: bool,

    #[default(false)]
    pub allow_clear: bool,

    pub class: String,

    pub style: String,
}

#[component]
pub fn AutoComplete(props: AutoCompleteProps) -> Element {
    let is_open = use_signal(|| false);
    let focused_index = use_signal(|| 0);
    let filtered_options = use_signal(Vec::new);

    // Clone props values before using in effects
    let props_value = props.value.clone();
    let props_options = props.options.clone();

    // Clone signals for use in multiple closures
    let filtered_options_for_effect = filtered_options.clone();

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
        filtered_options_for_effect.set(filtered);
    });

    // Handle input change
    let is_open_for_input = is_open.clone();
    let focused_index_for_input = focused_index.clone();
    let handle_input = {
        let on_select = props.on_select.clone();
        move |e: InputEvent| {
            on_select.call(e.data.clone());
            is_open_for_input.set(true);
            focused_index_for_input.set(0);
        }
    };

    // Handle focus
    let is_open_for_focus = is_open.clone();
    let focused_index_for_focus = focused_index.clone();
    let handle_focus = {
        let disabled = props.disabled;
        move |_| {
            if !disabled {
                is_open_for_focus.set(true);
                focused_index_for_focus.set(0);
            }
        }
    };

    // Handle blur (close dropdown immediately)
    let is_open_for_blur = is_open.clone();
    let handle_blur = move |_| {
        is_open_for_blur.set(false);
    };

    // Handle option click - used in keyboard navigation and click handler
    let is_open_for_click = is_open.clone();
    let handle_option_click = {
        let on_select = props.on_select.clone();
        move |option: String| {
            on_select.call(option);
            is_open_for_click.set(false);
        }
    };

    // Handle keyboard navigation
    let is_open_for_keydown = is_open.clone();
    let focused_index_for_keydown = focused_index.clone();
    let filtered_options_for_keydown = filtered_options.clone();
    let handle_option_click_for_keydown = handle_option_click.clone();
    let handle_keydown = {
        let disabled = props.disabled;
        move |e: KeyboardEvent| {
            if disabled {
                return;
            }

            let options = filtered_options_for_keydown.read().clone();
            let current = focused_index_for_keydown.read();

            match e.get_key() {
                Key::Enter => {
                    e.prevent_default();
                    if !options.is_empty() && current < options.len() {
                        let selected_option = options[current].clone();
                        handle_option_click_for_keydown(selected_option);
                    }
                }
                Key::ArrowDown => {
                    e.prevent_default();
                    if !options.is_empty() {
                        let next = (current + 1) % options.len();
                        focused_index_for_keydown.set(next);
                    }
                }
                Key::ArrowUp => {
                    e.prevent_default();
                    if !options.is_empty() {
                        let len = options.len();
                        let prev = (current + len - 1) % len;
                        focused_index_for_keydown.set(prev);
                    }
                }
                Key::Escape => {
                    e.prevent_default();
                    is_open_for_keydown.set(false);
                }
                _ => {}
            }
        }
    };

    // Handle clear button
    let is_open_for_clear = is_open.clone();
    let handle_clear = {
        let on_select = props.on_select.clone();
        move |_| {
            on_select.call(String::new());
            is_open_for_clear.set(false);
        }
    };

    let input_classes = ClassesBuilder::new().add(AutoCompleteClass::Input).build();

    let is_open_value = is_open.read();
    let focused_index_value = focused_index.read();
    let options_arr = filtered_options.read().clone();

    let wrapper_class = AutoCompleteClass::Wrapper.as_class();

    rsx! {
        div { class: wrapper_class, style: "position: relative; {props.style}",

            input {
                class: input_classes,
                r#type: "text",
                value: "{props.value}",
                placeholder: props.placeholder,
                disabled: props.disabled,
                oninput: handle_input,
                onfocus: handle_focus,
                onblur: handle_blur,
                onkeydown: handle_keydown,
            }

            if props.allow_clear && !props.value.is_empty() && !props.disabled {
                button {
                    class: AutoCompleteClass::Clear.as_class(),
                    onclick: handle_clear,
                    r#type: "button",
                    Icon { icon: MdiIcon::Close, size: 12, class: String::new(), color: String::new() }
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
                            onclick: {
                                let handle_option_click_for_click = handle_option_click.clone();
                                let filtered_options_for_click = filtered_options.clone();
                                move |_| {
                                    let options = filtered_options_for_click.read();
                                    if index < options.len() {
                                        handle_option_click_for_click(options[index].clone())
                                    }
                                }
                            },
                            "{options_arr[index].clone()}"
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
    color: var(--hi-color-text-on-primary, #ffffff);
}
"#
    }

    fn name() -> &'static str {
        "autocomplete"
    }
}
