// packages/components/src/utils/form/mod.rs
// Form state management and validation utilities

mod error;
mod field;
mod hooks;
mod state;
mod validators;

pub use error::{FieldError, FormValidationResult, ValidationResult};
pub use field::{Field, FieldProps};
pub use hooks::useForm;
pub use state::FormState;
pub use validators::{
    CustomValidator, Email, MaxLength, MinLength, Pattern, Required, ValidationSchema, Validators,
};

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
        assert!(result
            .unwrap_err()
            .message
            .contains("at least 3 characters"));
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
