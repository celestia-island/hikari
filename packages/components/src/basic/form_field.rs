// packages/components/src/basic/form_field.rs
// FormField component with Arknights + FUI styling

use crate::prelude::*;
use hikari_palette::classes::{ClassesBuilder, FormFieldClass};

use crate::styled::StyledComponent;

pub struct FormFieldComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FormFieldStatus {
    #[default]
    Default,
    Error,
    Warning,
    Success,
}

#[derive(Clone, PartialEq, Props)]
pub struct FormFieldProps {
    pub label: String,

    #[props(default = false)]
    pub required: bool,

    #[props(default)]
    pub help_text: Option<String>,

    #[props(default)]
    pub error_message: Option<String>,

    #[props(default)]
    pub status: FormFieldStatus,

    #[props(default = true)]
    pub show_status: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,

    children: Element,
}

#[component]
pub fn FormField(props: FormFieldProps) -> Element {
    let wrapper_classes = ClassesBuilder::new()
        .add(FormFieldClass::FormField)
        .add_raw(&props.class)
        .build();

    let status_class = match props.status {
        FormFieldStatus::Default => "",
        FormFieldStatus::Error => "hi-form-field-error",
        FormFieldStatus::Warning => "hi-form-field-warning",
        FormFieldStatus::Success => "hi-form-field-success",
    };

    let full_classes = if status_class.is_empty() {
        wrapper_classes.clone()
    } else {
        format!("{} {}", wrapper_classes, status_class)
    };

    let has_label = !props.label.is_empty();
    let has_help = props.help_text.is_some();
    let has_error = props.error_message.is_some();

    // Build label element conditionally
    let label_el = if has_label {
        let required_marker = if props.required {
            rsx! { span { class: "hi-form-field-required", " *" } }
        } else {
            VNode::empty()
        };
        Some(rsx! {
            label { class: "hi-form-field-label",
                "{props.label.clone()}"
                {required_marker}
            }
        })
    } else {
        None
    };

    // Build help/error text conditionally
    let help_el = if has_help {
        Some(rsx! {
            div { class: "hi-form-field-help", "{props.help_text.as_ref().unwrap()}" }
        })
    } else if props.show_status && has_error {
        Some(rsx! {
            div { class: "hi-form-field-error-msg", "{props.error_message.as_ref().unwrap()}" }
        })
    } else {
        None
    };

    rsx! {
        div {
            class: full_classes,
            style: props.style,

            // Label
            {label_el.unwrap_or_else(VNode::empty)}

            // Children (form input)
            {props.children}

            // Help text or error message
            {help_el.unwrap_or_else(VNode::empty)}
        }
    }
}

impl StyledComponent for FormFieldComponent {
    fn styles() -> &'static str {
        r#"
.hi-form-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.hi-form-field-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--hi-color-text-primary);
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.hi-form-field-required {
    color: var(--hi-color-error);
    font-weight: 700;
}

.hi-form-field-help {
    font-size: 0.75rem;
    color: var(--hi-color-text-secondary);
}

.hi-form-field-error-msg {
    font-size: 0.75rem;
    color: var(--hi-color-error);
}

.hi-form-field-warning-msg {
    font-size: 0.75rem;
    color: var(--hi-color-warning);
}

.hi-form-field-success-msg {
    font-size: 0.75rem;
    color: var(--hi-color-success);
}

.hi-form-field-error .hi-form-field-label {
    color: var(--hi-color-error);
}

.hi-form-field-warning .hi-form-field-label {
    color: var(--hi-color-warning);
}

.hi-form-field-success .hi-form-field-label {
    color: var(--hi-color-success);
}
"#
    }

    fn name() -> &'static str {
        "form_field"
    }
}
