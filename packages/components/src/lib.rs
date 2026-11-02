//! # Hikari Components Library
//!
//! Core UI components for the Hikari design system — layout, forms, data
//! display, feedback, and navigation.
//!
//! Built on the Tairitsu framework; the same design system also ships as the
//! Vue 3 package `@celestia-island/hikari`.

// Core modules
// rsx children are written `{expr}` by grammar; the macro expands them into
// call arguments, so rustc's `unused_braces` misfires on the source spans.
#![allow(unused_braces)]
// Rust
// rsx component blocks spell `field: value` with the same binding name (they mirror
// Vue's prop names); clippy flags each one after macro expansion.
#![allow(clippy::redundant_field_names)]

pub mod auth;
pub mod basic;
pub mod data;
pub mod display;
pub mod entry;
pub mod feedback;
pub mod hooks;
pub mod layout;
pub mod navigation;
pub mod overlay;
pub mod platform;
pub mod portal;
pub mod production;
pub mod scene;
#[cfg(target_arch = "wasm32")]
pub mod scripts;
pub mod style_builder;
pub mod styled;
pub mod utils;

// Prelude module
pub mod prelude;

// Re-export StyledComponent and StyleRegistry
// Re-exports
pub use auth::*;
pub use basic::*;
pub use data::*;
pub use display::*;
pub use entry::*;
pub use feedback::*;
pub use layout::*;
pub use navigation::*;
pub use overlay::*;
pub use production::*;
pub use scene::*;
pub use styled::{StyleRegistry, StyledComponent};

// Theme system
pub mod theme;
// Portal system
pub use portal::{
    PortalEntry, PortalMaskMode, PortalPositionStrategy, PortalProvider, TriggerPlacement,
    generate_portal_id, use_portal,
};
pub use tairitsu_hooks::{
    AnimationConfig, AnimationDirection, AnimationState, Context, EasingFunction, UseRef,
    consume_context, provide_context, use_animation, use_context, use_effect, use_ref, use_signal,
    use_simple_animation, use_state,
};
pub use tairitsu_macros::{component, rsx};
// Re-export tairitsu prelude for convenience
pub use tairitsu_vdom::{
    ChangeEvent, Classes, ElementHandle, EventData, EventHandle, FocusEvent, InputEvent,
    KeyboardEvent, MouseEvent, Platform, Signal, Style, VElement, VNode, VText, batch,
    create_effect,
};
pub use theme::{
    ComponentOverrides, ComponentPalette, IntoThemeName, LayoutDirection, ThemeContext,
    ThemePalette, ThemeProvider, get_default_theme, get_registered_theme, prefers_dark_mode,
    register_theme, use_layout_direction, use_theme,
};
