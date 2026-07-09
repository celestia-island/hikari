//! Extra utility components - Framework Agnostic Data Models
//!
//! ## Migration Notice
//!
//! This module now provides pure Rust data structures instead of Dioxus components.
//! All components have been converted to state models that can be used with any framework.
//!
//! ## Modules
//!
//! - [`collapsible`] - Collapsible panel state
//! - [`drag_layer`] - Drag and drop state management
//! - [`zoom_controls`] - Zoom controls state
//! - [`timeline`] - Timeline event model
//! - [`user_guide`] - User onboarding guide state

pub mod collapsible;
pub mod drag_layer;
pub mod timeline;
pub mod user_guide;
pub mod zoom_controls;

pub use collapsible::*;
pub use drag_layer::*;
pub use timeline::*;
pub use user_guide::*;
pub use zoom_controls::*;

// NOTE: The following modules have been removed as they were heavily dependent on legacy Dioxus/wasm-bindgen:
// - audio_waveform (requires Web Audio API)
// - video_player (requires HTML5 video element APIs)
// - rich_text_editor (requires contenteditable APIs)
// - code_highlighter (requires clipboard APIs)
// - collapsible_card (wrapper component)
// - draggable_card (wrapper component)
//
// These can be re-implemented as framework-specific components in your application layer.
