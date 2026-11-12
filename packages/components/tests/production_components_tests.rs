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

    /// Copy-feedback source contract (user direction 2026-11-11): the
    /// copy button's face is CONSTANT (never a "Copied" flip) and the
    /// REAL write result feeds the crate's own toast store. The wasm
    /// branch (cfg'd out of this host test binary, browser-only) is
    /// unreachable by render tests, so the contract is pinned on the
    /// source — the same source-contract pattern the Vue-side
    /// HkLogWindow.contract.test.ts uses where the DOM is unreachable.
    #[test]
    fn test_code_highlight_copy_contract() {
        let raw = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/src/production/code_highlight.rs"
        ));
        // Comments stripped first: a prose mention of a retired token must
        // not trip the negative guards (the same rule the repo's styles
        // contracts document — the guard is about CODE, not prose).
        let src: String = raw
            .lines()
            .filter(|line| !line.trim().starts_with("//"))
            .collect::<Vec<_>>()
            .join("\n");
        // The face is the constant localized "Copy" — no flipped label,
        // no retired copied key, no copied-state signal or reset timer.
        assert!(
            src.contains(r#"t("hikari.code.copy", "Copy")"#),
            "constant face missing"
        );
        assert!(
            !src.contains("hikari.code.copied"),
            "retired copied key resurfaced"
        );
        assert!(!src.contains("copied.set("), "copied signal resurfaced");
        assert!(!src.contains("set_timeout"), "reset timer resurfaced");
        assert!(!src.contains("on_copied"), "retired result prop resurfaced");
        // The honest-result path: the inline JS reports the settled write
        // through onResult, and the handler pushes the crate toast store
        // (success AND failure branches, localized).
        assert!(
            src.contains("onResult(Boolean(success))"),
            "inline JS result callback missing"
        );
        assert!(
            src.contains(".catch(() => finish(false))"),
            "failure path missing"
        );
        assert!(src.contains("use_toast()"), "toast store not driven");
        assert!(src.contains("store.success(&t("), "success push missing");
        assert!(src.contains("store.error(&t("), "failure push missing");
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
