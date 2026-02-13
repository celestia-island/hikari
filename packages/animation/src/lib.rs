//! # Hikari Animation System
//!
//! A high-performance, declarative animation system for Dioxus applications with
//! support for dynamic values, complex timelines, and smooth transitions.
//!
//! ## Architecture
//!
//! The animation system is built on several core components:
//!
//! - **[`config`]** - Global animation configuration (enabled, duration_scale, reduced_motion)
//! - **[`provider`]** - AnimationProvider component for Dioxus context
//! - **[`builder`]** - Fluent builder API for creating animations with static and dynamic values
//! - **[`context`]** - Runtime context providing element dimensions, mouse position, and other state
//! - **[`style`]** - Type-safe CSS property manipulation with [`StyleBuilder`]
//! - **[`easing`]** - Easing functions for natural motion (ease-in-out, bounce, elastic, etc.)
//! - **[`tween`]** - Interpolation system for smooth value transitions
//! - **[`timeline`]** - Timeline-based animation sequencing
//! - **[`presets`]** - Pre-built animation presets (fade, slide, scale, etc.)
//! - **[`hooks`]** - React hooks for animation lifecycle management
//! - **[`events`]** - Animation event system
//! - **[`timer`]** - High-precision timer for frame-based animations
//! - **[`core`]** - Core animation primitives and utilities
//!
//! ## AnimationProvider (Layer 3)
//!
//! The AnimationProvider component provides global animation configuration:
//!
//! ```rust,no_run
//! use hikari_animation::AnimationProvider;
//!
//! rsx! {
//!     AnimationProvider {
//!         duration_scale: 0.8,  // 20% faster
//!         respect_reduced_motion: true,
//!
//!         App { }
//!     }
//! }
//! ```
//!
//! ## Features
//!
//! - **Type-Safe CSS**: Compile-time checked CSS properties
//! - **Dynamic Values**: Compute animation values at runtime from context
//! - **Multi-Element**: Control multiple DOM elements simultaneously
//! - **Easing Functions**: 30+ easing functions for natural motion
//! - **Timeline Control**: Sequence and coordinate complex animations
//! - **WASM Optimized**: Designed specifically for WebAssembly targets
//! - **Reduced Motion**: Automatic prefers-reduced-motion detection

pub mod breathing;
pub mod builder;
pub mod config;
pub mod context;
pub mod core;
pub mod easing;
pub mod events;
#[cfg(target_arch = "wasm32")]
pub mod global_manager;
pub mod glow;
pub mod hooks;
pub mod lifecycle;
pub mod prefers_reduced_motion;
pub mod presets;
pub mod provider;
pub mod scrollbar;
pub mod state;
pub mod style;
pub mod timeline;
pub mod timer;
pub mod tween;

// Re-export transition presets for convenience
#[cfg(target_arch = "wasm32")]
pub use presets::transition::{
    bounce_in, fade_in, fade_out, rotate_in, rotate_out, shake, slide_in, slide_out, zoom_in,
    zoom_out, SlideDirection,
};

pub use breathing::*;
pub use config::AnimationConfig;
pub use core::{AnimationEngine, AnimationOptions, PlaybackMode, Tween, TweenId};
pub use glow::Glow;
pub use prefers_reduced_motion::{prefers_reduced_motion, watch_prefers_reduced_motion};
pub use provider::{
    try_use_animation_config, use_animation_config, use_animation_duration_scale,
    use_animation_enabled, use_animation_reduced_motion, AnimationContext, AnimationProvider,
};

pub use builder::*;
pub use easing::*;
pub use events::*;
pub use hooks::*;
pub use lifecycle::*;
pub use presets::*;
pub use scrollbar::*;
pub use state::*;
pub use style::*;
pub use timeline::*;
pub use timer::*;
pub use tween::*;
