//! Production components module
//!
//! Layer 3 production-grade components built from Layer 1 and Layer 2 components.
//! These are complete, feature-rich components ready for production use.
//!
//! ## Components
//!
//! - [`AudioPlayer`] - Audio playback with custom controls
//! - [`CodeHighlight`] - Syntax highlighting with line numbers
//! - [`VideoPlayer`] - Video playback with controls
//! - [`RichTextEditor`] - WYSIWYG text editor
//! - [`MarkdownEditor`] - Markdown editor with live preview

pub mod audio_player;
pub mod code_highlight;
pub mod markdown_editor;
pub mod rich_text_editor;
pub mod video_player;

pub use audio_player::*;
pub use code_highlight::*;
pub use markdown_editor::*;
pub use rich_text_editor::*;
pub use video_player::*;
