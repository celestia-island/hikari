//! Extra utility components - Framework Agnostic Data Models
//!
//! ## Migration Notice
//!
//! This module now provides pure Rust data structures instead of Dioxus components.
//! All components have been converted to state models that can be used with any framework.
//!
//! ## Modules
//!
//! - [`audio_waveform`] - Audio waveform visualization state
//! - [`code_highlighter`] - Code highlighter state
//! - [`collapsible`] - Collapsible panel state
//! - [`drag_layer`] - Drag and drop state management
//! - [`zoom_controls`] - Zoom controls state
//! - [`timeline`] - Timeline event model
//! - [`user_guide`] - User onboarding guide state

pub mod audio_waveform;
pub mod code_highlighter;
pub mod collapsible;
pub mod collapsible_card;
pub mod drag_layer;
pub mod draggable_card;
pub mod timeline;
pub mod user_guide;
pub mod zoom_controls;

pub use audio_waveform::*;
pub use code_highlighter::*;
pub use collapsible::*;
pub use collapsible_card::*;
pub use drag_layer::*;
pub use draggable_card::*;
pub use timeline::*;
pub use user_guide::*;
pub use zoom_controls::*;

// NOTE: The following components require tairitsu platform APIs that are not yet implemented:
// - rich_text_editor (requires contenteditable, execCommand - tracked in tairitsu/PLAN.md)
// - video_player (requires video element control APIs - tracked in tairitsu/PLAN.md)
// See /mnt/sdb1/tairitsu/PLAN.md for the full platform API requirements list.
