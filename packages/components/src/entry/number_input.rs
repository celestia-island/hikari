// packages/components/src/entry/number_input.rs
// NumberInput component with Arknights + FUI styling
// Uses InputWrapper for consistent layout

use hikari_icons::MdiIcon;
use hikari_palette::classes::{ClassesBuilder, Display, NumberInputClass};

use crate::{
    basic::{InputWrapper, InputWrapperItem, InputWrapperSize},
    feedback::{GlowBlur, GlowColor, GlowIntensity},
    prelude::*,
    styled::StyledComponent,
};

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
    fn to_wrapper_size(self) -> InputWrapperSize {
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

    // Clone props for left button
    let disabled_for_left = props.disabled;
    let min_for_left = props.min;
    let value_for_left = props.value;
    let step_for_left = props.step;
    let on_change_for_left = props.on_change.clone();

    // Left button (decrement) - interactive
    let left_items = vec![InputWrapperItem::Button {
        icon: MdiIcon::Minus,
        onclick: EventHandler::new(move |_| {
            if !disabled_for_left {
                let new_value = if let Some(min) = min_for_left {
                    (value_for_left - step_for_left).max(min)
                } else {
                    value_for_left - step_for_left
                };
                on_change_for_left.call(new_value);
            }
        }),
        disabled: props.disabled || decrement_disabled,
        icon_color: None,
    }];

    // Clone props for right button
    let disabled_for_right = props.disabled;
    let max_for_right = props.max;
    let value_for_right = props.value;
    let step_for_right = props.step;
    let on_change_for_right = props.on_change.clone();

    // Right button (increment) - interactive
    let right_items = vec![InputWrapperItem::Button {
        icon: MdiIcon::Plus,
        onclick: EventHandler::new(move |_| {
            if !disabled_for_right {
                let new_value = if let Some(max) = max_for_right {
                    (value_for_right + step_for_right).min(max)
                } else {
                    value_for_right + step_for_right
                };
                on_change_for_right.call(new_value);
            }
        }),
        disabled: props.disabled || increment_disabled,
        icon_color: None,
    }];

    // Clone props for input
    let value_for_input = props.value;
    let disabled_for_input = props.disabled;
    let min_for_input = props.min;
    let max_for_input = props.max;
    let on_change_for_input = props.on_change.clone();

    // Input element
    let input_element = rsx! {
        input {
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
            },
        }
    };

    rsx! {
        div { class: wrapper_classes, style: props.style,

            InputWrapper {
                left: left_items,
                right: right_items,
                input: Some(input_element),
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
