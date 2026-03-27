//! # Hikari Components Library
//!
//! Comprehensive UI component library with Arknights-style design
//! and FUI (Future User Interface) aesthetics.
//!
//! Built on Tairitsu framework.

// Core modules
pub mod basic;
pub mod data;
pub mod display;
pub mod entry;
pub mod feedback;
pub mod hooks;
pub mod layout;
pub mod navigation;
pub mod platform;
pub mod portal;
pub mod production;
pub mod scripts;
pub mod style_builder;
pub mod styled;
pub mod utils;

// Prelude module
pub mod prelude;

// Re-export StyledComponent and StyleRegistry
pub use styled::{StyleRegistry, StyledComponent};

// Re-exports
pub use basic::*;
pub use data::*;
pub use display::*;
pub use entry::*;
pub use feedback::*;
pub use layout::*;
pub use navigation::*;
pub use production::*;

// Theme system
pub mod theme;
pub use theme::{
    ComponentOverrides, ComponentPalette, IntoThemeName, LayoutDirection, ThemeContext,
    ThemePalette, ThemeProvider, get_default_theme, get_registered_theme, prefers_dark_mode,
    register_theme, use_layout_direction, use_theme,
};

// Portal system
pub use portal::{
    PortalEntry, PortalMaskMode, PortalPositionStrategy, PortalProvider, TriggerPlacement,
    generate_portal_id, use_portal,
};

// Re-export tairitsu prelude for convenience
pub use tairitsu_vdom::{
    ChangeEvent, Classes, ElementHandle, EventData, EventHandle, FocusEvent, InputEvent,
    KeyboardEvent, MouseEvent, Platform, Signal, Style, VElement, VNode, VText, batch,
    create_effect,
};

pub use tairitsu_hooks::{
    AnimationConfig, AnimationDirection, AnimationState, Context, EasingFunction, UseRef,
    consume_context, provide_context, use_animation, use_context, use_effect, use_ref, use_signal,
    use_simple_animation, use_state,
};

pub use tairitsu_macros::{component, rsx};
