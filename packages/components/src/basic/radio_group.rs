// hi-components/src/basic/radio_group.rs
// RadioGroup component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, RadioClass};
use animation::AnimationBuilder;
use animation::style::CssProperty;
use std::collections::HashMap;

use crate::styled::StyledComponent;

/// Radio button internal props (used with context)
#[derive(Clone, PartialEq, Props)]
pub struct RadioButtonInternalProps {
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

    /// Group name (for radio grouping)
    #[props(default)]
    pub group_name: String,

    /// Currently selected value in the group
    #[props(default)]
    pub selected_value: String,

    /// Callback when this radio is selected
    #[props(default)]
    pub on_select: EventHandler<String>,
}

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

    /// Radio button options (use RadioButtonInternal)
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

/// RadioGroup component with smooth animations
///
/// A group of radio buttons where only one can be selected.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{RadioGroup, RadioButtonInternal};
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
///             RadioButtonInternal {
///                 value: "option1".to_string(),
///                 "Option 1"
///             }
///             RadioButtonInternal {
///                 value: "option2".to_string(),
///                 "Option 2"
///             }
///             RadioButtonInternal {
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
        RadioDirection::Vertical => RadioClass::RadioGroupVertical,
        RadioDirection::Horizontal => RadioClass::RadioGroupHorizontal,
    };

    let group_classes = ClassesBuilder::new()
        .add(RadioClass::RadioGroup)
        .add(direction_class)
        .add_raw(&props.class)
        .build();

    rsx! {
        div { class: "{group_classes}", {props.children} }
    }
}

/// RadioButton component (internal, used with RadioGroup)
///
/// This version uses AnimationBuilder for dot animation.
/// The parent component should pass the group name, selected value, and on_select handler.
#[component]
pub fn RadioButtonInternal(props: RadioButtonInternalProps) -> Element {
    let is_checked = props.selected_value == props.value;
    let radio_name = if props.group_name.is_empty() { "radio-group".to_string() } else { props.group_name.clone() };

    let radio_classes = ClassesBuilder::new()
        .add(RadioClass::Label)
        .add_raw(&props.class)
        .build();

    // Track previous checked state to detect changes
    let mut prev_checked = use_signal(|| is_checked);
    let mut dot_ref: Signal<Option<web_sys::HtmlElement>> = use_signal(|| None);

    // Run animation when checked state changes
    let checked = is_checked;
    use_effect(move || {
        // Only animate if state actually changed
        if *prev_checked.read() != checked {
            prev_checked.set(checked);

            // Get the dot element and animate it
            if let Some(dot_element) = dot_ref.read().clone() {
                let mut elements = HashMap::new();
                elements.insert("dot".to_string(), dot_element.into());

                if checked {
                    // Animate to checked state
                    AnimationBuilder::new(&elements)
                        .add_style("dot", CssProperty::Transform, "translate(-50%, -50%) scale(1)")
                        .apply_with_transition("200ms", "cubic-bezier(0.34, 1.56, 0.64, 1)");
                } else {
                    // Animate to unchecked state
                    AnimationBuilder::new(&elements)
                        .add_style("dot", CssProperty::Transform, "translate(-50%, -50%) scale(0)")
                        .apply_with_transition("200ms", "ease-in");
                }
            }
        }
    });

    // Initial transform based on current state
    let initial_transform = if is_checked { "translate(-50%, -50%) scale(1)" } else { "translate(-50%, -50%) scale(0)" };

    let handle_change = {
        let value = props.value.clone();
        move |_| {
            props.on_select.call(value.clone());
        }
    };

    rsx! {
        label { class: "{radio_classes}",
            input {
                r#type: "radio",
                name: "{radio_name}",
                value: "{props.value}",
                checked: is_checked,
                disabled: props.disabled,
                onchange: handle_change,
            }
            div { class: "hi-radio-indicator",
                div {
                    class: "hi-radio-dot",
                    transform: "{initial_transform}",
                    onmounted: move |evt| {
                        if let Some(elem) = evt.data().downcast::<web_sys::HtmlElement>() {
                            dot_ref.set(Some(elem.clone()));
                        }
                    },
                }
            }
            span { class: "hi-radio-text", {props.children} }
        }
    }
}

// Legacy RadioButton for backward compatibility (deprecated)
#[deprecated(note = "Use RadioButtonInternal instead with RadioGroup")]
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

#[deprecated(note = "Use RadioButtonInternal instead")]
#[component]
pub fn RadioButton(props: RadioButtonProps) -> Element {
    rsx! {
        RadioButtonInternal {
            value: props.value,
            disabled: props.disabled,
            class: props.class,
            {props.children}
        }
    }
}

/// RadioGroup component's type wrapper for StyledComponent
pub struct RadioGroupComponent;

impl StyledComponent for RadioGroupComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/radio.css"))
    }

    fn name() -> &'static str {
        "radio_group"
    }
}
