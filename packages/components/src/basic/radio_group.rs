// hi-components/src/basic/radio_group.rs
// RadioGroup component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, RadioClass};

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

    /// Currently selected value in group
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

    /// Whether radio group is disabled
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

/// RadioGroup component with FUI styling
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
/// Uses CSS for all styling - no animation code needed.
/// The parent component should pass group name, selected value, and on_select handler.
#[component]
pub fn RadioButtonInternal(props: RadioButtonInternalProps) -> Element {
    let is_checked = props.selected_value == props.value;
    let radio_name = if props.group_name.is_empty() {
        "radio-group".to_string()
    } else {
        props.group_name.clone()
    };

    let radio_classes = ClassesBuilder::new()
        .add(RadioClass::Label)
        .add_raw(&props.class)
        .build();

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
                }
            }
            span { class: "hi-radio-text", {props.children} }
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
