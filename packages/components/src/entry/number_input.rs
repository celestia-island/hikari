// packages/components/src/entry/number_input.rs
// NumberInput component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, Display};

use crate::styled::StyledComponent;

/// NumberInput component type wrapper (for StyledComponent)
pub struct NumberInputComponent;

/// NumberInput component with Arknights + FUI styling
///
/// A number input component with increment/decrement buttons.
/// Supports min/max values, step size, and disabled state.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::NumberInput;
///
/// fn app() -> Element {
///     let mut value = use_signal(|| 0);
///
///     rsx! {
///         NumberInput {
///             value: value(),
///             on_change: move |v| value.set(v),
///             min: 0,
///             max: 100,
///             step: 1,
///         }
///     }
/// }
/// ```
#[derive(Clone, PartialEq, Props)]
pub struct NumberInputProps {
    #[props(default = 0)]
    pub value: i64,

    pub on_change: EventHandler<i64>,

    #[props(default)]
    pub min: Option<i64>,

    #[props(default)]
    pub max: Option<i64>,

    #[props(default = 1)]
    pub step: i64,

    #[props(default = false)]
    pub disabled: bool,

    #[props(default = 4)]
    pub size: u8,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,
}

#[component]
pub fn NumberInput(props: NumberInputProps) -> Element {
    let wrapper_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add_raw("hi-number-input-wrapper")
        .add_raw(&props.class)
        .build();

    let button_classes = ClassesBuilder::new()
        .add_raw("hi-number-input-button")
        .build();

    let input_classes = ClassesBuilder::new()
        .add_raw("hi-number-input-input")
        .build();

    let decrement_disabled = props.min.map_or(false, |min| props.value <= min);
    let increment_disabled = props.max.map_or(false, |max| props.value >= max);

    rsx! {
        div {
            class: "{wrapper_classes}",
            style: "{props.style}",

            button {
                class: "{button_classes}",
                disabled: props.disabled || decrement_disabled,
                onclick: move |_| {
                    if !props.disabled {
                        let new_value = if let Some(min) = props.min {
                            (props.value - props.step).max(min)
                        } else {
                            props.value - props.step
                        };
                        props.on_change.call(new_value);
                    }
                },
                "−"
            }

            input {
                class: "{input_classes}",
                r#type: "number",
                value: "{props.value}",
                min: props.min,
                max: props.max,
                step: props.step,
                disabled: props.disabled,
                oninput: move |e| {
                    if let Ok(val) = e.value().parse::<i64>() {
                        let constrained_val = match (props.min, props.max) {
                            (Some(min), Some(max)) => val.clamp(min, max),
                            (Some(min), None) => val.max(min),
                            (None, Some(max)) => val.min(max),
                            (None, None) => val,
                        };
                        props.on_change.call(constrained_val);
                    }
                }
            }

            button {
                class: "{button_classes}",
                disabled: props.disabled || increment_disabled,
                onclick: move |_| {
                    if !props.disabled {
                        let new_value = if let Some(max) = props.max {
                            (props.value + props.step).min(max)
                        } else {
                            props.value + props.step
                        };
                        props.on_change.call(new_value);
                    }
                },
                "+"
            }
        }
    }
}

impl StyledComponent for NumberInputComponent {
    fn styles() -> &'static str {
        r#"
.hi-number-input-wrapper {
    display: flex;
    align-items: center;
    border-radius: 4px;
    border: 1px solid var(--hi-color-border);
    background-color: var(--hi-color-surface);
    overflow: hidden;
    transition: all 0.2s ease;
}

.hi-number-input-wrapper:focus-within {
    border-color: var(--hi-color-primary);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.hi-number-input-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background-color: transparent;
    border: none;
    color: var(--hi-color-text-primary);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s ease;
}

.hi-number-input-button:hover:not(:disabled) {
    background-color: var(--hi-color-background);
}

.hi-number-input-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.hi-number-input-input {
    flex: 1;
    min-width: 60px;
    height: 36px;
    padding: 0.25rem 0.5rem;
    border: none;
    background-color: transparent;
    color: var(--hi-color-text-primary);
    font-size: 0.875rem;
    text-align: center;
    outline: none;
}

.hi-number-input-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.hi-number-input-input::-webkit-inner-spin-button,
.hi-number-input-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

.hi-number-input-input[type=number] {
    -moz-appearance: textfield;
}
"#
    }

    fn name() -> &'static str {
        "number-input"
    }
}
