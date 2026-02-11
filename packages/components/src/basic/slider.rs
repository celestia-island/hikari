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
    /// Current value
    #[props(default = 0)]
    pub value: i32,

    /// Callback when value changes
    pub on_change: EventHandler<i32>,

    /// Minimum value
    #[props(default = 0)]
    pub min: i32,

    /// Maximum value
    #[props(default = 100)]
    pub max: i32,

    /// Step value
    #[props(default = 1)]
    pub step: i32,

    /// Whether slider is disabled
    #[props(default)]
    pub disabled: bool,

    /// Slider size
    #[props(default)]
    pub size: SliderSize,

    /// Additional CSS class
    #[props(default)]
    pub class: String,
}

/// Slider component with smooth interactions
///
/// A range slider with configurable min/max/step.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Slider;
///
/// fn app() -> Element {
///     let mut value = use_signal(|| 50);
///
///     rsx! {
///         Slider {
///             value: value(),
///             on_change: move |v| value.set(v),
///         }
///     }
/// }
/// }
/// ```
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
        ((props.value - props.min) as f64 / (props.max - props.min) as f64 * 100.0) as i32
    } else {
        0
    };

    rsx! {
        div { class: "{slider_classes}",
            input {
                r#type: "range",
                class: "hi-slider-input",
                value: "{props.value}",
                min: "{props.min}",
                max: "{props.max}",
                step: "{props.step}",
                disabled: props.disabled,
                oninput: move |e| {
                    props.on_change.call(e.value().parse::<i32>().unwrap_or(props.value));
                }
            }
            div { class: "hi-slider-track",
                div { class: "hi-slider-thumb",
                    style: "left: {percent}%;"
                }
            }
        }
    }
}

/// Slider component's type wrapper for StyledComponent
pub struct SliderComponent;

impl StyledComponent for SliderComponent {
    fn styles() -> &'static str {
        r#"
.hi-slider {
  position: relative;
  width: 100%;
  height: 24px;
  display: flex;
  align-items: center;
}

.hi-slider-sm {
  height: 20px;
}

.hi-slider-lg {
  height: 32px;
}

.hi-slider-input {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.hi-slider-track {
  position: relative;
  width: 100%;
  height: 4px;
  background: var(--hi-border);
  border-radius: 2px;
}

.hi-slider-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: var(--hi-color-primary);
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: left 0.1s linear;
}

.hi-slider-thumb::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
}

.hi-slider-disabled {
  opacity: 0.5;
}

.hi-slider-disabled .hi-slider-thumb {
  background: var(--hi-border);
  cursor: not-allowed;
}

[data-theme="dark"] .hi-slider-track {
  background: var(--hi-border);
}

[data-theme="dark"] .hi-slider-thumb {
  background: var(--hi-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] .hi-slider-disabled .hi-slider-thumb {
  background: var(--hi-border);
}
"#
    }

    fn name() -> &'static str {
        "slider"
    }
}
