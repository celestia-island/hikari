// website/src/pages/components/layer3/mod.rs
// Layer 3 components index

// Temporarily disabled doc modules due to compilation issues
// pub mod audio_waveform_doc;
// pub mod drag_layer_doc;
pub mod editor;
pub mod media;
pub mod overview;
// pub mod rich_text_editor_doc;
// pub mod video_player_doc;
pub mod visualization;

// Re-exports
// Temporarily disabled doc components due to compilation issues
// pub use audio_waveform_doc::AudioWaveformDoc;
// pub use drag_layer_doc::DragLayerDoc;
pub use editor::Layer3Editor;
pub use media::Layer3Media;
pub use overview::Layer3Overview;
// pub use rich_text_editor_doc::RichTextEditorDoc;
// pub use video_player_doc::VideoPlayerDoc;
pub use visualization::Layer3Visualization;
