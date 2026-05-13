// hi-components/src/basic/slider.rs
// Slider component with Arknights + FUI styling

use hikari_palette::classes::{ClassesBuilder, SliderClass};

use crate::{prelude::*, styled::StyledComponent};

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SliderSize {
    #[default]
    Medium,
    Small,
    Large,
}

#[define_props]
pub struct SliderProps {
    pub value: i32,

    pub on_change: Option<EventHandler<i32>>,

    pub min: i32,

    pub max: i32,

    pub step: i32,

    pub disabled: bool,

    pub size: SliderSize,

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
        .add_typed(SliderClass::Slider)
        .add_typed(size_class)
        .add_typed_if(SliderClass::Disabled, props.disabled)
        .add(&props.class)
        .build();

    let percent = if props.max > props.min {
        ((props.value - props.min) as f64 / (props.max - props.min) as f64 * 100.0)
            .clamp(0.0, 100.0)
    } else {
        0.0
    };

    rsx! {
        div { class: slider_classes,
            div { class: "hi-slider-rail" }
            div { class: "hi-slider-track", style: "width: {percent}%;" }
            div { class: "hi-slider-handle", style: "left: {percent}%;" }
            input {
                r#type: "range",
                class: "hi-slider-input",
                value: "{props.value}",
                min: "{props.min}",
                max: "{props.max}",
                step: "{props.step}",
                disabled: props.disabled,
                oninput: move |e: InputEvent| {
                    if let Ok(v) = e.data.parse::<i32>() {
                        let constrained = v.clamp(props.min, props.max);
                        if let Some(handler) = &props.on_change {
                            handler.call(constrained);
                        }
                    }
                },
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
    border: 2px solid var(--hi-color-bg-container, #fff);
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    z-index: 1;
}

.hi-slider-handle:hover {
    transform: translate(-50%, -50%) scale(1.2);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.hi-slider-handle:focus-visible {
    outline: 2px solid var(--hi-color-primary, #1890ff);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(var(--hi-color-primary-rgb, 24, 144, 255), 0.2);
}

.hi-slider-handle:active {
    transform: translate(-50%, -50%) scale(1.1);
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

[data-theme="dark"] .hi-slider-handle:focus-visible {
    outline: 2px solid var(--hi-color-primary, #1890ff);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(var(--hi-color-primary-rgb, 24, 144, 255), 0.3);
}
"#
    }

    fn name() -> &'static str {
        "slider"
    }
}
