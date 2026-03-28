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
//! - **[`style`]** - Type-safe CSS property manipulation with [`StyleStringBuilder`]
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
//! - `wasm` - Enable WASM/browser API support (web-sys, wasm-bindgen)

// Pure Rust modules (no external dependencies required)
pub mod breathing;
pub mod config;
pub mod core;
pub mod easing;
pub mod error;
pub mod presets;
pub mod state;
pub mod state_machine;
pub mod timeline;
pub mod tween;

// Pure Rust exports
pub use breathing::*;
pub use config::AnimationConfig;
pub use core::*;
pub use easing::*;
pub use error::*;
pub use presets::*;
pub use state::*;
pub use state_machine::*;
pub use timeline::*;
pub use tween::*;

// Modules that use browser APIs (require wasm feature)
#[cfg(feature = "wasm")]
pub mod background_animation;
#[cfg(feature = "wasm")]
pub mod builder;
#[cfg(feature = "wasm")]
pub mod context;
#[cfg(feature = "wasm")]
pub mod events;
#[cfg(feature = "wasm")]
pub mod global_manager;
#[cfg(feature = "wasm")]
pub mod lifecycle;
#[cfg(feature = "wasm")]
pub mod prefers_reduced_motion;
#[cfg(feature = "wasm")]
pub mod scrollbar;
#[cfg(feature = "wasm")]
pub mod style;
#[cfg(feature = "wasm")]
pub mod timer;

// Re-export wasm-specific items
#[cfg(feature = "wasm")]
pub use background_animation::*;
#[cfg(feature = "wasm")]
pub use builder::*;
#[cfg(feature = "wasm")]
pub use context::AnimationContext;
#[cfg(feature = "wasm")]
pub use events::*;
#[cfg(feature = "wasm")]
pub use global_manager::*;
#[cfg(feature = "wasm")]
pub use lifecycle::*;
#[cfg(feature = "wasm")]
pub use prefers_reduced_motion::*;
#[cfg(feature = "wasm")]
pub use scrollbar::*;
#[cfg(feature = "wasm")]
pub use style::*;
#[cfg(feature = "wasm")]
pub use timer::*;
