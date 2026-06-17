#[cfg(test)]
mod tests {

    use hikari_components::production::{
        AudioPlayer, AudioPlayerProps, AudioPlayerSize, CodeHighlight, CodeHighlightProps,
        MarkdownEditor, MarkdownEditorMode, MarkdownEditorProps, MarkdownEditorSize,
        RichTextEditor, RichTextEditorProps, VideoPlayer, VideoPlayerProps,
    };

    // ── VideoPlayer ──────────────────────────────────────────────

    #[test]
    fn test_video_player_renders() {
        let props = VideoPlayerProps {
            src: "test.mp4".to_string(),
            ..Default::default()
        };
        let _ = VideoPlayer(props);
    }

    #[test]
    fn test_video_player_props_default() {
        let props = VideoPlayerProps::default();
        assert_eq!(props.poster, "");
        assert!(!props.autoplay);
        assert!(props.controls);
        assert!(!props.loop_);
        assert!(!props.muted);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        assert!(props.on_play.is_none());
        assert!(props.on_pause.is_none());
        assert!(props.on_time_update.is_none());
        assert!(props.on_fullscreen_change.is_none());
    }

    #[test]
    fn test_video_player_custom_props() {
        let props = VideoPlayerProps {
            src: "movie.mp4".to_string(),
            poster: "poster.jpg".to_string(),
            autoplay: true,
            controls: false,
            loop_: true,
            muted: true,
            class: "custom".to_string(),
            style: "width:100%".to_string(),
            ..Default::default()
        };
        assert_eq!(props.src, "movie.mp4");
        assert!(props.autoplay);
        assert!(props.loop_);
        assert!(props.muted);
    }

    // ── AudioPlayer ──────────────────────────────────────────────

    #[test]
    fn test_audio_player_renders() {
        let props = AudioPlayerProps {
            src: "song.mp3".to_string(),
            ..Default::default()
        };
        let _ = AudioPlayer(props);
    }

    #[test]
    fn test_audio_player_props_default() {
        let props = AudioPlayerProps::default();
        assert_eq!(props.src, "");
        assert!(props.title.is_none());
        assert!(props.artist.is_none());
        assert!(props.cover.is_none());
        assert!(!props.autoplay);
        assert!(props.controls);
        assert!(!props.loop_);
        assert!(!props.muted);
        assert_eq!(props.size, AudioPlayerSize::Medium);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn test_audio_player_size_variants() {
        assert_eq!(AudioPlayerSize::default(), AudioPlayerSize::Medium);
        let _ = AudioPlayerSize::Small;
        let _ = AudioPlayerSize::Large;
    }

    #[test]
    fn test_audio_player_with_metadata() {
        let props = AudioPlayerProps {
            src: "track.mp3".to_string(),
            title: Some("Test Song".to_string()),
            artist: Some("Test Artist".to_string()),
            cover: Some("cover.jpg".to_string()),
            size: AudioPlayerSize::Large,
            ..Default::default()
        };
        assert_eq!(props.title.as_deref().unwrap(), "Test Song");
        assert_eq!(props.artist.as_deref().unwrap(), "Test Artist");
        assert_eq!(props.size, AudioPlayerSize::Large);
    }

    // ── RichTextEditor ───────────────────────────────────────────

    #[test]
    fn test_rich_text_editor_renders() {
        let _ = RichTextEditor(RichTextEditorProps::default());
    }

    #[test]
    fn test_rich_text_editor_props_default() {
        let props = RichTextEditorProps::default();
        assert_eq!(props.content, "");
        assert_eq!(props.placeholder, "");
        assert!(props.toolbar);
        assert!(props.height.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        assert!(props.on_content_change.is_none());
    }

    #[test]
    fn test_rich_text_editor_with_content() {
        let props = RichTextEditorProps {
            content: "<p>Hello</p>".to_string(),
            placeholder: "Enter text...".to_string(),
            toolbar: false,
            height: Some("300px".to_string()),
            ..Default::default()
        };
        assert_eq!(props.content, "<p>Hello</p>");
        assert!(!props.toolbar);
        assert_eq!(props.height.as_deref().unwrap(), "300px");
    }

    // ── CodeHighlight ────────────────────────────────────────────

    #[test]
    fn test_code_highlight_renders() {
        let props = CodeHighlightProps {
            code: "fn main() {}".to_string(),
            language: "rust".to_string(),
            ..Default::default()
        };
        let _ = CodeHighlight(props);
    }

    #[test]
    fn test_code_highlight_props_default() {
        let props = CodeHighlightProps::default();
        assert_eq!(props.language, "");
        assert_eq!(props.code, "");
        assert!(props.line_numbers);
        assert!(props.copyable);
        assert!(props.max_height.is_none());
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
    }

    #[test]
    fn test_code_highlight_with_options() {
        let props = CodeHighlightProps {
            code: "console.log('hello');".to_string(),
            language: "javascript".to_string(),
            line_numbers: false,
            copyable: false,
            max_height: Some("400px".to_string()),
            ..Default::default()
        };
        assert_eq!(props.language, "javascript");
        assert!(!props.line_numbers);
        assert!(!props.copyable);
        assert_eq!(props.max_height.as_deref().unwrap(), "400px");
    }

    // ── MarkdownEditor ───────────────────────────────────────────

    #[test]
    fn test_markdown_editor_renders() {
        let _ = MarkdownEditor(MarkdownEditorProps::default());
    }

    #[test]
    fn test_markdown_editor_props_default() {
        let props = MarkdownEditorProps::default();
        assert_eq!(props.value, "");
        assert_eq!(props.placeholder, "");
        assert_eq!(props.mode, MarkdownEditorMode::Edit);
        assert_eq!(props.size, MarkdownEditorSize::Medium);
        assert!(props.toolbar);
        assert!(!props.line_numbers);
        assert!(props.height.is_none());
        assert_eq!(props.class, "");
        assert!(props.on_change.is_none());
    }

    #[test]
    fn test_markdown_editor_mode_variants() {
        assert_eq!(MarkdownEditorMode::default(), MarkdownEditorMode::Edit);
        assert_eq!(MarkdownEditorSize::default(), MarkdownEditorSize::Medium);

        let _ = MarkdownEditorMode::Preview;
        let _ = MarkdownEditorMode::Split;
        let _ = MarkdownEditorSize::Small;
        let _ = MarkdownEditorSize::Large;
    }

    #[test]
    fn test_markdown_editor_split_mode() {
        let props = MarkdownEditorProps {
            value: "# Hello".to_string(),
            mode: MarkdownEditorMode::Split,
            size: MarkdownEditorSize::Large,
            line_numbers: true,
            height: Some("500px".to_string()),
            ..Default::default()
        };
        assert_eq!(props.mode, MarkdownEditorMode::Split);
        assert!(props.line_numbers);
        assert_eq!(props.size, MarkdownEditorSize::Large);
    }
}
