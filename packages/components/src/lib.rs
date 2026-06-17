//! # Hikari Components Library
//!
//! Core UI component library with flat design and glow effect aesthetics,
//! providing 40+ ready-to-use rendered components built on the Tairitsu framework.
//!
//! ## Architecture
//!
//! Components are organized in a three-layer hierarchy:
//! - **Layer 1 (Foundation):** Basic (`Button`, `Input`, `Card`), Layout (`Header`, `Grid`)
//! - **Layer 2 (Composition):** Feedback (`Modal`, `Toast`), Data (`Table`, `Tree`), Display (`Tag`, `QRCode`)
//! - **Layer 3 (Production):** `AudioPlayer`, `VideoPlayer`, `CodeHighlight`, `RichTextEditor`
//!
//! ## Relationship to `hikari-extra-components`
//!
//! This crate provides **rendered components** (rsx! macro, reactive hooks, StyledComponent CSS).
//! The sibling crate `hikari-extra-components` provides **framework-agnostic data models** for the
//! same component domains (Timeline, DragLayer, UserGuide, ZoomControls, etc.) with `serde` support.
//!
//! Some types share names across both crates (e.g., `TimelinePosition`, `GuideStep`).
//! The `components` versions accept `Element` children and event handlers; the `extra` versions
//! use `String` fields. Import with explicit module paths to disambiguate:
//!
//! ```rust,ignore
//! use hikari_components::display::Timeline;              // rendered component
//! use hikari_extra_components::extra::TimelineState;     // pure data model
//! ```

// Builder pattern API
pub mod builder;

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

// Re-exports
pub use basic::*;
pub use data::*;
pub use display::*;
pub use entry::*;
pub use feedback::*;
pub use layout::*;
pub use navigation::*;
pub use styled::{StyleRegistry, StyledComponent};

// Theme system
pub mod theme;
// Portal system
pub use builder::ButtonBuilder;
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
pub use utils::glow_types::{GlowBlur, GlowColor, GlowConfig, GlowIntensity, GlowPreset};
pub use utils::portal_types::{MaskMode, ModalPosition, ModalSize, PopoverPlacement};
