//! Animation error types
//!
//! Comprehensive error handling for animation system operations.
//! All functions return `anyhow::Result<T>` for consistent error handling.

use anyhow::{Context, Result as AnyhowResult};

/// Animation error type for state machine operations
#[derive(Debug, Clone, PartialEq)]
pub enum AnimationError {
    /// Element not found
    ElementNotFound(String),

    /// Invalid state transition
    InvalidTransition { from: String, to: String },

    /// Render error
    RenderError(String),

    /// Event registration failed
    EventRegistrationFailed(String),

    /// Async operation failed
    AsyncFailed(String),

    /// Invalid event type
    InvalidEventType(String),
}

impl std::fmt::Display for AnimationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AnimationError::ElementNotFound(id) => {
                write!(f, "Element not found: {}", id)
            }
            AnimationError::InvalidTransition { from, to } => {
                write!(f, "Invalid transition from {} to {}", from, to)
            }
            AnimationError::RenderError(msg) => {
                write!(f, "Render error: {}", msg)
            }
            AnimationError::EventRegistrationFailed(msg) => {
                write!(f, "Event registration failed: {}", msg)
            }
            AnimationError::AsyncFailed(msg) => {
                write!(f, "Async operation failed: {}", msg)
            }
            AnimationError::InvalidEventType(msg) => {
                write!(f, "Invalid event type: {}", msg)
            }
        }
    }
}

impl std::error::Error for AnimationError {}

/// Convenience function to convert AnimationError to anyhow::Error
pub fn to_anyhow(err: AnimationError) -> anyhow::Error {
    err.context("Animation operation failed").into()
}

/// Type alias for animation results using anyhow
pub type AnimationResult<T> = AnyhowResult<T>;
