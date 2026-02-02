// packages/components/src/utils/form.rs
// Form state management and validation utilities

use std::{collections::HashMap, sync::Arc};

use dioxus::prelude::*;

// ============================================================================
// Validation Error Types
// ============================================================================

/// Represents a validation error for a field
#[derive(Clone, PartialEq, Debug)]
pub struct FieldError {
    /// The error message
    pub message: String,
    /// Optional error code for programmatic handling
    pub code: Option<String>,
}

impl FieldError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            code: None,
        }
    }

    pub fn with_code(mut self, code: impl Into<String>) -> Self {
        self.code = Some(code.into());
        self
    }
}

impl From<&str> for FieldError {
    fn from(s: &str) -> Self {
        Self::new(s)
    }
}

impl From<String> for FieldError {
    fn from(s: String) -> Self {
        Self::new(s)
    }
}

// ============================================================================
// Validation Result
// ============================================================================

/// Result of field validation
pub type ValidationResult = Result<(), FieldError>;

/// Result of full form validation
pub type FormValidationResult<T> = Result<T, HashMap<String, FieldError>>;

// ============================================================================
// Validation Schema Trait
// ============================================================================

/// Trait for defining validation rules for a form field
pub trait ValidationSchema<T>: Send + Sync {
    /// Validate a single field value
    fn validate(&self, value: &T) -> ValidationResult;
}

// ============================================================================
// Built-in Validators
// ============================================================================

/// Required field validator
#[derive(Clone, Debug)]
pub struct Required;

impl ValidationSchema<String> for Required {
    fn validate(&self, value: &String) -> ValidationResult {
        if value.trim().is_empty() {
            Err(FieldError::new("This field is required"))
        } else {
            Ok(())
        }
    }
}

impl ValidationSchema<Option<String>> for Required {
    fn validate(&self, value: &Option<String>) -> ValidationResult {
        match value {
            Some(v) if !v.trim().is_empty() => Ok(()),
            _ => Err(FieldError::new("This field is required")),
        }
    }
}

/// Minimum length validator
#[derive(Clone, Debug)]
pub struct MinLength(pub usize);

impl ValidationSchema<String> for MinLength {
    fn validate(&self, value: &String) -> ValidationResult {
        if value.len() < self.0 {
            Err(FieldError::new(format!(
                "Must be at least {} characters",
                self.0
            )))
        } else {
            Ok(())
        }
    }
}

/// Maximum length validator
#[derive(Clone, Debug)]
pub struct MaxLength(pub usize);

impl ValidationSchema<String> for MaxLength {
    fn validate(&self, value: &String) -> ValidationResult {
        if value.len() > self.0 {
            Err(FieldError::new(format!(
                "Must be at most {} characters",
                self.0
            )))
        } else {
            Ok(())
        }
    }
}

/// Email format validator
#[derive(Clone, Debug)]
pub struct Email;

impl ValidationSchema<String> for Email {
    fn validate(&self, value: &String) -> ValidationResult {
        if value.trim().is_empty() {
            return Ok(()); // Let Required handle empty values
        }

        // Basic email validation
        if value.contains('@') && value.contains('.') && value.len() > 5 {
            Ok(())
        } else {
            Err(FieldError::new("Please enter a valid email address"))
        }
    }
}

/// Pattern validator (regex)
#[derive(Clone, Debug)]
pub struct Pattern {
    pattern: String,
    message: String,
}

impl Pattern {
    pub fn new(pattern: impl Into<String>) -> Self {
        Self {
            pattern: pattern.into(),
            message: "Invalid format".to_string(),
        }
    }

    pub fn with_message(mut self, message: impl Into<String>) -> Self {
        self.message = message.into();
        self
    }
}

impl ValidationSchema<String> for Pattern {
    fn validate(&self, value: &String) -> ValidationResult {
        // Simple pattern matching (contains check for basic implementation)
        if value.contains(&self.pattern) {
            Ok(())
        } else {
            Err(FieldError::new(self.message.clone()))
        }
    }
}

/// Custom validator using a closure
#[derive(Clone)]
pub struct CustomValidator<T> {
    validator: Arc<dyn Fn(&T) -> ValidationResult + Send + Sync>,
}

impl<T> CustomValidator<T> {
    pub fn new<F>(validator: F) -> Self
    where
        F: Fn(&T) -> ValidationResult + Send + Sync + 'static,
    {
        Self {
            validator: Arc::new(validator),
        }
    }
}

impl<T> ValidationSchema<T> for CustomValidator<T> {
    fn validate(&self, value: &T) -> ValidationResult {
        (self.validator)(value)
    }
}

// ============================================================================
// Composite Validator (combines multiple validators)
// ============================================================================

/// Combines multiple validators into one
#[derive(Clone)]
pub struct Validators<T> {
    validators: Vec<Arc<dyn ValidationSchema<T> + Send + Sync>>,
}

