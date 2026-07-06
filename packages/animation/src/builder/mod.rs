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

pub use action::{AnimationAction, apply_actions, get_html_element};
pub use animation::{AnimationBuilder, new_animation_builder, start_animation_with_global_manager};
pub use value::{AnimationCallback, DynamicValue, MousemoveHolder, StatefulCallback, VoidCallback};
