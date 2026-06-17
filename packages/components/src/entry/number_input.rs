use hikari_palette::classes::{ClassesBuilder, Display, NumberInputClass};

use crate::prelude::*;
use crate::styled::StyledComponent;
use crate::utils::glow_types::GlowIntensity;

pub struct NumberInputComponent;

#[define_props]
pub struct NumberInputProps {
    #[default(0)]
    pub value: i64,

    #[default(EventHandler::new(|_| {}))]
    pub on_change: EventHandler<i64>,

    pub min: Option<i64>,

    pub max: Option<i64>,

    #[default(1)]
    pub step: i64,

    #[default(false)]
    pub disabled: bool,

    pub size: NumberInputSize,

    pub class: String,

    pub style: String,

    #[default(true)]
    pub glow: bool,

    #[default(GlowIntensity::Soft)]
    pub glow_intensity: GlowIntensity,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum NumberInputSize {
    #[default]
    Medium,
    Small,
    Large,
}

impl NumberInputSize {
    fn size_class(self) -> &'static str {
        match self {
            NumberInputSize::Small => "hi-number-input-sm",
            NumberInputSize::Medium => "hi-number-input-md",
            NumberInputSize::Large => "hi-number-input-lg",
        }
    }
}

#[component]
pub fn NumberInput(props: NumberInputProps) -> Element {
    let wrapper_classes = ClassesBuilder::new()
        .add_typed(Display::InlineFlex)
        .add_typed(NumberInputClass::Wrapper)
        .add(&props.class)
        .build();

    let size_class = props.size.size_class();

    let decrement_disabled = props.min.is_some_and(|min| props.value <= min);
    let increment_disabled = props.max.is_some_and(|max| props.value >= max);

    let disabled_for_dec = props.disabled;
    let min_for_dec = props.min;
    let value_for_dec = props.value;
    let step_for_dec = props.step;
    let on_change_for_dec = props.on_change.clone();

    let disabled_for_inc = props.disabled;
    let max_for_inc = props.max;
    let value_for_inc = props.value;
    let step_for_inc = props.step;
    let on_change_for_inc = props.on_change.clone();

    let value_for_input = props.value;
    let disabled_for_input = props.disabled;
    let min_for_input = props.min;
    let max_for_input = props.max;
    let on_change_for_input = props.on_change.clone();

    rsx! {
        div {
            class: "{wrapper_classes} {size_class}",
            style: "{props.style}",

            button {
                class: "hi-number-input-btn hi-number-input-btn-decrement",
                r#type: "button",
                disabled: props.disabled || decrement_disabled,
                onclick: move |_| {
                    if !disabled_for_dec {
                        let new_value = if let Some(min) = min_for_dec {
                            (value_for_dec - step_for_dec).max(min)
                        } else {
                            value_for_dec - step_for_dec
                        };
                        on_change_for_dec.call(new_value);
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
                value: "{value_for_input}",
                disabled: disabled_for_input,
                oninput: move |e: InputEvent| {
                    if let Ok(val) = e.data.parse::<i64>() {
                        let constrained_val = match (min_for_input, max_for_input) {
                            (Some(min), Some(max)) => val.clamp(min, max),
                            (Some(min), None) => val.max(min),
                            (None, Some(max)) => val.min(max),
                            (None, None) => val,
                        };
                        on_change_for_input.call(constrained_val);
                    }
                }
            }

            button {
                class: "hi-number-input-btn hi-number-input-btn-increment",
                r#type: "button",
                disabled: props.disabled || increment_disabled,
                onclick: move |_| {
                    if !disabled_for_inc {
                        let new_value = if let Some(max) = max_for_inc {
                            (value_for_inc + step_for_inc).min(max)
                        } else {
                            value_for_inc + step_for_inc
                        };
                        on_change_for_inc.call(new_value);
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
        include_str!(concat!(env!("OUT_DIR"), "/styles/number_input.css"))
    }

    fn name() -> &'static str {
        "number-input"
    }
}
