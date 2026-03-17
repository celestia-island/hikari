// packages/components/src/utils/form/error.rs
// Validation Error Types

#[derive(Clone, PartialEq, Debug)]
pub struct FieldError {
    pub message: String,
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

pub type ValidationResult = Result<(), FieldError>;

pub type FormValidationResult<T> = Result<T, std::collections::HashMap<String, FieldError>>;
