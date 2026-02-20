// packages/components/src/utils/form/field.rs
// Field Component

use dioxus::prelude::*;

use super::state::FormState;

/// Props for Field component
#[derive(Clone, PartialEq, Props)]
pub struct FieldProps {
    /// Field name (for form registration)
    pub name: String,

    /// Field label
    pub label: String,

    /// Whether the field is required
    #[props(default = false)]
    pub required: bool,

    /// Field help text (optional)
    #[props(default)]
    pub help_text: Option<String>,

    /// Additional CSS class
    #[props(default)]
    pub class: String,

    /// Children - the form input component
    children: Element,

    /// Form state from useForm hook
    #[props(default)]
    pub form_state: Option<FormState<String>>,
}

/// Field component - wrapper that integrates with useForm
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::utils::form::*;
///
/// let form = useForm(|| "".to_string());
///
/// rsx! {
///     Field {
///         name: "username".to_string(),
///         label: "Username".to_string(),
///         required: true,
///         form_state: Some(form.clone()),
///         Input {
///             placeholder: "Enter username"
///         }
///     }
/// }
/// ```
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
        crate::basic::FormField {
            label: props.label.clone(),
            required: props.required,
            help_text: props.help_text.clone(),
            error_message,
            status,
            class: props.class,
            { props.children }
        }
    }
}
