// hi-components/src/basic/checkbox.rs
// Checkbox component with Arknights + FUI styling

use hikari_palette::classes::{CheckboxClass, ClassesBuilder};

use crate::{prelude::*, styled::StyledComponent};

#[define_props]
pub struct CheckboxProps {
    #[default(false)]
    pub checked: bool,

    pub on_change: Option<EventHandler<bool>>,

    #[default(false)]
    pub disabled: bool,

    pub value: Option<String>,

    pub children: Element,

    #[default(String::new())]
    pub class: String,

    pub size: CheckboxSize,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum CheckboxSize {
    #[default]
    Medium,
    Small,
    Large,
}

///
///
///
///
///
#[component]
pub fn Checkbox(props: CheckboxProps) -> Element {
    let size_class = match props.size {
        CheckboxSize::Small => CheckboxClass::Sm,
        CheckboxSize::Medium => CheckboxClass::Md,
        CheckboxSize::Large => CheckboxClass::Lg,
    };

    let checkbox_classes = ClassesBuilder::new()
        .add_typed(CheckboxClass::Checkbox)
        .add_typed(size_class)
        .add_typed_if(CheckboxClass::Checked, props.checked)
        .add_typed_if(CheckboxClass::Disabled, props.disabled)
        .add(&props.class)
        .build();

    // Track previous checked state to detect changes
    let mut prev_checked = use_signal(|| props.checked);

    // Run animation when checked state changes
    let checked = props.checked;
    use_effect(move || {
        // Only animate if state actually changed
        if prev_checked.read() != checked {
            prev_checked.set(checked);
        }
    });

    // Use CSS class for icon visibility - no inline styles needed
    // The CSS .hi-checkbox-icon already handles opacity properly via classes

    let handle_click = {
        let on_change = props.on_change;
        move |e: MouseEvent| {
            if !props.disabled {
                e.stop_propagation();
                if let Some(handler) = on_change.as_ref() {
                    handler.call(!props.checked);
                }
            }
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
            div { class: checkbox_classes, onclick: handle_click,
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

pub struct CheckboxComponent;

impl StyledComponent for CheckboxComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/checkbox.css"))
    }

    fn name() -> &'static str {
        "checkbox"
    }
}
