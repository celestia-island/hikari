// packages/components/src/utils/form/state.rs
// Form State Management

use std::{collections::HashMap, sync::Arc};

use dioxus::prelude::*;

use super::error::FieldError;
use super::validators::ValidationSchema;

/// Form state returned by useForm hook
#[derive(Clone, PartialEq)]
pub struct FormState<T: Clone + 'static> {
    /// Current form values
    pub values: Signal<T>,

    /// Form-level errors
    pub errors: Signal<HashMap<String, FieldError>>,

    /// Field-level touched states
    pub touched: Signal<HashMap<String, bool>>,

    /// Form dirty state (has been modified)
    pub is_dirty: Signal<bool>,

    /// Form submitting state
    pub is_submitting: Signal<bool>,

    /// Register a field with validation
    pub register: Callback<(String, Arc<dyn ValidationSchema<String> + Send + Sync>)>,

    /// Set field value
    pub set_value: Callback<(String, String)>,

    /// Set form values
    pub set_values: Callback<T>,

    /// Touch a field (mark as interacted with)
    pub touch: Callback<String>,

    /// Reset form
    pub reset: Callback<()>,
}
