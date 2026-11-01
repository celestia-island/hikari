//! Display-family API tests.
//!
//! The W4 wave REPLACED the legacy `Empty` / `QRCode` / `Skeleton` /
//! `Timeline` surfaces with the Vue mirrors (`HkEmptyState` / `HkQrCode` /
//! `HkSkeleton` / `HkTimeline`), and the legacy `SkeletonCard` / `SkeletonTable`
//! / `TimelineItem` / `TimelinePosition` types are gone — those files' headers
//! carry the MIGRATION notes. What remains here covers the still-legacy display
//! surfaces (`Carousel`, `Comment`, `UserGuide`, `ZoomControls`, `Calendar`,
//! `DragLayer`) plus the NEW mirrored props.

#[cfg(test)]
mod tests {
    use hikari_components::display::{
        CalendarProps, CarouselProps, CommentProps, CountdownDigitProps, CrossfadeProps,
        DragLayerProps, EmptyStateProps, HoverRevealActionProps, ImageLightboxProps,
        ImagePreviewProps, ImageViewerProps, InfiniteTailProps, JsonTreeProps, ListTransitionProps,
        LoadMoreProps, LogWindowProps, MarkdownRendererProps, MediaControlBarProps,
        MediaPlayerProps, MediaSliderProps, MediaVisualizerProps, QrCodeProps, SkeletonProps,
        TagProps, TerminalProps, TimelineProps, TransitionContainerProps, UserGuideProps,
        ZoomControlsProps,
    };

    // ── Legacy display surfaces (unchanged) ──────────────────────────

    #[test]
    fn carousel_props_default() {
        let props = CarouselProps::default();
        assert_eq!(props.autoplay, 5000);
    }

    #[test]
    fn comment_props_default() {
        let props = CommentProps::default();
        assert_eq!(props.class, "");
    }

    #[test]
    fn user_guide_props_default() {
        let _ = UserGuideProps::default();
    }

    #[test]
    fn zoom_controls_props_default() {
        let _ = ZoomControlsProps::default();
    }

    #[test]
    fn calendar_props_default() {
        let _ = CalendarProps::default();
    }

    #[test]
    fn drag_layer_props_default() {
        let _ = DragLayerProps::default();
    }

    #[test]
    fn tag_props_default() {
        let props = TagProps::default();
        assert_eq!(props.class, "");
    }

    // ── New Vue mirrors: the props surface stays Default-constructible ──
    //
    // Per-component behaviour lives in each module's own `#[cfg(test)]` suite;
    // here we only pin the public API (the props exist and are constructible).

    #[test]
    fn mirrored_display_props_are_default_constructible() {
        let _ = EmptyStateProps::default();
        let _ = QrCodeProps::default();
        let _ = SkeletonProps::default();
        let _ = CountdownDigitProps::default();
        let _ = HoverRevealActionProps::default();
        let _ = LoadMoreProps::default();
        let _ = CrossfadeProps::default();
        let _ = ListTransitionProps::default();
        let _ = TransitionContainerProps::default();
        let _ = InfiniteTailProps::default();
        let _ = MediaPlayerProps::default();
        let _ = MediaSliderProps::default();
        let _ = MediaControlBarProps::default();
        let _ = MediaVisualizerProps::default();
        let _ = ImageLightboxProps::default();
        let _ = ImagePreviewProps::default();
        let _ = ImageViewerProps::default();
        let _ = TerminalProps::default();
        let _ = LogWindowProps::default();
        let _ = JsonTreeProps::default();
        let _ = MarkdownRendererProps::default();
        let _ = hikari_components::display::DiffViewerProps::default();
    }

    #[test]
    fn timeline_props_default() {
        let props = TimelineProps::default();
        assert!(props.steps.is_empty());
        assert_eq!(props.current_key, "");
        assert!(!props.clickable);
    }

    #[test]
    fn image_viewer_starts_in_the_fit_state() {
        let props = ImageViewerProps::default();
        assert!(props.scale.is_none());
    }

    #[test]
    fn media_player_starts_paused() {
        let props = MediaPlayerProps::default();
        assert!(!props.playing);
    }
}
