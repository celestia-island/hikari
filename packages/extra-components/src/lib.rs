//! # Hikari Extra Components (Data Models)
//!
//! **Migration Notice**: This package has been migrated from Dioxus to framework-agnostic data models.
//!
//! ## Overview
//!
//! `hikari-extra-components` now provides pure Rust data structures for advanced UI components.
//! These components can be rendered using any frontend framework (Tairitsu, Dioxus, etc.).
//!
//! ## Relationship to `hikari-components`
//!
//! `hikari-components` provides **rendered components** (rsx! macro, reactive hooks, StyledComponent CSS).
//! This package provides complementary **state models** — pure data structs that are framework-agnostic
//! and can be used alongside or independently of the rendered components.
//!
//! **When to use which:**
//! - Use `hikari-components` when you want ready-to-render UI components in a Tairitsu app
//! - Use `hikari-extra-components` when you need pure state models (e.g., for SSR, testing, or non-Tairitsu frameworks)
//! - Use both together: state models from this crate feed into rendered components from `hikari-components`
//!
//! **Note on type naming:** Some types (e.g., `TimelinePosition`, `GuideStep`) exist in both packages
//! with different fields. The `components` versions are Dioxus-specific (with `Element` children, event handlers);
//! the `extra-components` versions are pure data (with `String` fields, serde support). Import with explicit
//! module paths to disambiguate:
//! ```rust,ignore
//! use hikari_extra_components::extra::TimelineState; // pure data model
//! use hikari_components::display::Timeline;           // rendered component
//! ```
//!
//! ## Components
//!
//! ### Extra Components
//! - [`CollapsibleState`] - Collapsible state model
//! - [`DragLayerState`] - Drag and drop state management
//! - [`ZoomControlsState`] - Zoom state and controls
//! - [`TimelineState`] - Timeline event model
//! - [`UserGuideState`] - User onboarding guide state
//! - [`AudioWaveformState`] - Audio waveform visualization state
//!
//! ### Node Graph
//! - [`NodeGraphState`] - Node graph canvas state
//! - [`NodeView`] - Node data model
//! - [`Connection`] - Connection between nodes
//! - [`Port`] - Node port model
//!
//! ## Usage Example
//!
//! ```rust,ignore
//! use hikari_extra_components::extra::{CollapsibleState, CollapsiblePosition};
//!
//! // Create component state
//! let mut state = CollapsibleState::new("Settings Panel".to_string());
//! state.position = CollapsiblePosition::Right;
//! state.expanded = true;
//!
//! // Use with your preferred framework
//! // (Tairitsu, Dioxus, Yew, etc.)
//! ```
//!
//! ## Dependencies
//!
//! `hikari-extra-components` now has minimal dependencies:
//! - `hikari-palette` - For traditional Chinese colors
//! - `hikari-theme` - For theme integration
//! - `hikari-icons` - For icon constants
//! - `serde` - For serialization support
//!
//! **No Dioxus or wasm-bindgen dependencies required.**

pub mod extra;
pub mod node_graph;

pub use extra::*;
pub use node_graph::*;
