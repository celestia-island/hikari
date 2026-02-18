//! Core animation types and state machine implementation
//!
//! This module provides the fundamental building blocks for the animation system:
//! - State management for animations
//! - Easing functions
//! - Property tweening
//! - Animation engine with global tween management

mod easing;
mod engine;
mod options;
mod tween;
mod types;

pub use easing::EasingFunction;
pub use engine::AnimationEngine;
pub use options::{AnimationOptions, CompletionCallback, PropertyTarget, TweenCallback};
pub use tween::Tween;
pub use types::{AnimationDirection, AnimationState, PlaybackMode, TweenId};
