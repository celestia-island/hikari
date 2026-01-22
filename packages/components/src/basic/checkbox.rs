// hi-components/src/basic/checkbox.rs
// Checkbox component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::ClassesBuilder;

use crate::styled::StyledComponent;

#[derive(Clone, PartialEq, Props)]
pub struct CheckboxProps {
    /// Whether the checkbox is checked
    #[props(default)]
    pub checked: bool,

    /// Callback when checked state changes
    pub on_change: EventHandler<bool>,

    /// Whether the checkbox is disabled
    #[props(default)]
    pub disabled: bool,

    /// Checkbox value for forms
    #[props(default)]
    pub value: Option<String>,

    /// Label text
    #[props(default)]
    pub children: Element,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Checkbox size
    #[props(default)]
    pub size: CheckboxSize,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum CheckboxSize {
    #[default]
    Medium,
    Small,
    Large,
}

/// Checkbox component with smooth animations
///
/// A customizable checkbox with optional label and different sizes.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Checkbox;
///
/// fn app() -> Element {
///     let mut checked = use_signal(|| false);
///
///     rsx! {
///         Checkbox {
///             checked: checked(),
///             on_change: move |v| checked.set(v),
///             "Accept terms and conditions"
///         }
///     }
/// }
/// ```
#[component]
pub fn Checkbox(props: CheckboxProps) -> Element {
    let size_class = match props.size {
        CheckboxSize::Small => "hi-checkbox-sm",
        CheckboxSize::Medium => "hi-checkbox-md",
        CheckboxSize::Large => "hi-checkbox-lg",
    };

    let checkbox_classes = ClassesBuilder::new()
        .add_raw("hi-checkbox")
        .add_raw(size_class)
        .add_raw(if props.checked {
            "hi-checkbox-checked"
        } else {
            ""
        })
        .add_raw(if props.disabled {
            "hi-checkbox-disabled"
        } else {
            ""
        })
        .add_raw(&props.class)
        .build();

    let handle_click = move |e: MouseEvent| {
        if !props.disabled {
            e.stop_propagation();
            props.on_change.call(!props.checked);
        }
    };

    rsx! {
        label {
            class: "hi-checkbox-label",
            input {
                class: "hi-checkbox-input",
                r#type: "checkbox",
                checked: props.checked,
                disabled: props.disabled,
            }
            div {
                class: "{checkbox_classes}",
                onclick: handle_click,
                svg {
                    class: "hi-checkbox-icon",
                    view_box: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    stroke_width: "3",
                    stroke_linecap: "round",
                    stroke_linejoin: "round",
                    polyline { points: "20 6 9 17 4 12" }
                }
            }
            span { class: "hi-checkbox-text",
                { props.children }
            }
        }
    }
}

/// Checkbox component's type wrapper for StyledComponent
pub struct CheckboxComponent;

impl StyledComponent for CheckboxComponent {
    fn styles() -> &'static str {
        r#"
.hi-checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.hi-checkbox-input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  width: 0;
  height: 0;
}

.hi-checkbox {
  position: relative;
  border: 2px solid var(--hi-border);
  background: var(--hi-background);
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hi-checkbox-sm {
  width: 16px;
  height: 16px;
}

.hi-checkbox-md {
  width: 20px;
  height: 20px;
}

.hi-checkbox-lg {
  width: 24px;
  height: 24px;
}

.hi-checkbox:hover:not(.hi-checkbox-disabled) {
  border-color: var(--hi-color-primary);
}

.hi-checkbox-checked {
  background: var(--hi-color-primary);
  border-color: var(--hi-color-primary);
}

.hi-checkbox-icon {
  color: white;
  width: 70%;
  height: 70%;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s ease;
}

.hi-checkbox-checked .hi-checkbox-icon {
  opacity: 1;
  transform: scale(1);
}

.hi-checkbox-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hi-checkbox-text {
  font-size: 14px;
  color: var(--hi-text-primary);
  line-height: 1.5;
}

[data-theme="dark"] .hi-checkbox {
  background: var(--hi-surface);
  border-color: var(--hi-border);
}

[data-theme="dark"] .hi-checkbox-checked {
  background: var(--hi-color-primary);
  border-color: var(--hi-color-primary);
}

[data-theme="dark"] .hi-checkbox-text {
  color: var(--hi-text-primary);
}
"#
    }

    fn name() -> &'static str {
        "checkbox"
    }
}
