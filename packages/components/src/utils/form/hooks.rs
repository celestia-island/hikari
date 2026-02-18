// packages/components/src/utils/form/hooks.rs
// Dioxus Hooks for Form Management

use std::{collections::HashMap, sync::Arc};

use dioxus::prelude::*;

use super::state::FormState;
use super::validators::ValidationSchema;

/// Hook for managing form state with validation
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::utils::form::*;
///
/// #[component]
/// fn MyForm() -> Element {
///     let form = useForm(|| "".to_string());
///
///     rsx! {
///         Input {
///             placeholder: "Enter username",
///             oninput: move |e| {
///                 form.set_value.call(("username", e.data.value()));
///             }
///         }
///     }
/// }
/// ```
#[allow(non_snake_case)]
pub fn useForm<T, F>(initial_values: F) -> FormState<T>
where
    T: Clone + 'static,
    F: FnOnce() -> T + 'static,
{
    // Form state signals
    let mut values = use_signal(initial_values);
    let mut errors = use_signal(HashMap::new);
    let mut touched = use_signal(HashMap::new);
    let mut is_dirty = use_signal(|| false);
    let is_submitting = use_signal(|| false);

    // Field validators registry
    let mut validators =
        use_signal(HashMap::<String, Arc<dyn ValidationSchema<String> + Send + Sync>>::new);

    // Register a field with validation
    let register = Callback::new(
        move |(field_name, validator): (
            String,
            Arc<dyn ValidationSchema<String> + Send + Sync>,
        )| {
            validators.write().insert(field_name, validator);
        },
    );

    // Set a single field value
    let set_value = {
        Callback::new(move |(field_name, value): (String, String)| {
            // Mark as dirty
            is_dirty.set(true);

            // Mark field as touched
            touched.write().insert(field_name.clone(), true);

            // Validate field if it has a validator
            if let Some(validator) = validators.read().get(&field_name) {
                match validator.validate(&value) {
                    Ok(()) => {
                        errors.write().remove(&field_name);
                    }
                    Err(err) => {
                        errors.write().insert(field_name, err);
                    }
                }
            }
        })
    };

    // Set all form values
    let set_values = {
        Callback::new(move |new_values: T| {
            values.set(new_values);
            is_dirty.set(true);
        })
    };

    // Touch a field (mark as interacted with)
    let touch = {
        Callback::new(move |field_name: String| {
            touched.write().insert(field_name, true);
        })
    };

    // Reset form to initial state
    let reset = {
        let initial = values.read().clone();

        Callback::new(move |_| {
            values.set(initial.clone());
            errors.write().clear();
            touched.write().clear();
            is_dirty.set(false);
        })
    };

    FormState {
        values,
        errors,
        touched,
        is_dirty,
        is_submitting,
        register,
        set_value,
        set_values,
        touch,
        reset,
    }
}
