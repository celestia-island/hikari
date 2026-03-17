// packages/components/src/utils/form/hooks.rs
// Dioxus Hooks for Form Management

use std::{collections::HashMap, sync::Arc};

use crate::prelude::*;

use super::{state::FormState, validators::ValidationSchema};

///
///
///
///
#[allow(non_snake_case)]
pub fn useForm<T, F>(initial_values: F) -> FormState<T>
where
    T: Clone + 'static,
    F: FnOnce() -> T + 'static,
{
    // Form state signals
    let values = use_signal(initial_values);
    let errors = use_signal(HashMap::new);
    let touched = use_signal(HashMap::new);
    let is_dirty = use_signal(|| false);
    let is_submitting = use_signal(|| false);

    // Field validators registry
    let validators =
        use_signal(HashMap::<String, Arc<dyn ValidationSchema<String> + Send + Sync>>::new);

    // Register a field with validation
    let validators_for_register = validators.clone();
    let register = Callback::new(
        move |(field_name, validator): (
            String,
            Arc<dyn ValidationSchema<String> + Send + Sync>,
        )| {
            validators_for_register.write().insert(field_name, validator);
        },
    );

    // Set a single field value
    let is_dirty_for_set = is_dirty.clone();
    let touched_for_set = touched.clone();
    let validators_for_set = validators.clone();
    let errors_for_set = errors.clone();
    let set_value = {
        Callback::new(move |(field_name, value): (String, String)| {
            // Mark as dirty
            is_dirty_for_set.set(true);

            // Mark field as touched
            touched_for_set.write().insert(field_name.clone(), true);

            // Validate field if it has a validator
            if let Some(validator) = validators_for_set.read().get(&field_name) {
                match validator.validate(&value) {
                    Ok(()) => {
                        errors_for_set.write().remove(&field_name);
                    }
                    Err(err) => {
                        errors_for_set.write().insert(field_name, err);
                    }
                }
            }
        })
    };

    // Set all form values
    let values_for_set = values.clone();
    let is_dirty_for_set_values = is_dirty.clone();
    let set_values = {
        Callback::new(move |new_values: T| {
            values_for_set.set(new_values);
            is_dirty_for_set_values.set(true);
        })
    };

    // Touch a field (mark as interacted with)
    let touched_for_touch = touched.clone();
    let touch = {
        Callback::new(move |field_name: String| {
            touched_for_touch.write().insert(field_name, true);
        })
    };

    // Reset form to initial state
    let values_for_reset = values.clone();
    let initial = values.read().clone();
    let errors_for_reset = errors.clone();
    let touched_for_reset = touched.clone();
    let is_dirty_for_reset = is_dirty.clone();
    let reset = {
        Callback::new(move |_| {
            values_for_reset.set(initial.clone());
            errors_for_reset.write().clear();
            touched_for_reset.write().clear();
            is_dirty_for_reset.set(false);
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
