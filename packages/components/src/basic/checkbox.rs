// hi-components/src/basic/checkbox.rs
// Checkbox component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, CheckboxClass};

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
        CheckboxSize::Small => CheckboxClass::Sm,
        CheckboxSize::Medium => CheckboxClass::Md,
        CheckboxSize::Large => CheckboxClass::Lg,
    };

    let checkbox_classes = ClassesBuilder::new()
        .add(CheckboxClass::Checkbox)
        .add(size_class)
        .add_if(CheckboxClass::Checked, || props.checked)
        .add_if(CheckboxClass::Disabled, || props.disabled)
        .add_raw(&props.class)
        .build();

    // Track previous checked state to detect changes
    let mut prev_checked = use_signal(|| props.checked);

    // Run animation when checked state changes
    let checked = props.checked;
    use_effect(move || {
        // Only animate if state actually changed
        if *prev_checked.read() != checked {
            prev_checked.set(checked);
        }
    });

    // Use CSS class for icon visibility - no inline styles needed
    // The CSS .hi-checkbox-icon already handles opacity properly via classes

    let handle_click = move |e: MouseEvent| {
        if !props.disabled {
            e.stop_propagation();
            props.on_change.call(!props.checked);
        }
    };

    rsx! {
        label { class: "hi-checkbox-label",
            input {
                class: "hi-checkbox-input",
                r#type: "checkbox",
                checked: props.checked,
                disabled: props.disabled,
            }
            div { class: "{checkbox_classes}", onclick: handle_click,
                svg {
                    class: "hi-checkbox-icon",
                    // No inline opacity/transform - let CSS handle it
                    view_box: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    stroke_width: "3",
                    stroke_linecap: "round",
                    stroke_linejoin: "round",
                    polyline { points: "20 6 9 17 4 12" }
                }
            }
            span { class: "hi-checkbox-text", {props.children} }
        }
    }
}

/// Checkbox component's type wrapper for StyledComponent
pub struct CheckboxComponent;

impl StyledComponent for CheckboxComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/checkbox.css"))
    }

    fn name() -> &'static str {
        "checkbox"
    }
}
