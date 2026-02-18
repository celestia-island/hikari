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

pub use action::{apply_actions, get_html_element, AnimationAction};
pub use animation::{new_animation_builder, start_animation_with_global_manager, AnimationBuilder};
pub use value::{AnimationCallback, DynamicValue, MousemoveHolder, StatefulCallback, VoidCallback};
