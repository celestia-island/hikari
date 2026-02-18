//! Dioxus hooks for animation integration
//!
//! This module provides React-style hooks for using the animation system
//! within Dioxus components, including hooks for tweening,
//! animated values, transitions, and animation frame callbacks.

mod animated_value;
mod animation_frame;
mod continuous;
mod tween;

pub use animated_value::{
    use_animated_value, use_transition, use_transition_with_config, UseTransition,
};
pub use animation_frame::use_animation_frame;
pub use continuous::{use_interval, use_timeout};
pub use tween::{use_animation_engine, use_tween, UseTween};