impl<T: 'static> Default for Validators<T> {
    fn default() -> Self {
        Self {
            validators: Vec::new(),
        }
    }
}

impl<T: 'static> Validators<T> {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(mut self, validator: impl ValidationSchema<T> + Send + Sync + 'static) -> Self {
        self.validators.push(Arc::new(validator));
        self
    }
}

impl<T> ValidationSchema<T> for Validators<T> {
    fn validate(&self, value: &T) -> ValidationResult {
        for validator in &self.validators {
            validator.validate(value)?;
        }
        Ok(())
    }
}

// ============================================================================
// useForm Hook
// ============================================================================

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
        use_signal(|| HashMap::<String, Arc<dyn ValidationSchema<String> + Send + Sync>>::new());

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

// ============================================================================
// Field Component (integrates with useForm)
// ============================================================================

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

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_required_validator_pass() {
        let validator = Required;
        assert!(validator.validate(&"test".to_string()).is_ok());
    }

    #[test]
    fn test_required_validator_fail() {
        let validator = Required;
        assert!(validator.validate(&"".to_string()).is_err());
        assert!(validator.validate(&"   ".to_string()).is_err());
    }

    #[test]
    fn test_min_length_validator_pass() {
        let validator = MinLength(3);
        assert!(validator.validate(&"abc".to_string()).is_ok());
    }

    #[test]
    fn test_min_length_validator_fail() {
        let validator = MinLength(3);
        let result = validator.validate(&"ab".to_string());
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .message
                .contains("at least 3 characters")
        );
    }

    #[test]
    fn test_max_length_validator_pass() {
        let validator = MaxLength(5);
        assert!(validator.validate(&"abc".to_string()).is_ok());
    }

    #[test]
    fn test_max_length_validator_fail() {
        let validator = MaxLength(5);
        let result = validator.validate(&"abcdef".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("at most 5 characters"));
    }

    #[test]
    fn test_email_validator_pass() {
        let validator = Email;
        assert!(validator.validate(&"test@example.com".to_string()).is_ok());
    }

    #[test]
    fn test_email_validator_empty_pass() {
        let validator = Email;
        assert!(validator.validate(&"".to_string()).is_ok());
    }

    #[test]
    fn test_email_validator_fail() {
        let validator = Email;
        let result = validator.validate(&"invalid".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("valid email"));
    }

    #[test]
    fn test_pattern_validator_pass() {
        let validator = Pattern::new("@");
        assert!(validator.validate(&"test@example".to_string()).is_ok());
    }

    #[test]
    fn test_pattern_validator_fail() {
        let validator = Pattern::new("@");
        let result = validator.validate(&"test".to_string());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().message, "Invalid format");
    }

    #[test]
    fn test_custom_validator_pass() {
        let validator = CustomValidator::new(|value: &String| {
            if value.parse::<i32>().is_ok() && value.parse::<i32>().unwrap() > 0 {
                Ok(())
            } else {
                Err(FieldError::new("Must be a positive integer"))
            }
        });
        assert!(validator.validate(&"42".to_string()).is_ok());
    }

    #[test]
    fn test_custom_validator_fail() {
        let validator = CustomValidator::new(|value: &String| {
            if value.parse::<i32>().is_ok() && value.parse::<i32>().unwrap() > 0 {
                Ok(())
            } else {
                Err(FieldError::new("Must be a positive integer"))
            }
        });
        let result = validator.validate(&"-1".to_string());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().message, "Must be a positive integer");
    }

    #[test]
    fn test_validators_composite_pass() {
        let validators = Validators::new().add(MinLength(3)).add(MaxLength(10));
        assert!(validators.validate(&"hello".to_string()).is_ok());
    }

    #[test]
    fn test_validators_composite_fail_min() {
        let validators = Validators::new().add(MinLength(3)).add(MaxLength(10));
        let result = validators.validate(&"hi".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_validators_composite_fail_max() {
        let validators = Validators::new().add(MinLength(3)).add(MaxLength(10));
        let result = validators.validate(&"hello world".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_field_error_creation() {
        let error = FieldError::new("Test error");
        assert_eq!(error.message, "Test error");
        assert!(error.code.is_none());
    }

    #[test]
    fn test_field_error_with_code() {
        let error = FieldError::new("Test error").with_code("ERR_001");
        assert_eq!(error.message, "Test error");
        assert_eq!(error.code, Some("ERR_001".to_string()));
    }

    #[test]
    fn test_field_error_from_string() {
        let error: FieldError = "Test error".into();
        assert_eq!(error.message, "Test error");
    }

    #[test]
    fn test_pattern_validator_custom_message() {
        let validator = Pattern::new("@").with_message("Must contain @ symbol");
        let result = validator.validate(&"test".to_string());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().message, "Must contain @ symbol");
    }
}
