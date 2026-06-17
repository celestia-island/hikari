//! Animation error types

use thiserror::Error;

/// Animation error type for state machine operations
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum AnimationError {
    #[error("Element not found: {0}")]
    ElementNotFound(String),

    #[error("Invalid transition from {from} to {to}")]
    InvalidTransition { from: String, to: String },

    #[error("Render error: {0}")]
    RenderError(String),

    #[error("Event registration failed: {0}")]
    EventRegistrationFailed(String),

    #[error("Async operation failed: {0}")]
    AsyncFailed(String),

    #[error("Invalid event type: {0}")]
    InvalidEventType(String),
}

#[cfg(test)]
mod tests {
    use std::error::Error;

    use super::*;

    #[test]
    fn element_not_found_display() {
        let err = AnimationError::ElementNotFound("div-1".into());
        assert_eq!(format!("{err}"), "Element not found: div-1");
    }

    #[test]
    fn element_not_found_str() {
        let err = AnimationError::ElementNotFound("canvas".to_string());
        assert_eq!(err.to_string(), "Element not found: canvas");
    }

    #[test]
    fn invalid_transition_display() {
        let err = AnimationError::InvalidTransition {
            from: "A".into(),
            to: "B".into(),
        };
        assert_eq!(format!("{err}"), "Invalid transition from A to B");
    }

    #[test]
    fn render_error_display() {
        let err = AnimationError::RenderError("shader fail".into());
        assert_eq!(format!("{err}"), "Render error: shader fail");
    }

    #[test]
    fn event_registration_failed_display() {
        let err = AnimationError::EventRegistrationFailed("click handler".into());
        assert_eq!(
            format!("{err}"),
            "Event registration failed: click handler"
        );
    }

    #[test]
    fn async_failed_display() {
        let err = AnimationError::AsyncFailed("timeout after 5s".into());
        assert_eq!(
            format!("{err}"),
            "Async operation failed: timeout after 5s"
        );
    }

    #[test]
    fn invalid_event_type_display() {
        let err = AnimationError::InvalidEventType("unknown".into());
        assert_eq!(format!("{err}"), "Invalid event type: unknown");
    }

    #[test]
    fn partial_eq_same_variant_same_payload() {
        let a = AnimationError::ElementNotFound("div".into());
        let b = AnimationError::ElementNotFound("div".into());
        assert_eq!(a, b);
    }

    #[test]
    fn partial_eq_different_variants() {
        let a = AnimationError::ElementNotFound("x".into());
        let b = AnimationError::RenderError("x".into());
        assert_ne!(a, b);
    }

    #[test]
    fn partial_eq_same_variant_different_payload() {
        let a = AnimationError::ElementNotFound("a".into());
        let b = AnimationError::ElementNotFound("b".into());
        assert_ne!(a, b);
    }

    #[test]
    fn partial_eq_invalid_transition_different_from() {
        let a = AnimationError::InvalidTransition {
            from: "X".into(),
            to: "Y".into(),
        };
        let b = AnimationError::InvalidTransition {
            from: "Z".into(),
            to: "Y".into(),
        };
        assert_ne!(a, b);
    }

    #[test]
    fn partial_eq_invalid_transition_different_to() {
        let a = AnimationError::InvalidTransition {
            from: "X".into(),
            to: "Y".into(),
        };
        let b = AnimationError::InvalidTransition {
            from: "X".into(),
            to: "Z".into(),
        };
        assert_ne!(a, b);
    }

    #[test]
    fn debug_format_contains_variant() {
        let err = AnimationError::RenderError("test".into());
        let debug_str = format!("{err:?}");
        assert!(debug_str.contains("RenderError"));
        assert!(debug_str.contains("test"));
    }

    #[test]
    fn clone_preserves_value() {
        let err = AnimationError::ElementNotFound("el".into());
        let cloned = err.clone();
        assert_eq!(err, cloned);
    }

    #[test]
    fn std_error_trait_source_is_none() {
        let err = AnimationError::RenderError("test".into());
        assert!(err.source().is_none());
    }

    #[test]
    fn std_error_trait_display_works() {
        let err = AnimationError::ElementNotFound("box".into());
        assert!(!err.to_string().is_empty());
    }

    #[test]
    fn anyhow_result_ok() {
        use anyhow::Result;

        let r: Result<i32> = Ok(42);
        match r {
            Ok(v) => assert_eq!(v, 42),
            Err(_) => panic!("Expected Ok"),
        }
    }

    #[test]
    fn anyhow_result_err() {
        use anyhow::{Result, anyhow};

        let r: Result<i32> = Err(anyhow!("test error"));
        match r {
            Ok(_) => panic!("Expected Err"),
            Err(e) => assert_eq!(e.to_string(), "test error"),
        }
    }
}
