// packages/components/src/entry/number_input.rs
// NumberInput component with Arknights + FUI styling
// Uses InputWrapper for consistent layout

use dioxus::prelude::*;
use icons::MdiIcon;
use palette::classes::{ClassesBuilder, Display, NumberInputClass};

use crate::{
    basic::{InputWrapper, InputWrapperItem, InputWrapperSize},
    feedback::{GlowBlur, GlowColor, GlowIntensity},
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

impl NumberInputSize {
    fn to_wrapper_size(&self) -> InputWrapperSize {
        match self {
            NumberInputSize::Small => InputWrapperSize::Small,
            NumberInputSize::Medium => InputWrapperSize::Medium,
            NumberInputSize::Large => InputWrapperSize::Large,
        }
    }
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

    // Left button (decrement) - interactive
    let left_items = vec![
        InputWrapperItem::Button {
            icon: MdiIcon::Minus,
            onclick: EventHandler::new(move |_| {
                if !props.disabled {
                    let new_value = if let Some(min) = props.min {
                        (props.value - props.step).max(min)
                    } else {
                        props.value - props.step
                    };
                    props.on_change.call(new_value);
                }
            }),
            disabled: props.disabled || decrement_disabled,
        }
    ];

    // Right button (increment) - interactive
    let right_items = vec![
        InputWrapperItem::Button {
            icon: MdiIcon::Plus,
            onclick: EventHandler::new(move |_| {
                if !props.disabled {
                    let new_value = if let Some(max) = props.max {
                        (props.value + props.step).min(max)
                    } else {
                        props.value + props.step
                    };
                    props.on_change.call(new_value);
                }
            }),
            disabled: props.disabled || increment_disabled,
        }
    ];

    // Input element
    let input_element = rsx! {
        input {
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
    };

    rsx! {
        div {
            class: "{wrapper_classes}",
            style: "{props.style}",

            InputWrapper {
                left: left_items,
                right: right_items,
                input: input_element,
                size: props.size.to_wrapper_size(),
                disabled: props.disabled,
                glow: props.glow,
                glow_blur: GlowBlur::None,
                glow_intensity: GlowIntensity::Dim,
                glow_color: GlowColor::Ghost,
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
