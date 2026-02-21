// packages/components/tests/form_utility_tests.rs
// E2E tests for form utilities

use hikari_components::utils::form::*;

#[test]
fn test_form_state_compilation() {
    // Test that FormState type is defined (cannot instantiate without component context)
    // Just verify it compiles
    let _type_check: std::marker::PhantomData<FormState<String>> = std::marker::PhantomData;
    let _ = _type_check;
}

#[test]
fn test_required_validator_type() {
    // Test Required validator compiles
    let validator: Required = Required;
    let result = validator.validate(&"test".to_string());
    assert!(result.is_ok());
}

#[test]
fn test_min_length_validator_type() {
    // Test MinLength validator compiles
    let validator: MinLength = MinLength(5);
    let result = validator.validate(&"hello".to_string());
    assert!(result.is_ok());
}

#[test]
fn test_max_length_validator_type() {
    // Test MaxLength validator compiles
    let validator: MaxLength = MaxLength(10);
    let result = validator.validate(&"hello".to_string());
    assert!(result.is_ok());
}

#[test]
fn test_email_validator_type() {
    // Test Email validator compiles
    let validator: Email = Email;
    let result = validator.validate(&"test@example.com".to_string());
    assert!(result.is_ok());
}

#[test]
fn test_pattern_validator_type() {
    // Test Pattern validator compiles
    let validator: Pattern = Pattern::new("@");
    let result = validator.validate(&"test@example".to_string());
    assert!(result.is_ok());
}

#[test]
fn test_custom_validator_type() {
    // Test CustomValidator compiles with String type
    let validator: CustomValidator<String> = CustomValidator::new(|value: &String| {
        if !value.is_empty() {
            Ok(())
        } else {
            Err(FieldError::new("Value is empty"))
        }
    });
    let result = validator.validate(&"test".to_string());
    assert!(result.is_ok());
}

#[test]
fn test_validators_composite_type() {
    // Test Validators composite compiles
    let validators: Validators<String> = Validators::new().add(MinLength(3)).add(MaxLength(10));
    let result = validators.validate(&"hello".to_string());
    assert!(result.is_ok());
}

#[test]
fn test_field_error_from_str() {
    // Test FieldError::from works with &str
    let error: FieldError = "Test error".into();
    assert_eq!(error.message, "Test error");
}

#[test]
fn test_field_error_from_string() {
    // Test FieldError::from works with String
    let error: FieldError = String::from("Test error").into();
    assert_eq!(error.message, "Test error");
}

#[test]
fn test_field_error_builder() {
    // Test FieldError builder pattern
    let error = FieldError::new("Base error").with_code("ERR_001");
    assert_eq!(error.message, "Base error");
    assert_eq!(error.code, Some("ERR_001".to_string()));
}

#[test]
fn test_validation_result_type() {
    // Test ValidationResult type alias
    let result: ValidationResult = Ok(());
    assert!(result.is_ok());

    let error: ValidationResult = Err(FieldError::new("Error"));
    assert!(error.is_err());
}

#[test]
fn test_form_validation_result_type() {
    // Test FormValidationResult type alias
    let mut errors = std::collections::HashMap::new();
    errors.insert("field1".to_string(), FieldError::new("Error"));

    let result: FormValidationResult<String> = Err(errors);
    assert!(result.is_err());

    let ok_result: FormValidationResult<String> = Ok("Valid".to_string());
    assert!(ok_result.is_ok());
}

#[test]
fn test_validators_chain() {
    // Test that validators can be chained with .add()
    let validators = Validators::new()
        .add(Required)
        .add(MinLength(3))
        .add(MaxLength(10));

    let result = validators.validate(&"hello".to_string());
    assert!(result.is_ok());
}

#[test]
fn test_all_validators_compile() {
    // Test all built-in validators compile
    let _required: Required = Required;
    let _min_length: MinLength = MinLength(1);
    let _max_length: MaxLength = MaxLength(100);
    let _email: Email = Email;
    let _pattern: Pattern = Pattern::new("test");

    // Verify they all implement ValidationSchema<String>
    fn check_validator_string(_: &dyn ValidationSchema<String>) {}
    check_validator_string(&_required);
    check_validator_string(&_min_length);
    check_validator_string(&_max_length);
    check_validator_string(&_email);
    check_validator_string(&_pattern);

    // Verify Required also implements ValidationSchema<Option<String>>
    fn check_validator_option(_: &dyn ValidationSchema<Option<String>>) {}
    check_validator_option(&_required);
}
