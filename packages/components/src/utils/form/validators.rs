// packages/components/src/utils/form/validators.rs
// Validation Schema Trait and Built-in Validators

use std::sync::Arc;

use super::error::{FieldError, ValidationResult};

/// Trait for defining validation rules for a form field
pub trait ValidationSchema<T>: Send + Sync {
    /// Validate a single field value
    fn validate(&self, value: &T) -> ValidationResult;
}

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

    #[allow(clippy::should_implement_trait)]
    pub fn add(mut self, validator: impl ValidationSchema<T> + 'static) -> Self {
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
