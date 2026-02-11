// hi-components/src/basic/checkbox.rs
// Checkbox component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::ClassesBuilder;
use animation::style::{CssProperty, StyleStringBuilder};

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

    // Icon animation state using StyleStringBuilder
    let icon_style = if props.checked {
        // Checked state: scale from 0.3 to 1 with opacity 1
        StyleStringBuilder::new()
            .add(CssProperty::Opacity, "1")
            .add(CssProperty::Transform, "scale(1)")
            .add_custom("transition", "opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)")
            .build_clean()
    } else {
        // Unchecked state: scale to 0.3 with opacity 0
        StyleStringBuilder::new()
            .add(CssProperty::Opacity, "0")
            .add(CssProperty::Transform, "scale(0.3)")
            .add_custom("transition", "opacity 0.2s ease-in, transform 0.2s ease-in")
            .build_clean()
    };

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
                    style: "{icon_style}",
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
