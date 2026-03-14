//! Animation hooks for Dioxus components
//!
//! Provides React-like hooks for managing animations in Dioxus components.
//! Includes:
//! - use_animation: Basic animation management hook
//! - use_button_state: Button state machine hook
//! - use_glow_animation: Glow effect animation hook
//!
//! Note: These hooks are designed for use within Dioxus components.
//! They provide state management and cleanup functionality.

// Re-export state machine types for convenience
pub use crate::state_machine::{ButtonEvent, ButtonState, ButtonStateMachine};

// Re-export animation types
pub use crate::lifecycle::AnimationManager;
