//! # Hikari Animation System
//!
//! A high-performance, declarative animation system for Dioxus applications with
//! support for dynamic values, complex timelines, and smooth transitions.
//!
//! ## Architecture
//!
//! The animation system is built on several core components:
//!
//! - **[`builder`]** - Fluent builder API for creating animations with static and dynamic values
//! - **[`context`]** - Runtime context providing element dimensions, mouse position, and other state
//! - **[`style`]** - Type-safe CSS property manipulation with [`StyleBuilder`]
//! - **[`easing`]** - Easing functions for natural motion (ease-in-out, bounce, elastic, etc.)
//! - **[`tween`]** - Interpolation system for smooth value transitions
//! - **[`timeline`]** - Timeline-based animation sequencing
//! - **[`presets`]** - Pre-built animation presets (fade, slide, scale, etc.)
//! - **[`spotlight`]** - Spotlight effect for mouse-following animations
//! - **[`hooks`]** - React hooks for animation lifecycle management
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
//! - **WASM Optimized**: Designed specifically for WebAssembly targets
//!
//! ## Quick Start
//!
//! ### Static Animation
//!
//! ```rust,no_run
//! use hikari_animation::{AnimationBuilder, AnimationContext};
//! use hikari_animation::style::CssProperty;
//! use std::collections::HashMap;
//!
//! # fn example(button_element: web_sys::HtmlElement) {
//! let mut elements = HashMap::new();
//! elements.insert("button".to_string(), button_element.into());
//!
//! AnimationBuilder::new(&elements)
//!     .add_style("button", CssProperty::Width, "200px")
//!     .add_style("button", CssProperty::Opacity, "0.8")
//!     .apply();
//! # }
//! ```
//!
//! ### Dynamic Animation (Mouse Following)
//!
//! ```rust,no_run
//! use hikari_animation::{AnimationBuilder, AnimationContext};
//! use hikari_animation::style::CssProperty;
//! use std::collections::HashMap;
//!
//! # fn example(button_element: web_sys::HtmlElement) {
//! let mut elements = HashMap::new();
//! elements.insert("button".to_string(), button_element.into());
//!
//! AnimationBuilder::new(&elements)
//!     .add_style_dynamic("button", CssProperty::Transform, |ctx| {
//!         let x = ctx.mouse_x();
//!         let y = ctx.mouse_y();
//!         format!("translate({}px, {}px)", x, y)
//!     })
//!     .apply_with_transition("300ms", "ease-in-out");
//! # }
//! ```
//!
//! ### Animation with Presets
//!
//! ```rust,no_run
//! use hikari_animation::presets::*;
//!
//! // Create transition animations
//! let transitions = transition();
//!
//! // Fade and slide in animation
//! // In a real application, you would apply this animation to an element
//! let _fade_id = transitions.fade_slide_in(500, 20.0);
//! ```
//!
//! ## Builder Pattern
//!
//! The animation system uses a fluent builder pattern for constructing complex animations:
//!
//! ```rust,no_run
//! use hikari_animation::{AnimationBuilder, AnimationContext};
//! use hikari_animation::style::CssProperty;
//! use std::collections::HashMap;
//!
//! # fn example(button_element: web_sys::HtmlElement) {
//! let mut elements = HashMap::new();
//! elements.insert("button".to_string(), button_element.into());
//!
//! AnimationBuilder::new(&elements)
//!     .add_style("button", CssProperty::Width, "100px")
//!     .add_style("button", CssProperty::Height, "100px")
//!     .add_class("button", "hi-flex")
//!     .apply_with_transition("300ms", "ease-out");
//! # }
//! ```
//!
//! ## Dynamic Values
//!
//! Dynamic values are computed at runtime from the [`AnimationContext`], which provides:
//!
//! - Element dimensions (width, height, position)
//! - Mouse position relative to element and viewport
//! - Scroll position
//! - Distance and angle from center
//! - Custom state
//!
//! ```rust,no_run
//! use hikari_animation::{AnimationBuilder, AnimationContext};
//! use hikari_animation::style::CssProperty;
//! use std::collections::HashMap;
//!
//! # fn example(icon_element: web_sys::HtmlElement) {
//! let mut elements = HashMap::new();
//! elements.insert("icon".to_string(), icon_element.into());
//!
//! AnimationBuilder::new(&elements)
//!     .add_style_dynamic("icon", CssProperty::Transform, |ctx| {
//!         let scale = 1.0 + (ctx.distance_from_center() / 500.0).min(0.3);
//!         let angle = ctx.angle_from_center();
//!         format!("scale({}) rotate({}rad)", scale, angle)
//!     })
//!     .apply_with_transition("150ms", "ease-out");
//! # }
//! ```
//!
//! ## Debounced Animations
//!
//! For performance-critical scenarios, use debounced animations to throttle updates:
//!
//! Note: This feature is currently under development and will be available in a future release.
//!
//! ## Easing Functions
//!
//! Choose from 30+ easing functions for natural motion:
//!
//! ```rust,no_run
//! use hikari_animation::easing::ease_in_out_cubic;
//!
//! // Create an easing function
//! let easing = ease_in_out_cubic();
//! ```
//!
//! Available easing functions include:
//! - Linear: `linear`
//! - Quadratic: `ease_in_quad`, `ease_out_quad`, `ease_in_out_quad`
//! - Cubic: `ease_in_cubic`, `ease_out_cubic`, `ease_in_out_cubic`
//! - Quartic: `ease_in_quart`, `ease_out_quart`, `ease_in_out_quart`
//! - Quintic: `ease_in_quint`, `ease_out_quint`, `ease_in_out_quint`
//! - Elastic: `ease_out_elastic`, `ease_in_out_elastic`
//! - Bounce: `ease_out_bounce`, `ease_in_out_bounce`
//!
//! ## Style Builder
//!
//! For lower-level style manipulation, use the [`StyleBuilder`] directly:
//!
//! ```rust,no_run
//! use hikari_animation::style::{StyleBuilder, CssProperty};
//!
//! # fn example(element: web_sys::HtmlElement) {
//! StyleBuilder::new(&element)
//!     .add(CssProperty::Width, "100px")
//!     .add(CssProperty::Height, "100px")
//!     .add(CssProperty::BackgroundColor, "red")
//!     .apply();
//! # }
//! ```
//!
//! ## Spotlight Effect
//!
//! Create mouse-following spotlight effects using the glow module:
//!
//! Note: Spotlight effects are available via the Glow component for Dioxus applications.
//! See the glow module documentation for details.
//!
//! ## Performance Considerations
//!
//! - Use **debounced animations** for frequently updating values (e.g., scroll position)
//! - Prefer **CSS transitions** over JavaScript animations for simple state changes
//! - Use **`requestAnimationFrame`** (via the timer module) for frame-based animations
//! - Minimize **reflows** by batching DOM reads and writes
//!
//! ## Platform Support
//!
//! This animation system is designed for **WASM targets only** (`#[cfg(target_arch = "wasm32")]`).
//! It will not compile for non-WASM targets.

pub mod breathing;
pub mod builder;
pub mod context;
pub mod core;
pub mod easing;
pub mod events;
#[cfg(target_arch = "wasm32")]
pub mod global_manager;
pub mod glow;
pub mod hooks;
pub mod lifecycle;
pub mod presets;
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
pub use core::{AnimationEngine, AnimationOptions, PlaybackMode, Tween, TweenId};

// Re-export Glow component for use in Dioxus components
pub use glow::Glow;

pub use builder::*;
pub use context::*;
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
