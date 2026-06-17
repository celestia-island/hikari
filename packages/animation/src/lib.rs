//! # Hikari Animation System
//!
//! A high-performance, declarative animation system with support for dynamic values,
//! complex timelines, and smooth transitions.
//!
//! ## Architecture
//!
//! The animation system is built on several core components:
//!
//! - [`mod@config`] - Global animation configuration (enabled, duration_scale, reduced_motion)
//! - [`mod@builder`] - Fluent builder API for creating animations with static and dynamic values
//! - [`mod@context`] - Runtime context providing element dimensions, mouse position, and other state
//! - [`mod@style`] - Type-safe CSS property manipulation with [`StyleStringBuilder`]
//! - [`mod@easing`] - Easing functions for natural motion (ease-in-out, bounce, elastic, etc.)
//! - [`mod@tween`] - Interpolation system for smooth value transitions
//! - [`mod@timeline`] - Timeline-based animation sequencing
//! - [`mod@presets`] - Pre-built animation presets (fade, slide, scale, etc.)
//! - [`mod@events`] - Animation event system
//! - [`mod@timer`] - High-precision timer for frame-based animations
//! - [`mod@core`] - Core animation primitives and utilities
//!
//! ## Features
//!
//! - **Type-Safe CSS**: Compile-time checked CSS properties
//! - **Dynamic Values**: Compute animation values at runtime from context
//! - **Multi-Element**: Control multiple DOM elements simultaneously
//! - **Easing Functions**: 30+ easing functions for natural motion
//! - **Timeline Control**: Sequence and coordinate complex animations
//! - **Framework Agnostic**: Core works without any specific UI framework
//! - **Reduced Motion**: Automatic prefers-reduced-motion detection
//!
//! ## Platform Support
//!
//! This animation system is built for WASI unified environments, using tairitsu-vdom
//! for cross-platform browser API access. It works consistently across different
//! deployment targets.

// Pure Rust modules (no external dependencies required)
pub mod breathing;
pub mod config;
pub mod core;
pub mod debug;
pub mod easing;
pub mod error;
pub mod presets;
pub mod state;
pub mod state_machine;
pub mod timeline;
pub mod tween;

// Pure Rust exports
pub use core::*;

pub use breathing::*;
pub use config::AnimationConfig;
pub use debug::AnimationDebugProvider;
pub use easing::*;
pub use error::*;
pub use presets::*;
pub use state::*;
pub use state_machine::*;
pub use timeline::*;
pub use tween::*;

// Modules that use browser APIs via tairitsu
pub mod background_animation;
pub mod builder;
pub mod context;
pub mod events;
pub mod global_manager;
pub mod hooks;
pub mod lifecycle;
pub mod prefers_reduced_motion;
pub mod provider;
pub mod scrollbar;
pub mod style;
pub mod timer;

// Re-export browser API modules
pub use background_animation::*;
pub use builder::*;
pub use context::AnimationContext;
pub use events::*;
pub use global_manager::*;
pub use hooks::tween::{UseTween, use_animation_engine, use_tween};
pub use hooks::{
    UseTransition, use_animated_value, use_animation_frame, use_interval, use_timeout,
    use_transition, use_transition_with_config,
};
pub use lifecycle::*;
pub use prefers_reduced_motion::*;
pub use provider::{
    AnimationProviderContext, init_animation_provider, try_use_animation_config,
    use_animation_config, use_animation_duration_scale, use_animation_enabled,
    use_animation_reduced_motion,
};
pub use scrollbar::*;
pub use style::*;
pub use timer::*;
