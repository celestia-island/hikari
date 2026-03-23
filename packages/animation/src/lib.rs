//! # Hikari Animation System
//!
//! A high-performance, declarative animation system with support for dynamic values,
//! complex timelines, and smooth transitions.
//!
//! ## Architecture
//!
//! The animation system is built on several core components:
//!
//! - **[`config`]** - Global animation configuration (enabled, duration_scale, reduced_motion)
//! - **[`builder`]** - Fluent builder API for creating animations with static and dynamic values
//! - **[`context`]** - Runtime context providing element dimensions, mouse position, and other state
//! - **[`style`]** - Type-safe CSS property manipulation with [`StyleBuilder`]
//! - **[`easing`]** - Easing functions for natural motion (ease-in-out, bounce, elastic, etc.)
//! - **[`tween`]** - Interpolation system for smooth value transitions
//! - **[`timeline`]** - Timeline-based animation sequencing
//! - **[`presets`]** - Pre-built animation presets (fade, slide, scale, etc.)
//! - **[`events`]** - Animation event system
//! - **[`timer`]** - High-precision timer for frame-based animations
//! - **[`core`]** - Core animation primitives and utilities
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
//! ## Feature Flags
//!
//! - `dioxus` - Enable Dioxus framework integration (requires wasm-bindgen)
//! - `wasm` - Enable minimal WASM support without Dioxus
//!
//! When the `dioxus` feature is enabled, you also get:
//! - **[`provider`]** - AnimationProvider component for Dioxus context
//! - **[`hooks`]** - React hooks for animation lifecycle management

pub mod breathing;
pub mod config;
pub mod core;
pub mod easing;
pub mod presets;
pub mod state;
pub mod state_machine;
pub mod timeline;
pub mod tween;

// Pure Rust modules (no wasm-bindgen required)
pub use breathing::*;
pub use config::AnimationConfig;
pub use core::*;
pub use easing::*;
pub use presets::*;
pub use state::*;
pub use state_machine::*;
pub use timeline::*;
pub use tween::*;

// Modules that may use browser APIs but work without Dioxus
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub mod builder;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub mod context;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub mod events;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub mod lifecycle;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub mod prefers_reduced_motion;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub mod scrollbar;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub mod style;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub mod timer;

// Re-export WASM-specific items
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub use builder::*;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub use context::AnimationContext;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub use events::*;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub use lifecycle::*;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub use prefers_reduced_motion::{prefers_reduced_motion, watch_prefers_reduced_motion};
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub use scrollbar::*;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub use style::*;
#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub use timer::*;

// Dioxus-specific modules
#[cfg(feature = "dioxus")]
pub mod glow;
#[cfg(feature = "dioxus")]
pub mod hooks;
#[cfg(feature = "dioxus")]
pub mod provider;

#[cfg(any(feature = "wasm", feature = "dioxus"))]
pub mod global_manager;

// Re-export Dioxus-specific items
#[cfg(feature = "dioxus")]
pub use glow::Glow;
#[cfg(feature = "dioxus")]
pub use hooks::*;
#[cfg(feature = "dioxus")]
pub use provider::{
    try_use_animation_config, use_animation_config, use_animation_duration_scale,
    use_animation_enabled, use_animation_reduced_motion,
    AnimationContext as AnimationProviderContext, AnimationProvider,
};

// Re-export transition presets for convenience (only available with wasm/dioxus feature)
#[cfg(all(
    any(feature = "wasm", feature = "dioxus"),
    target_arch = "wasm32",
    target_os = "unknown"
))]
pub use presets::transition::{
    bounce_in, fade_in, fade_out, rotate_in, rotate_out, shake, slide_in, slide_out, zoom_in,
    zoom_out, SlideDirection,
};
