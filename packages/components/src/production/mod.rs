//! Production components module
//!
//! Layer 3 production-grade components built from Layer 1 and Layer 2 components.
//! These are complete, feature-rich components ready for production use.
//!
//! ## Components
//!
//! - [`CodeHighlight`] - Syntax highlighting with line numbers
//! - [`VideoPlayer`] - Video playback with controls
//! - [`RichTextEditor`] - WYSIWYG text editor

pub mod code_highlight;
pub mod video_player;
pub mod rich_text_editor;

pub use code_highlight::*;
pub use video_player::*;
pub use rich_text_editor::*;
