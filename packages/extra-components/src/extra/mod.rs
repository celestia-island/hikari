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
//! - [`rich_text_editor`] - Rich text editor state with formatting commands
//! - [`video_player`] - Video player state with playback controls

pub mod audio_waveform;
pub mod code_highlighter;
pub mod collapsible;
pub mod collapsible_card;
pub mod drag_layer;
pub mod rich_text_editor;
pub mod timeline;
pub mod user_guide;
pub mod video_player;
pub mod zoom_controls;

pub use audio_waveform::{render_audio_waveform, *};
pub use code_highlighter::{render_code_highlighter, *};
pub use collapsible::{render_collapsible, *};
pub use collapsible_card::{render_collapsible_card, *};
pub use drag_layer::{render_drag_layer, *};
pub use rich_text_editor::{render_rich_text_editor, *};
pub use timeline::{render_timeline, *};
pub use user_guide::{render_user_guide, *};
pub use video_player::{
    PlaybackChangeEvent as VideoPlaybackChangeEvent, PlaybackStatus, TimeUpdateEvent,
    VIDEO_PLAYER_STYLES, VideoPlayerState, render_video_player,
};
pub use zoom_controls::{render_zoom_controls, *};
