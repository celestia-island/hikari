// packages/components/src/utils/form/field.rs
// Field Component

use crate::prelude::*;
use crate::basic::FormField;

use super::state::FormState;

#[derive(Clone, PartialEq, Props)]
pub struct FieldProps {
    pub name: String,

    pub label: String,

    #[props(default = false)]
    pub required: bool,

    #[props(default)]
    pub help_text: Option<String>,

    #[props(default)]
    pub class: String,

    children: Element,

    #[props(default)]
    pub form_state: Option<FormState<String>>,
}

///
///
///
///
#[component]
pub fn Field(props: FieldProps) -> Element {
    // Get error message from form state
    let error_message = match &props.form_state {
        Some(form) => form
            .errors
            .read()
            .get(&props.name)
            .map(|e| e.message.clone()),
        None => None,
    };

    // Get touched state (can be used for conditional styling in the future)
    let _is_touched = match &props.form_state {
        Some(form) => *form.touched.read().get(&props.name).unwrap_or(&false),
        None => false,
    };

    // Determine field status
    let status = if error_message.is_some() {
        crate::basic::form_field::FormFieldStatus::Error
    } else {
        crate::basic::form_field::FormFieldStatus::Default
    };

    rsx! {
        FormField {
            label: props.label.clone(),
            required: props.required,
            help_text: props.help_text.clone(),
            error_message,
            status,
            class: props.class,
            {props.children}
        }
    }
}
