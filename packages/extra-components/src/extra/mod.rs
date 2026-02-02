//! Extra utility components
//!
//! Provides specialized components that extend the base Hikari library
//! with advanced functionality for complex use cases.
//!
//! ## Components
//!
//! - [`Collapsible`] - Collapsible content sections
//! - [`DragLayer`] - Drag and drop layer management
//! - [`ZoomControls`] - Zoom controls for interactive content
//! - [`VideoPlayer`] - Video player with custom controls
//! - [`RichTextEditor`] - Rich text editor with toolbar
//! - [`AudioWaveform`] - Audio player with waveform visualization
//! - [`NodeGraph`] - Plugin-based visual node editor
//!
pub mod audio_waveform;
pub mod collapsible;
pub mod drag_layer;
pub mod rich_text_editor;
pub mod video_player;
pub mod zoom_controls;

pub use audio_waveform::*;
pub use collapsible::*;
pub use drag_layer::*;
pub use rich_text_editor::*;
pub use video_player::*;
pub use zoom_controls::*;
