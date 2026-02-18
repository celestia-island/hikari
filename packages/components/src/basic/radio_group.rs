// hi-components/src/basic/radio_group.rs
// RadioGroup component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, RadioClass};

use crate::styled::StyledComponent;

#[derive(Clone, Copy)]
pub struct RadioContext {
    pub name: &'static str,
    pub selected_value: Signal<String>,
    pub on_change: EventHandler<String>,
    pub disabled: bool,
}

#[derive(Clone, PartialEq, Props)]
pub struct RadioButtonProps {
    pub value: String,
    #[props(default)]
    pub children: Element,
    #[props(default)]
    pub disabled: bool,
    #[props(default)]
    pub class: String,
}

#[component]
pub fn RadioButton(props: RadioButtonProps) -> Element {
    let ctx = use_context::<RadioContext>();
    let is_checked = *ctx.selected_value.read() == props.value;
    let disabled = props.disabled || ctx.disabled;

    let radio_name = ctx.name.to_string();

    let radio_classes = ClassesBuilder::new()
        .add(RadioClass::Label)
        .add_raw(&props.class)
        .build();

    let handle_change = {
        let value = props.value.clone();
        move |_| {
            (ctx.on_change)(value.clone());
        }
    };

    rsx! {
        label { class: "{radio_classes}",
            input {
                r#type: "radio",
                name: "{radio_name}",
                value: "{props.value}",
                checked: is_checked,
                disabled: disabled,
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

#[derive(Clone, PartialEq, Props)]
pub struct RadioGroupProps {
    pub name: String,
    #[props(default)]
    pub value: String,
    pub on_change: EventHandler<String>,
    #[props(default)]
    pub disabled: bool,
    #[props(default)]
    pub children: Element,
    #[props(default)]
    pub class: String,
    #[props(default)]
    pub direction: RadioDirection,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum RadioDirection {
    #[default]
    Vertical,
    Horizontal,
}

#[component]
pub fn RadioGroup(props: RadioGroupProps) -> Element {
    let selected_value = use_signal(|| props.value.clone());

    let name: &'static str = Box::leak(props.name.clone().into_boxed_str());
    let disabled = props.disabled;
    let on_change = props.on_change.clone();

    let _ctx = use_context_provider(|| RadioContext {
        name,
        selected_value,
        on_change,
        disabled,
    });

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

pub struct RadioGroupComponent;

impl StyledComponent for RadioGroupComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/radio.css"))
    }

    fn name() -> &'static str {
        "radio_group"
    }
}
