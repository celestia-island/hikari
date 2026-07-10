//! # Hikari Extra Components (Data Models)
//!
//! **Migration Notice**: This package has been migrated from Dioxus to framework-agnostic data models.
//!
//! ## Overview
//!
//! `hikari-extra-components` now provides pure Rust data structures for advanced UI components.
//! These components can be rendered using any frontend framework (Tairitsu, etc.).
//!
//! ## Migration from Dioxus
//!
//! Previously, this package provided Dioxus components. Now it provides:
//! - **Data Models**: State structures for each component
//! - **Event Types**: Type-safe event handlers
//! - **Utilities**: Helper functions for common operations
//!
//! ## Components
//!
//! ### Extra Components
//! - [`Collapsible`] - Collapsible state model
//! - [`DragLayer`] - Drag and drop state management
//! - [`ZoomControls`] - Zoom state and controls
//! - [`Timeline`] - Timeline event model
//! - [`UserGuide`] - User onboarding guide state
//!
//! ### Node Graph
//! - [`NodeGraphState`] - Node graph canvas state
//! - [`Node`] - Node data model
//! - [`Connection`] - Connection between nodes
//! - [`Port`] - Node port model
//!
//! ## Usage Example
//!
//! ```rust,no_run
//! use hikari_extra_components::extra::{CollapsibleState, CollapsiblePosition};
//!
//! // Create component state
//! let mut state = CollapsibleState::new("Settings Panel".to_string());
//! state.position = CollapsiblePosition::Right;
//! state.expanded = true;
//!
//! // Use with your preferred framework
//! // (Tairitsu, etc.)
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
pub mod prelude;

pub use extra::*;
pub use node_graph::*;
