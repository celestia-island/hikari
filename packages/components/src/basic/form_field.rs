// packages/components/src/basic/form_field.rs
// FormField component with Arknights + FUI styling

use hikari_palette::classes::{ClassesBuilder, FormFieldClass};

use crate::{prelude::*, styled::StyledComponent};

pub struct FormFieldComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FormFieldStatus {
    #[default]
    Default,
    Error,
    Warning,
    Success,
}

#[define_props]
pub struct FormFieldProps {
    #[default]
    pub label: String,

    #[default(false)]
    pub required: bool,

    #[default]
    pub help_text: Option<String>,

    #[default]
    pub error_message: Option<String>,

    #[default]
    pub status: FormFieldStatus,

    #[default(true)]
    pub show_status: bool,

    #[default]
    pub class: String,

    #[default]
    pub style: String,

    #[default]
    pub children: Element,
}

#[component]
pub fn FormField(props: FormFieldProps) -> Element {
    let wrapper_classes = ClassesBuilder::new()
        .add(FormFieldClass::FormField)
        .add_raw(&props.class)
        .build();

    let status_class = match props.status {
        FormFieldStatus::Default => "",
        FormFieldStatus::Error => "hk-form-field-error",
        FormFieldStatus::Warning => "hk-form-field-warning",
        FormFieldStatus::Success => "hk-form-field-success",
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
            rsx! {
                span { class: "hk-form-field-required", " *" }
            }
        } else {
            VNode::empty()
        };
        Some(rsx! {
            label { class: "hk-form-field-label",
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
            div { class: "hk-form-field-help", "{props.help_text.as_ref().unwrap()}" }
        })
    } else if props.show_status && has_error {
        Some(rsx! {
            div { class: "hk-form-field-error-msg", "{props.error_message.as_ref().unwrap()}" }
        })
    } else {
        None
    };

    rsx! {
        div { class: full_classes, style: props.style,

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
.hk-form-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.hk-form-field-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--hi-color-text-primary);
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.hk-form-field-required {
    color: var(--hi-color-error);
    font-weight: 700;
}

.hk-form-field-help {
    font-size: 0.75rem;
    color: var(--hi-color-text-secondary);
}

.hk-form-field-error-msg {
    font-size: 0.75rem;
    color: var(--hi-color-error);
}

.hk-form-field-warning-msg {
    font-size: 0.75rem;
    color: var(--hi-color-warning);
}

.hk-form-field-success-msg {
    font-size: 0.75rem;
    color: var(--hi-color-success);
}

.hk-form-field-error .hk-form-field-label {
    color: var(--hi-color-error);
}

.hk-form-field-warning .hk-form-field-label {
    color: var(--hi-color-warning);
}

.hk-form-field-success .hk-form-field-label {
    color: var(--hi-color-success);
}
"#
    }

    fn name() -> &'static str {
        "form_field"
    }
}
