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
//! - `wasm` - Enable WASM/browser integration, including tairitsu hooks and components
//!
//! When the `wasm` feature is enabled, you also get:
//! - **[`provider`]** - AnimationProvider component for the tairitsu context system
//! - **[`hooks`]** - Hooks for animation lifecycle management (built on `tairitsu-hooks`)

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
pub use core::*;

pub use breathing::*;
pub use config::AnimationConfig;
pub use easing::*;
pub use presets::*;
pub use state::*;
pub use state_machine::*;
pub use timeline::*;
pub use tween::*;

// Modules that use browser APIs (and, for some, tairitsu hooks)
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub mod builder;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub mod context;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub mod events;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub mod lifecycle;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub mod prefers_reduced_motion;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub mod scrollbar;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub mod style;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub mod timer;

// Re-export WASM-specific items
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub use builder::*;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub use context::AnimationContext;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub use events::*;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub use lifecycle::*;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub use prefers_reduced_motion::{prefers_reduced_motion, watch_prefers_reduced_motion};
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub use scrollbar::*;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub use style::*;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub use timer::*;

// tairitsu-specific modules (require the wasm feature + browser APIs)
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub mod glow;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub mod hooks;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub mod provider;

#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub mod global_manager;

// Re-export tairitsu-specific items
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub use glow::Glow;
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub use hooks::*;
// Re-export transition presets for convenience (only available with wasm feature)
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub use presets::transition::{
    SlideDirection, bounce_in, fade_in, fade_out, rotate_in, rotate_out, shake, slide_in,
    slide_out, zoom_in, zoom_out,
};
#[cfg(all(feature = "wasm", target_arch = "wasm32", target_os = "unknown"))]
pub use provider::{
    AnimationContext as AnimationProviderContext, AnimationProvider, try_use_animation_config,
    use_animation_config, use_animation_duration_scale, use_animation_enabled,
    use_animation_reduced_motion,
};
