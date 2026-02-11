// hi-components/src/basic/switch.rs
// Switch component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, SwitchClass};

use crate::styled::StyledComponent;

#[derive(Clone, PartialEq, Props)]
pub struct SwitchProps {
    /// Whether switch is on
    #[props(default)]
    pub checked: bool,

    /// Callback when checked state changes
    pub on_change: EventHandler<bool>,

    /// Whether switch is disabled
    #[props(default)]
    pub disabled: bool,

    /// Switch size
    #[props(default)]
    pub size: SwitchSize,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Label text (optional)
    #[props(default)]
    pub children: Element,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SwitchSize {
    #[default]
    Medium,
    Small,
    Large,
}

/// Switch component with smooth toggle animation
///
/// A toggle switch for boolean states.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Switch;
///
/// fn app() -> Element {
///     let mut checked = use_signal(|| false);
///
///     rsx! {
///         Switch {
///             checked: checked(),
///             on_change: move |v| checked.set(v),
///         }
///     }
/// }
/// ```
#[component]
pub fn Switch(props: SwitchProps) -> Element {
    let size_class = match props.size {
        SwitchSize::Small => SwitchClass::Sm,
        SwitchSize::Medium => SwitchClass::Md,
        SwitchSize::Large => SwitchClass::Lg,
    };

    let switch_classes = ClassesBuilder::new()
        .add(SwitchClass::Switch)
        .add(size_class)
        .add_if(SwitchClass::Checked, || props.checked)
        .add_if(SwitchClass::Disabled, || props.disabled)
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
            class: "hi-switch-label",
            input {
                class: "hi-switch-input",
                r#type: "checkbox",
                checked: props.checked,
                disabled: props.disabled,
            }
            div {
                class: "{switch_classes}",
                onclick: handle_click,
                div { class: "hi-switch-thumb" }
            }
            span { class: "hi-switch-text",
                { props.children }
            }
        }
    }
}

/// Switch component's type wrapper for StyledComponent
pub struct SwitchComponent;

impl StyledComponent for SwitchComponent {
    fn styles() -> &'static str {
        r#"
.hi-switch-label {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.hi-switch-input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  width: 0;
  height: 0;
}

.hi-switch {
  position: relative;
  background: var(--hi-color-border);
  border-radius: 100px;
  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.hi-switch-sm {
  width: 32px;
  height: 18px;
}

.hi-switch-md {
  width: 44px;
  height: 24px;
}

.hi-switch-lg {
  width: 56px;
  height: 30px;
}

.hi-switch-thumb {
  position: absolute;
  background: white;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.hi-switch-sm .hi-switch-thumb {
  width: 14px;
  height: 14px;
  top: 2px;
  left: 2px;
}

.hi-switch-md .hi-switch-thumb {
  width: 18px;
  height: 18px;
  top: 3px;
  left: 3px;
}

.hi-switch-lg .hi-switch-thumb {
  width: 22px;
  height: 22px;
  top: 4px;
  left: 4px;
}

.hi-switch-checked {
  background: var(--hi-color-primary);
}

.hi-switch-checked .hi-switch-thumb {
  transform: translateX(100%);
}

.hi-switch-sm .hi-switch-checked .hi-switch-thumb {
  transform: translateX(14px);
}

.hi-switch-md .hi-switch-checked .hi-switch-thumb {
  transform: translateX(20px);
}

.hi-switch-lg .hi-switch-checked .hi-switch-thumb {
  transform: translateX(26px);
}

.hi-switch:hover:not(.hi-switch-disabled) {
  background: var(--hi-color-border-hover);
}

.hi-switch-checked:hover:not(.hi-switch-disabled) {
  background: var(--hi-color-primary-hover);
}

.hi-switch-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hi-switch-text {
  font-size: 14px;
  color: var(--hi-text-primary);
  line-height: 1.5;
}

[data-theme="dark"] .hi-switch {
  background: var(--hi-surface);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] .hi-switch-thumb {
  background: var(--hi-text-primary);
}

[data-theme="dark"] .hi-switch-checked {
  background: var(--hi-color-primary);
}

[data-theme="dark"] .hi-switch-text {
  color: var(--hi-text-primary);
}
"#
    }

    fn name() -> &'static str {
        "switch"
    }
}
