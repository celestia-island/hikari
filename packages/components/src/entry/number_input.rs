// packages/components/src/entry/number_input.rs
// NumberInput component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, Display, NumberInputClass};

use crate::styled::StyledComponent;

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
        .add(Display::InlineFlex)
        .add(NumberInputClass::Wrapper)
        .add_raw(&props.class)
        .build();

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

            button {
                class: "hi-number-input-btn hi-number-input-btn-decrement",
                r#type: "button",
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
                    width: "14",
                    height: "14",
                    view_box: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    stroke_width: "2.5",
                    stroke_linecap: "round",
                    line { x1: "5", y1: "12", x2: "19", y2: "12" }
                }
            }

            input {
                class: "hi-number-input-input",
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

            button {
                class: "hi-number-input-btn hi-number-input-btn-increment",
                r#type: "button",
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
                    width: "14",
                    height: "14",
                    view_box: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    stroke_width: "2.5",
                    stroke_linecap: "round",
                    line { x1: "12", y1: "5", x2: "12", y2: "19" }
                    line { x1: "5", y1: "12", x2: "19", y2: "12" }
                }
            }
        }
    }
}

impl StyledComponent for NumberInputComponent {
    fn styles() -> &'static str {
        r#"
.hi-number-input-wrapper {
    display: inline-flex;
    align-items: stretch;
    border-radius: 8px;
    border: 1px solid var(--hi-color-border, #d9d9d9);
    background-color: var(--hi-color-surface, #fff);
    overflow: hidden;
    transition: all 0.2s ease;
}

.hi-number-input-wrapper:focus-within {
    border-color: var(--hi-color-primary, #1890ff);
    box-shadow: 0 0 0 2px var(--hi-color-primary-glow, rgba(24, 144, 255, 0.2));
}

.hi-number-input-sm {
    height: 24px;
    font-size: 12px;
}

.hi-number-input-md {
    height: 32px;
    font-size: 14px;
}

.hi-number-input-lg {
    height: 40px;
    font-size: 16px;
}

.hi-number-input-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 32px;
    padding: 0;
    background-color: var(--hi-color-background, #fafafa);
    border: none;
    color: var(--hi-color-text-secondary, #666);
    cursor: pointer;
    transition: all 0.15s ease;
    outline: none;
}

.hi-number-input-btn-decrement {
    border-right: 1px solid var(--hi-color-border, #d9d9d9);
    border-radius: 7px 0 0 7px;
}

.hi-number-input-btn-increment {
    border-left: 1px solid var(--hi-color-border, #d9d9d9);
    border-radius: 0 7px 7px 0;
}

.hi-number-input-btn:hover:not(:disabled) {
    color: var(--hi-color-primary, #1890ff);
    background-color: var(--hi-color-primary-glow, rgba(24, 144, 255, 0.1));
}

.hi-number-input-btn:active:not(:disabled) {
    transform: scale(0.9);
    background-color: var(--hi-color-primary, #1890ff);
    color: #fff;
}

.hi-number-input-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    color: var(--hi-color-text-disabled, #bfbfbf);
    background-color: transparent;
}

.hi-number-input-btn:focus-visible {
    box-shadow: inset 0 0 0 2px var(--hi-color-primary, #1890ff);
}

.hi-number-input-btn svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
}

.hi-number-input-sm .hi-number-input-btn {
    width: 24px;
}

.hi-number-input-sm .hi-number-input-btn svg {
    width: 12px;
    height: 12px;
}

.hi-number-input-lg .hi-number-input-btn {
    width: 40px;
}

.hi-number-input-lg .hi-number-input-btn svg {
    width: 16px;
    height: 16px;
}

.hi-number-input-input {
    flex: 1;
    min-width: 48px;
    height: 100%;
    padding: 0 8px;
    border: none;
    background-color: transparent;
    color: var(--hi-color-text-primary, #333);
    font-size: inherit;
    text-align: center;
    outline: none;
    font-weight: 500;
}

.hi-number-input-input::-webkit-outer-spin-button,
.hi-number-input-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

.hi-number-input-input[type=number] {
    -moz-appearance: textfield;
}

.hi-number-input-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.hi-number-input-input::placeholder {
    color: var(--hi-color-text-secondary, #999);
}

[data-theme="dark"] .hi-number-input-wrapper {
    background-color: var(--hi-surface, #1a1a1a);
    border-color: var(--hi-border, #333);
}

[data-theme="dark"] .hi-number-input-btn {
    background-color: var(--hi-surface-hover, #252525);
    color: var(--hi-text-secondary, #aaa);
}

[data-theme="dark"] .hi-number-input-btn:hover:not(:disabled) {
    background-color: var(--hi-color-primary-glow, rgba(24, 144, 255, 0.15));
    color: var(--hi-color-primary, #40a9ff);
}

[data-theme="dark"] .hi-number-input-btn:active:not(:disabled) {
    background-color: var(--hi-color-primary, #1890ff);
    color: #fff;
}

[data-theme="dark"] .hi-number-input-btn-decrement {
    border-right-color: var(--hi-border, #333);
}

[data-theme="dark"] .hi-number-input-btn-increment {
    border-left-color: var(--hi-border, #333);
}

[data-theme="dark"] .hi-number-input-input {
    color: var(--hi-text-primary, #e0e0e0);
}
"#
    }

    fn name() -> &'static str {
        "number-input"
    }
}
