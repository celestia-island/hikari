// packages/components/src/utils/form/error.rs
// Validation Error Types

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

/// Result of field validation
pub type ValidationResult = Result<(), FieldError>;

/// Result of full form validation
pub type FormValidationResult<T> = Result<T, std::collections::HashMap<String, FieldError>>;
