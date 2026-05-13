//! Media component classes (Calendar, Timeline, Audio/Video Player, etc.)

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CalendarClass {
    Calendar,
    CalendarHeader,
    CalendarNav,
    CalendarNavButton,
    CalendarTitle,
    CalendarMonthTitle,
    CalendarWeekdays,
    CalendarWeekday,
    CalendarGrid,
    CalendarDayCell,
    CalendarDay,
    CalendarDaySelected,
    CalendarDayToday,
    CalendarDayDisabled,
}

impl TypedClass for CalendarClass {
    fn class_name(&self) -> &'static str {
        match self {
            CalendarClass::Calendar => "hi-calendar",
            CalendarClass::CalendarHeader => "hi-calendar-header",
            CalendarClass::CalendarNav => "hi-calendar-nav",
            CalendarClass::CalendarNavButton => "hi-calendar-nav-button",
            CalendarClass::CalendarTitle => "hi-calendar-title",
            CalendarClass::CalendarMonthTitle => "hi-calendar-month-title",
            CalendarClass::CalendarWeekdays => "hi-calendar-weekdays",
            CalendarClass::CalendarWeekday => "hi-calendar-weekday",
            CalendarClass::CalendarGrid => "hi-calendar-grid",
            CalendarClass::CalendarDayCell => "hi-calendar-day-cell",
            CalendarClass::CalendarDay => "hi-calendar-day",
            CalendarClass::CalendarDaySelected => "hi-calendar-day-selected",
            CalendarClass::CalendarDayToday => "hi-calendar-day-today",
            CalendarClass::CalendarDayDisabled => "hi-calendar-day-disabled",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimelineClass {
    Timeline,
    Alternate,
    Left,
    Right,
    NoLine,
    Item,
    Dot,
    Content,
    Time,
    Title,
    Last,
}

impl TypedClass for TimelineClass {
    fn class_name(&self) -> &'static str {
        match self {
            TimelineClass::Timeline => "hi-timeline",
            TimelineClass::Alternate => "hi-timeline-alternate",
            TimelineClass::Left => "hi-timeline-left",
            TimelineClass::Right => "hi-timeline-right",
            TimelineClass::NoLine => "hi-timeline-no-line",
            TimelineClass::Item => "hi-timeline-item",
            TimelineClass::Dot => "hi-timeline-dot",
            TimelineClass::Content => "hi-timeline-content",
            TimelineClass::Time => "hi-timeline-time",
            TimelineClass::Title => "hi-timeline-title",
            TimelineClass::Last => "hi-timeline-last",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CodeHighlightClass {
    Container,
    Header,
    Language,
    CopyButton,
    Content,
    LineNumbers,
    LineNumber,
    Code,
}

impl TypedClass for CodeHighlightClass {
    fn class_name(&self) -> &'static str {
        match self {
            CodeHighlightClass::Container => "hi-code-highlight",
            CodeHighlightClass::Header => "hi-code-highlight-header",
            CodeHighlightClass::Language => "hi-code-highlight-language",
            CodeHighlightClass::CopyButton => "hi-code-highlight-copy",
            CodeHighlightClass::Content => "hi-code-highlight-content",
            CodeHighlightClass::LineNumbers => "hi-code-highlight-line-numbers",
            CodeHighlightClass::LineNumber => "hi-code-highlight-line-number",
            CodeHighlightClass::Code => "hi-code-highlight-code",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VideoPlayerClass {
    Container,
    Video,
    Controls,
    ControlBtn,
    Time,
    Progress,
    ProgressBar,
}

impl TypedClass for VideoPlayerClass {
    fn class_name(&self) -> &'static str {
        match self {
            VideoPlayerClass::Container => "hi-video-player",
            VideoPlayerClass::Video => "hi-video-player-video",
            VideoPlayerClass::Controls => "hi-video-controls",
            VideoPlayerClass::ControlBtn => "hi-video-control-btn",
            VideoPlayerClass::Time => "hi-video-time",
            VideoPlayerClass::Progress => "hi-video-progress",
            VideoPlayerClass::ProgressBar => "hi-video-progress-bar",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AudioPlayerClass {
    Container,
    Sm,
    Md,
    Lg,
    Header,
    Cover,
    CoverImage,
    Info,
    Title,
    Artist,
    Audio,
    Controls,
    PlayButton,
    ProgressSection,
    ProgressBar,
    ProgressFill,
    Time,
    VolumeSection,
    VolumeButton,
}

impl TypedClass for AudioPlayerClass {
    fn class_name(&self) -> &'static str {
        match self {
            AudioPlayerClass::Container => "hi-audio-player",
            AudioPlayerClass::Sm => "hi-audio-player-sm",
            AudioPlayerClass::Md => "hi-audio-player-md",
            AudioPlayerClass::Lg => "hi-audio-player-lg",
            AudioPlayerClass::Header => "hi-audio-player-header",
            AudioPlayerClass::Cover => "hi-audio-player-cover",
            AudioPlayerClass::CoverImage => "hi-audio-player-cover-image",
            AudioPlayerClass::Info => "hi-audio-player-info",
            AudioPlayerClass::Title => "hi-audio-player-title",
            AudioPlayerClass::Artist => "hi-audio-player-artist",
            AudioPlayerClass::Audio => "hi-audio-player-audio",
            AudioPlayerClass::Controls => "hi-audio-player-controls",
            AudioPlayerClass::PlayButton => "hi-audio-player-play-button",
            AudioPlayerClass::ProgressSection => "hi-audio-player-progress-section",
            AudioPlayerClass::ProgressBar => "hi-audio-player-progress-bar",
            AudioPlayerClass::ProgressFill => "hi-audio-player-progress-fill",
            AudioPlayerClass::Time => "hi-audio-player-time",
            AudioPlayerClass::VolumeSection => "hi-audio-player-volume-section",
            AudioPlayerClass::VolumeButton => "hi-audio-player-volume-button",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RichTextEditorClass {
    Container,
    Toolbar,
    ToolbarButton,
    Editor,
    Divider,
}

impl TypedClass for RichTextEditorClass {
    fn class_name(&self) -> &'static str {
        match self {
            RichTextEditorClass::Container => "hi-rich-text-editor",
            RichTextEditorClass::Toolbar => "hi-rich-text-editor-toolbar",
            RichTextEditorClass::ToolbarButton => "hi-rich-text-editor-toolbar-button",
            RichTextEditorClass::Editor => "hi-rich-text-editor-editor",
            RichTextEditorClass::Divider => "hi-editor-divider",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserGuideClass {
    Overlay,
    Container,
    Arrow,
    Content,
    Header,
    Title,
    Counter,
    Description,
    Footer,
    SkipButton,
    Navigation,
    NavButton,
    PrimaryButton,
    Progress,
    ProgressDot,
    ProgressDotActive,
    PlacementTop,
    PlacementBottom,
    PlacementLeft,
    PlacementRight,
}

impl TypedClass for UserGuideClass {
    fn class_name(&self) -> &'static str {
        match self {
            UserGuideClass::Overlay => "hi-user-guide-overlay",
            UserGuideClass::Container => "hi-user-guide-container",
            UserGuideClass::Arrow => "hi-user-guide-arrow",
            UserGuideClass::Content => "hi-user-guide-content",
            UserGuideClass::Header => "hi-user-guide-header",
            UserGuideClass::Title => "hi-user-guide-title",
            UserGuideClass::Counter => "hi-user-guide-counter",
            UserGuideClass::Description => "hi-user-guide-description",
            UserGuideClass::Footer => "hi-user-guide-footer",
            UserGuideClass::SkipButton => "hi-user-guide-skip-button",
            UserGuideClass::Navigation => "hi-user-guide-navigation",
            UserGuideClass::NavButton => "hi-user-guide-nav-button",
            UserGuideClass::PrimaryButton => "hi-user-guide-primary-button",
            UserGuideClass::Progress => "hi-user-guide-progress",
            UserGuideClass::ProgressDot => "hi-user-guide-progress-dot",
            UserGuideClass::ProgressDotActive => "hi-user-guide-progress-dot-active",
            UserGuideClass::PlacementTop => "hi-user-guide-placement-top",
            UserGuideClass::PlacementBottom => "hi-user-guide-placement-bottom",
            UserGuideClass::PlacementLeft => "hi-user-guide-placement-left",
            UserGuideClass::PlacementRight => "hi-user-guide-placement-right",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarkdownEditorClass {
    Container,
    Sm,
    Md,
    Lg,
    Toolbar,
    ToolbarButton,
    ToolbarButtonActive,
    ToolbarDivider,
    Content,
    Textarea,
    Preview,
    SplitContainer,
    SplitPane,
}

impl TypedClass for MarkdownEditorClass {
    fn class_name(&self) -> &'static str {
        match self {
            MarkdownEditorClass::Container => "hi-markdown-editor",
            MarkdownEditorClass::Sm => "hi-markdown-editor-sm",
            MarkdownEditorClass::Md => "hi-markdown-editor-md",
            MarkdownEditorClass::Lg => "hi-markdown-editor-lg",
            MarkdownEditorClass::Toolbar => "hi-markdown-editor-toolbar",
            MarkdownEditorClass::ToolbarButton => "hi-markdown-editor-toolbar-button",
            MarkdownEditorClass::ToolbarButtonActive => "hi-markdown-editor-toolbar-button-active",
            MarkdownEditorClass::ToolbarDivider => "hi-markdown-editor-toolbar-divider",
            MarkdownEditorClass::Content => "hi-markdown-editor-content",
            MarkdownEditorClass::Textarea => "hi-markdown-editor-textarea",
            MarkdownEditorClass::Preview => "hi-markdown-editor-preview",
            MarkdownEditorClass::SplitContainer => "hi-markdown-editor-split-container",
            MarkdownEditorClass::SplitPane => "hi-markdown-editor-split-pane",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DragLayerClass {
    Container,
    DropZoneOverlay,
    DropZone,
    DragPreview,
    DragPreviewContent,
    DragPreviewLabel,
    DragPreviewType,
}

impl TypedClass for DragLayerClass {
    fn class_name(&self) -> &'static str {
        match self {
            DragLayerClass::Container => "hi-drag-layer",
            DragLayerClass::DropZoneOverlay => "hi-drag-layer-drop-zone-overlay",
            DragLayerClass::DropZone => "hi-drag-layer-drop-zone",
            DragLayerClass::DragPreview => "hi-drag-layer-drag-preview",
            DragLayerClass::DragPreviewContent => "hi-drag-layer-drag-preview-content",
            DragLayerClass::DragPreviewLabel => "hi-drag-layer-drag-preview-label",
            DragLayerClass::DragPreviewType => "hi-drag-layer-drag-preview-type",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CarouselClass {
    Container,
    Track,
    Arrow,
    ArrowPrev,
    ArrowNext,
    Indicators,
    IndicatorsDots,
    IndicatorsLine,
    IndicatorsHidden,
    Dot,
    DotActive,
    Pause,
}

impl TypedClass for CarouselClass {
    fn class_name(&self) -> &'static str {
        match self {
            CarouselClass::Container => "hi-carousel",
            CarouselClass::Track => "hi-carousel-track",
            CarouselClass::Arrow => "hi-carousel-arrow",
            CarouselClass::ArrowPrev => "hi-carousel-arrow-prev",
            CarouselClass::ArrowNext => "hi-carousel-arrow-next",
            CarouselClass::Indicators => "hi-carousel-indicators",
            CarouselClass::IndicatorsDots => "hi-carousel-indicators-dots",
            CarouselClass::IndicatorsLine => "hi-carousel-indicators-line",
            CarouselClass::IndicatorsHidden => "hi-carousel-indicators-hidden",
            CarouselClass::Dot => "hi-carousel-dot",
            CarouselClass::DotActive => "hi-carousel-dot-active",
            CarouselClass::Pause => "hi-carousel-pause",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommentClass {
    Container,
    Header,
    Avatar,
    Meta,
    Author,
    Datetime,
    Content,
    Actions,
    Nested,
}

impl TypedClass for CommentClass {
    fn class_name(&self) -> &'static str {
        match self {
            CommentClass::Container => "hi-comment",
            CommentClass::Header => "hi-comment-header",
            CommentClass::Avatar => "hi-comment-avatar",
            CommentClass::Meta => "hi-comment-meta",
            CommentClass::Author => "hi-comment-author",
            CommentClass::Datetime => "hi-comment-datetime",
            CommentClass::Content => "hi-comment-content",
            CommentClass::Actions => "hi-comment-actions",
            CommentClass::Nested => "hi-comment-nested",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ZoomControlsClass {
    Container,
    Button,
    ButtonDisabled,
    Percentage,
    Slider,
}

impl TypedClass for ZoomControlsClass {
    fn class_name(&self) -> &'static str {
        match self {
            ZoomControlsClass::Container => "hi-zoom-controls",
            ZoomControlsClass::Button => "hi-zoom-controls-button",
            ZoomControlsClass::ButtonDisabled => "hi-zoom-controls-button-disabled",
            ZoomControlsClass::Percentage => "hi-zoom-controls-percentage",
            ZoomControlsClass::Slider => "hi-zoom-controls-slider",
        }
    }
}
