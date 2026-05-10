//! Animation builder module
//!
//! Provides a high-level builder API for creating animations with support for:
//! - Static and dynamic CSS values
//! - State machine integration
//! - Continuous animation loops
//! - Multi-element control

mod action;
mod animation;
mod value;

pub use action::{AnimationAction, apply_actions};
pub use animation::{AnimationBuilder, new_animation_builder};
pub use value::{AnimationCallback, DynamicValue, StatefulCallback, VoidCallback};
