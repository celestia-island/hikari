//! Production components module
//!
//! Layer 3 production-grade components built from Layer 1 and Layer 2 components.
//! These are complete, feature-rich components ready for production use.
//!
//! ## Components
//!
//! - [`CodeHighlight`] - Syntax highlighting with line numbers
//! - [`VideoPlayer`] - Video playback with controls
//! - [`AudioPlayer`] - Audio playback with custom controls
//! - [`RichTextEditor`] - WYSIWYG text editor

pub mod audio_player;
pub mod code_highlight;
pub mod rich_text_editor;
pub mod video_player;

pub use audio_player::*;
pub use code_highlight::*;
pub use rich_text_editor::*;
pub use video_player::*;
