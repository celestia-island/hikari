// hi-components/src/basic/radio_group.rs
// RadioGroup component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::ClassesBuilder;

use crate::styled::StyledComponent;

#[derive(Clone, PartialEq, Props)]
pub struct RadioGroupProps {
    /// Name attribute for all radio buttons
    pub name: String,

    /// Currently selected value
    #[props(default)]
    pub value: String,

    /// Callback when selection changes
    pub on_change: EventHandler<String>,

    /// Whether the group is disabled
    #[props(default)]
    pub disabled: bool,

    /// Radio button options
    #[props(default)]
    pub children: Element,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Layout direction
    #[props(default)]
    pub direction: RadioDirection,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum RadioDirection {
    #[default]
    Vertical,
    Horizontal,
}

#[derive(Clone, PartialEq, Props)]
pub struct RadioButtonProps {
    /// Value for this radio button
    pub value: String,

    /// Label text
    #[props(default)]
    pub children: Element,

    /// Whether this radio is disabled
    #[props(default)]
    pub disabled: bool,

    /// Additional CSS class
    #[props(default)]
    pub class: String,
}

/// RadioGroup component with smooth animations
///
/// A group of radio buttons where only one can be selected.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{RadioGroup, RadioButton};
///
/// fn app() -> Element {
///     let mut value = use_signal(|| "option1".to_string());
///
///     rsx! {
///         RadioGroup {
///             name: "options".to_string(),
///             value: value().clone(),
///             on_change: move |v| value.set(v),
///             direction: RadioDirection::Vertical,
///             RadioButton {
///                 value: "option1".to_string(),
///                 "Option 1"
///             }
///             RadioButton {
///                 value: "option2".to_string(),
///                 "Option 2"
///             }
///             RadioButton {
///                 value: "option3".to_string(),
///                 "Option 3"
///             }
///         }
///     }
/// }
/// ```
#[component]
pub fn RadioGroup(props: RadioGroupProps) -> Element {
    let direction_class = match props.direction {
        RadioDirection::Vertical => "hi-radio-group-vertical",
        RadioDirection::Horizontal => "hi-radio-group-horizontal",
    };

    let group_classes = ClassesBuilder::new()
        .add_raw("hi-radio-group")
        .add_raw(direction_class)
        .add_raw(&props.class)
        .build();

    rsx! {
        div { class: "{group_classes}",
            { props.children }
        }
    }
}

/// RadioButton component
#[component]
pub fn RadioButton(props: RadioButtonProps) -> Element {
    let radio_classes = ClassesBuilder::new()
        .add_raw("hi-radio-label")
        .add_raw(&props.class)
        .build();

    rsx! {
        label {
            class: "{radio_classes}",
            input {
                r#type: "radio",
                name: "radio",
                value: "{props.value}",
                disabled: props.disabled,
            }
            div { class: "hi-radio-indicator" }
            span { class: "hi-radio-text",
                { props.children }
            }
        }
    }
}

/// RadioGroup component's type wrapper for StyledComponent
pub struct RadioGroupComponent;

impl StyledComponent for RadioGroupComponent {
    fn styles() -> &'static str {
        r#"
.hi-radio-group {
  display: flex;
  gap: 12px;
}

.hi-radio-group-vertical {
  flex-direction: column;
}

.hi-radio-group-horizontal {
  flex-direction: row;
  align-items: center;
}

.hi-radio-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.hi-radio-label input[type="radio"] {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  width: 0;
  height: 0;
}

.hi-radio-indicator {
  position: relative;
  width: 18px;
  height: 18px;
  border: 2px solid var(--hi-border);
  border-radius: 50%;
  background: var(--hi-background);
  transition: all 0.2s ease;
}

.hi-radio-indicator::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  width: 8px;
  height: 8px;
  background: var(--hi-color-primary);
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.hi-radio-label input[type="radio"]:checked + .hi-radio-indicator {
  border-color: var(--hi-color-primary);
}

.hi-radio-label input[type="radio"]:checked + .hi-radio-indicator::after {
  transform: translate(-50%, -50%) scale(1);
}

.hi-radio-label:hover .hi-radio-indicator:not(:disabled) {
  border-color: var(--hi-color-primary);
}

.hi-radio-label input[type="radio"]:disabled + .hi-radio-indicator {
  opacity: 0.5;
  cursor: not-allowed;
}

.hi-radio-text {
  font-size: 14px;
  color: var(--hi-text-primary);
  line-height: 1.5;
}

[data-theme="dark"] .hi-radio-indicator {
  background: var(--hi-surface);
  border-color: var(--hi-border);
}

[data-theme="dark"] .hi-radio-indicator::after {
  background: var(--hi-color-primary);
}

[data-theme="dark"] .hi-radio-text {
  color: var(--hi-text-primary);
}
"#
    }

    fn name() -> &'static str {
        "radio_group"
    }
}
