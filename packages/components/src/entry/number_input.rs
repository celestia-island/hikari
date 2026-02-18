// packages/components/src/entry/number_input.rs
// NumberInput component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, Display, NumberInputClass};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

pub struct NumberInputComponent;

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

    #[props(default)]
    pub size: NumberInputSize,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum NumberInputSize {
    #[default]
    Medium,
    Small,
    Large,
}

#[component]
pub fn NumberInput(props: NumberInputProps) -> Element {
    let wrapper_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(NumberInputClass::Wrapper)
        .add_raw(&props.class)
        .build();

    let input_classes = ClassesBuilder::new().add(NumberInputClass::Input).build();

    let decrement_disabled = props.min.is_some_and(|min| props.value <= min);
    let increment_disabled = props.max.is_some_and(|max| props.value >= max);

    let size_class = match props.size {
        NumberInputSize::Small => "hi-number-input-sm",
        NumberInputSize::Medium => "hi-number-input-md",
        NumberInputSize::Large => "hi-number-input-lg",
    };

    rsx! {
        div {
            class: "{wrapper_classes} {size_class}",
            style: "{props.style}",

            Glow {
                blur: GlowBlur::Light,
                color: GlowColor::Ghost,
                intensity: GlowIntensity::Seventy,
                button {
                    class: "hi-number-input-btn hi-number-input-btn-decrement",
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
                    svg {
                        width: "16",
                        height: "16",
                        view_box: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        stroke_width: "2.5",
                        line { x1: "5", y1: "12", x2: "19", y2: "12" }
                    }
                }
            }

            input {
                class: "{input_classes}",
                r#type: "text",
                value: "{props.value}",
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

            Glow {
                blur: GlowBlur::Light,
                color: GlowColor::Ghost,
                intensity: GlowIntensity::Seventy,
                button {
                    class: "hi-number-input-btn hi-number-input-btn-increment",
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
                    svg {
                        width: "16",
                        height: "16",
                        view_box: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        stroke_width: "2.5",
                        line { x1: "12", y1: "5", x2: "12", y2: "19" }
                        line { x1: "5", y1: "12", x2: "19", y2: "12" }
                    }
                }
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
    border-radius: 8px;
    border: 1px solid var(--hi-color-border);
    background-color: var(--hi-color-surface);
    overflow: hidden;
    transition: all 0.2s ease;
}

.hi-number-input-wrapper:focus-within {
    border-color: var(--hi-color-primary);
    box-shadow: 0 0 0 2px var(--hi-color-primary-glow);
}

.hi-number-input-sm {
    height: 28px;
    font-size: 12px;
}

.hi-number-input-md {
    height: 36px;
    font-size: 14px;
}

.hi-number-input-lg {
    height: 44px;
    font-size: 16px;
}

.hi-number-input-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 36px;
    padding: 0;
    background-color: transparent;
    border: none;
    color: var(--hi-color-text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    border-radius: 0;
}

.hi-number-input-btn:hover:not(:disabled) {
    color: var(--hi-color-primary);
    background-color: var(--hi-color-background);
}

.hi-number-input-btn:active:not(:disabled) {
    transform: scale(0.95);
}

.hi-number-input-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    color: var(--hi-color-text-disabled);
}

.hi-number-input-btn svg {
    width: 16px;
    height: 16px;
}

.hi-number-input-input {
    flex: 1;
    min-width: 40px;
    height: 100%;
    padding: 0 0.5rem;
    border: none;
    background-color: transparent;
    color: var(--hi-color-text-primary);
    font-size: inherit;
    text-align: center;
    outline: none;
    font-weight: 500;
}

.hi-number-input-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.hi-number-input-input::placeholder {
    color: var(--hi-color-text-secondary);
}

[data-theme="dark"] .hi-number-input-wrapper {
    background-color: var(--hi-surface);
    border-color: var(--hi-border);
}

[data-theme="dark"] .hi-number-input-btn:hover:not(:disabled) {
    background-color: var(--hi-surface-hover);
}
"#
    }

    fn name() -> &'static str {
        "number-input"
    }
}
