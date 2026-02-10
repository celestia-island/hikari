//! Extra utility components
//!
//! Provides specialized components that extend to base Hikari library
//! with advanced functionality for complex use cases.
//!
//! ## Components
//!
//! - [`Collapsible`] - Collapsible content sections
//! - [`DragLayer`] - Drag and drop layer management
//! - [`DraggableCard`] - Draggable Card wrapper
//! - [`CollapsibleCard`] - Collapsible Card wrapper
//! - [`ZoomControls`] - Zoom controls for interactive content
//! - [`VideoPlayer`] - Video player with custom controls
//! - [`RichTextEditor`] - Rich text editor with toolbar
//! - [`AudioWaveform`] - Audio player with waveform visualization
//! - [`NodeGraph`] - Plugin-based visual node editor
//! - [`CodeHighlighter`] - Code display with syntax highlighting
//! - [`UserGuide`] - Step-by-step user onboarding guide
//! - [`Timeline`] - Event timeline with milestones
//!
pub mod audio_waveform;
pub mod code_highlighter;
pub mod collapsible;
pub mod collapsible_card;
pub mod drag_layer;
pub mod draggable_card;
pub mod rich_text_editor;
pub mod timeline;
pub mod user_guide;
pub mod video_player;
pub mod zoom_controls;

pub use audio_waveform::*;
pub use code_highlighter::*;
pub use collapsible::*;
pub use collapsible_card::*;
pub use drag_layer::*;
pub use draggable_card::*;
pub use rich_text_editor::*;
pub use timeline::*;
pub use user_guide::*;
pub use video_player::*;
pub use zoom_controls::*;
