// hi-components/src/basic/radio_group.rs
// RadioGroup component with Arknights + FUI styling

use hikari_palette::classes::{ClassesBuilder, RadioClass};

use crate::{prelude::*, styled::StyledComponent};

#[derive(Clone)]
pub struct RadioContext {
    pub name: &'static str,
    pub selected_value: Signal<String>,
    pub on_change: EventHandler<String>,
    pub disabled: bool,
}

#[define_props]
pub struct RadioButtonProps {
    pub value: String,
    pub children: Element,
    #[default(false)]
    pub disabled: bool,
    #[default(String::new())]
    pub class: String,
    pub on_change: Option<EventHandler<String>>,
}

#[component]
pub fn RadioButton(props: RadioButtonProps) -> Element {
    let ctx = use_context::<RadioContext>().expect("RadioContext not found");
    let ctx = ctx.get();
    let is_checked = *ctx.selected_value.read() == props.value;
    let disabled = props.disabled || ctx.disabled;

    let radio_name = ctx.name.to_string();
    let on_change = ctx.on_change.clone();

    let radio_classes = ClassesBuilder::new()
        .add(RadioClass::Label)
        .add_raw(&props.class)
        .build();

    let handle_change = {
        let value = props.value.clone();
        let on_change = props.on_change;
        move |_| {
            if let Some(handler) = on_change.as_ref() {
                handler.call(value.clone());
            }
        }
    };

    rsx! {
        label { class: radio_classes,
            input {
                r#type: "radio",
                name: radio_name,
                value: "{props.value}",
                checked: is_checked,
                disabled,
                onchange: handle_change,
            }
            div { class: "hk-radio-indicator",
                div { class: "hk-radio-dot" }
            }
            span { class: "hk-radio-text", {props.children} }
        }
    }
}

#[define_props]
pub struct RadioGroupProps {
    pub name: String,
    pub value: String,
    pub on_change: Option<EventHandler<String>>,
    #[default(false)]
    pub disabled: bool,
    pub children: Element,
    #[default(String::new())]
    pub class: String,
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
    let on_change = props
        .on_change
        .clone()
        .unwrap_or_else(|| EventHandler::new(|_| {}));

    let _ctx = use_context_provider(move || RadioContext {
        name,
        selected_value: selected_value.inner().clone(),
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
        div { class: group_classes, {props.children} }
    }
}

pub struct RadioGroupComponent;

impl StyledComponent for RadioGroupComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/components/radio.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "radio_group"
    }
}
