// packages/components/src/entry/number_input.rs
// NumberInput component with Arknights + FUI styling
// Features: Borderless buttons, unified input styling, independent glow zones using Glow component

use dioxus::prelude::*;
use icons::{Icon, MdiIcon};
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

    #[props(default = true)]
    pub glow: bool,

    #[props(default = GlowIntensity::Soft)]
    pub glow_intensity: GlowIntensity,
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

    let icon_size = match props.size {
        NumberInputSize::Small => 12,
        NumberInputSize::Medium => 14,
        NumberInputSize::Large => 16,
    };

    let decrement_btn = rsx! {
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
            Icon {
                icon: MdiIcon::Minus,
                size: icon_size,
                class: "hi-number-input-icon",
                color: String::new(),
            }
        }
    };

    let increment_btn = rsx! {
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
            Icon {
                icon: MdiIcon::Plus,
                size: icon_size,
                class: "hi-number-input-icon",
                color: String::new(),
            }
        }
    };

    let middle_input = rsx! {
        div {
            class: "hi-number-input-input-wrapper",
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
        }
    };

    rsx! {
        div {
            class: "{wrapper_classes} {size_class}",
            style: "{props.style}",

            if props.glow {
                Glow {
                    intensity: props.glow_intensity,
                    blur: GlowBlur::None,
                    color: GlowColor::Ghost,
                    class: "hi-number-input-glow-btn",
                    { decrement_btn }
                }
            } else {
                { decrement_btn }
            }

            if props.glow {
                Glow {
                    intensity: GlowIntensity::Dim,
                    blur: GlowBlur::None,
                    color: GlowColor::Ghost,
                    class: "hi-number-input-glow-middle",
                    { middle_input }
                }
            } else {
                { middle_input }
            }

            if props.glow {
                Glow {
                    intensity: props.glow_intensity,
                    blur: GlowBlur::None,
                    color: GlowColor::Ghost,
                    class: "hi-number-input-glow-btn",
                    { increment_btn }
                }
            } else {
                { increment_btn }
            }
        }
    }
}

impl StyledComponent for NumberInputComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/number_input.css"))
    }

    fn name() -> &'static str {
        "number-input"
    }
}
