// hi-components/src/basic/slider.rs
// Slider component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, SliderClass};

use crate::styled::StyledComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SliderSize {
    #[default]
    Medium,
    Small,
    Large,
}

#[derive(Clone, PartialEq, Props)]
pub struct SliderProps {
    #[props(default = 0)]
    pub value: i32,

    pub on_change: EventHandler<i32>,

    #[props(default = 0)]
    pub min: i32,

    #[props(default = 100)]
    pub max: i32,

    #[props(default = 1)]
    pub step: i32,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub size: SliderSize,

    #[props(default)]
    pub class: String,
}

#[component]
pub fn Slider(props: SliderProps) -> Element {
    let size_class = match props.size {
        SliderSize::Small => SliderClass::Sm,
        SliderSize::Medium => SliderClass::Md,
        SliderSize::Large => SliderClass::Lg,
    };

    let slider_classes = ClassesBuilder::new()
        .add(SliderClass::Slider)
        .add(size_class)
        .add_if(SliderClass::Disabled, || props.disabled)
        .add_raw(&props.class)
        .build();

    let percent = if props.max > props.min {
        ((props.value - props.min) as f64 / (props.max - props.min) as f64 * 100.0)
            .clamp(0.0, 100.0)
    } else {
        0.0
    };

    rsx! {
        div { class: "{slider_classes}",
            div { class: "hi-slider-rail" }
            div {
                class: "hi-slider-track",
                style: "width: {percent}%;",
            }
            div {
                class: "hi-slider-handle",
                style: "left: {percent}%;",
            }
            input {
                r#type: "range",
                class: "hi-slider-input",
                value: "{props.value}",
                min: "{props.min}",
                max: "{props.max}",
                step: "{props.step}",
                disabled: props.disabled,
                oninput: move |e| {
                    if let Ok(v) = e.value().parse::<i32>() {
                        let constrained = v.clamp(props.min, props.max);
                        props.on_change.call(constrained);
                    }
                }
            }
        }
    }
}

pub struct SliderComponent;

impl StyledComponent for SliderComponent {
    fn styles() -> &'static str {
        r#"
.hi-slider {
    position: relative;
    width: 100%;
    height: 12px;
    cursor: pointer;
    padding: 4px 0;
}

.hi-slider-sm {
    height: 10px;
}

.hi-slider-lg {
    height: 16px;
}

.hi-slider-rail {
    position: absolute;
    width: 100%;
    height: 4px;
    top: 50%;
    transform: translateY(-50%);
    background-color: var(--hi-color-border, #e8e8e8);
    border-radius: 2px;
}

.hi-slider-track {
    position: absolute;
    height: 4px;
    top: 50%;
    transform: translateY(-50%);
    background-color: var(--hi-color-primary, #1890ff);
    border-radius: 2px;
    transition: width 0.1s ease;
}

.hi-slider-handle {
    position: absolute;
    width: 14px;
    height: 14px;
    top: 50%;
    transform: translate(-50%, -50%);
    background-color: var(--hi-color-primary, #1890ff);
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    z-index: 1;
}

.hi-slider-handle:hover {
    transform: translate(-50%, -50%) scale(1.2);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.hi-slider-input {
    position: absolute;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    margin: 0;
    z-index: 2;
}

.hi-slider-disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.hi-slider-disabled .hi-slider-track {
    background-color: var(--hi-color-text-disabled, #bfbfbf);
}

.hi-slider-disabled .hi-slider-handle {
    background-color: var(--hi-color-text-disabled, #bfbfbf);
    cursor: not-allowed;
}

.hi-slider-disabled .hi-slider-handle:hover {
    transform: translate(-50%, -50%) scale(1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] .hi-slider-rail {
    background-color: var(--hi-border, #333);
}

[data-theme="dark"] .hi-slider-track {
    background-color: var(--hi-color-primary, #1890ff);
}

[data-theme="dark"] .hi-slider-handle {
    background-color: var(--hi-color-primary, #1890ff);
    border-color: var(--hi-surface, #1a1a1a);
}

[data-theme="dark"] .hi-slider-disabled .hi-slider-track {
    background-color: var(--hi-text-disabled, #555);
}

[data-theme="dark"] .hi-slider-disabled .hi-slider-handle {
    background-color: var(--hi-text-disabled, #555);
}
"#
    }

    fn name() -> &'static str {
        "slider"
    }
}
