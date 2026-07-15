//! Animation hooks for tairitsu components
//!
//! Provides hooks for managing animations in tairitsu components.
//! Includes:
//! - use_animation: Basic animation management hook
//! - use_button_state: Button state machine hook
//! - use_glow_animation: Glow effect animation hook
//!
//! Note: These hooks are designed for use within tairitsu components.
//! They provide state management and cleanup functionality.

mod animated_value;
mod animation_frame;
mod continuous;
mod tween;

// Re-export state machine types for convenience
pub use crate::state_machine::{ButtonEvent, ButtonState, ButtonStateMachine};

// Re-export animation types
pub use crate::lifecycle::AnimationManager;

// Re-export hook functions
pub use animated_value::*;
pub use animation_frame::*;
pub use continuous::*;
pub use tween::*;
