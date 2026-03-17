// packages/components/src/utils/form/state.rs
// Form State Management

use std::{collections::HashMap, sync::Arc};

use crate::prelude::*;

use super::{error::FieldError, validators::ValidationSchema};

#[derive(Clone, PartialEq)]
pub struct FormState<T: Clone + 'static> {
    pub values: Signal<T>,

    pub errors: Signal<HashMap<String, FieldError>>,

    pub touched: Signal<HashMap<String, bool>>,

    pub is_dirty: Signal<bool>,

    pub is_submitting: Signal<bool>,

    pub register: Callback<(String, Arc<dyn ValidationSchema<String> + Send + Sync>)>,

    pub set_value: Callback<(String, String)>,

    pub set_values: Callback<T>,

    pub touch: Callback<String>,

    pub reset: Callback<()>,
}
