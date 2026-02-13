// packages/components/src/basic/form_field.rs
// FormField component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, FormFieldClass};

use crate::styled::StyledComponent;

/// FormField component type wrapper (for StyledComponent)
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
    /// Field label
    pub label: String,

    /// Whether the field is required
    #[props(default = false)]
    pub required: bool,

    /// Field help text (optional)
    #[props(default)]
    pub help_text: Option<String>,

    /// Field error message (optional)
    #[props(default)]
    pub error_message: Option<String>,

    /// Field status
    #[props(default)]
    pub status: FormFieldStatus,

    /// Whether to show the status icon
    #[props(default = true)]
    pub show_status: bool,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Additional inline style
    #[props(default)]
    pub style: String,

    /// Children - the form input component
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

    rsx! {
        div {
            class: "{wrapper_classes}",
            style: "{props.style}",
            class: "{status_class}",

            // Label
            if !props.label.is_empty() {
                label {
                    class: "hi-form-field-label",
                    { props.label }
                    if props.required {
                        span { class: "hi-form-field-required", " *" }
                    }
                }
            }

            // Children (form input)
            { props.children }

            // Help text or error message
            if let Some(ref help) = props.help_text {
                div { class: "hi-form-field-help", "{help}" }
            } else if props.show_status {
                if let Some(ref error) = props.error_message {
                    div { class: "hi-form-field-error-msg", "{error}" }
                } else if props.status == FormFieldStatus::Success {
                    div { class: "hi-form-field-success-msg", "Valid" }
                } else if props.status == FormFieldStatus::Warning {
                    div { class: "hi-form-field-warning-msg", "Warning" }
                }
            }
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
