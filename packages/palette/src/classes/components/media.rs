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
            Self::Calendar => "hi-calendar",
            Self::CalendarHeader => "hi-calendar-header",
            Self::CalendarNav => "hi-calendar-nav",
            Self::CalendarNavButton => "hi-calendar-nav-button",
            Self::CalendarTitle => "hi-calendar-title",
            Self::CalendarMonthTitle => "hi-calendar-month-title",
            Self::CalendarWeekdays => "hi-calendar-weekdays",
            Self::CalendarWeekday => "hi-calendar-weekday",
            Self::CalendarGrid => "hi-calendar-grid",
            Self::CalendarDayCell => "hi-calendar-day-cell",
            Self::CalendarDay => "hi-calendar-day",
            Self::CalendarDaySelected => "hi-calendar-day-selected",
            Self::CalendarDayToday => "hi-calendar-day-today",
            Self::CalendarDayDisabled => "hi-calendar-day-disabled",
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
            Self::Timeline => "hi-timeline",
            Self::Alternate => "hi-timeline-alternate",
            Self::Left => "hi-timeline-left",
            Self::Right => "hi-timeline-right",
            Self::NoLine => "hi-timeline-no-line",
            Self::Item => "hi-timeline-item",
            Self::Dot => "hi-timeline-dot",
            Self::Content => "hi-timeline-content",
            Self::Time => "hi-timeline-time",
            Self::Title => "hi-timeline-title",
            Self::Last => "hi-timeline-last",
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
            Self::Container => "hi-code-highlight",
            Self::Header => "hi-code-highlight-header",
            Self::Language => "hi-code-highlight-language",
            Self::CopyButton => "hi-code-highlight-copy",
            Self::Content => "hi-code-highlight-content",
            Self::LineNumbers => "hi-code-highlight-line-numbers",
            Self::LineNumber => "hi-code-highlight-line-number",
            Self::Code => "hi-code-highlight-code",
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
            Self::Container => "hi-video-player",
            Self::Video => "hi-video-player-video",
            Self::Controls => "hi-video-controls",
            Self::ControlBtn => "hi-video-control-btn",
            Self::Time => "hi-video-time",
            Self::Progress => "hi-video-progress",
            Self::ProgressBar => "hi-video-progress-bar",
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
            Self::Container => "hi-audio-player",
            Self::Sm => "hi-audio-player-sm",
            Self::Md => "hi-audio-player-md",
            Self::Lg => "hi-audio-player-lg",
            Self::Header => "hi-audio-player-header",
            Self::Cover => "hi-audio-player-cover",
            Self::CoverImage => "hi-audio-player-cover-image",
            Self::Info => "hi-audio-player-info",
            Self::Title => "hi-audio-player-title",
            Self::Artist => "hi-audio-player-artist",
            Self::Audio => "hi-audio-player-audio",
            Self::Controls => "hi-audio-player-controls",
            Self::PlayButton => "hi-audio-player-play-button",
            Self::ProgressSection => "hi-audio-player-progress-section",
            Self::ProgressBar => "hi-audio-player-progress-bar",
            Self::ProgressFill => "hi-audio-player-progress-fill",
            Self::Time => "hi-audio-player-time",
            Self::VolumeSection => "hi-audio-player-volume-section",
            Self::VolumeButton => "hi-audio-player-volume-button",
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
            Self::Container => "hi-rich-text-editor",
            Self::Toolbar => "hi-rich-text-editor-toolbar",
            Self::ToolbarButton => "hi-rich-text-editor-toolbar-button",
            Self::Editor => "hi-rich-text-editor-editor",
            Self::Divider => "hi-editor-divider",
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
            Self::Overlay => "hi-user-guide-overlay",
            Self::Container => "hi-user-guide-container",
            Self::Arrow => "hi-user-guide-arrow",
            Self::Content => "hi-user-guide-content",
            Self::Header => "hi-user-guide-header",
            Self::Title => "hi-user-guide-title",
            Self::Counter => "hi-user-guide-counter",
            Self::Description => "hi-user-guide-description",
            Self::Footer => "hi-user-guide-footer",
            Self::SkipButton => "hi-user-guide-skip-button",
            Self::Navigation => "hi-user-guide-navigation",
            Self::NavButton => "hi-user-guide-nav-button",
            Self::PrimaryButton => "hi-user-guide-primary-button",
            Self::Progress => "hi-user-guide-progress",
            Self::ProgressDot => "hi-user-guide-progress-dot",
            Self::ProgressDotActive => "hi-user-guide-progress-dot-active",
            Self::PlacementTop => "hi-user-guide-placement-top",
            Self::PlacementBottom => "hi-user-guide-placement-bottom",
            Self::PlacementLeft => "hi-user-guide-placement-left",
            Self::PlacementRight => "hi-user-guide-placement-right",
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
            Self::Container => "hi-markdown-editor",
            Self::Sm => "hi-markdown-editor-sm",
            Self::Md => "hi-markdown-editor-md",
            Self::Lg => "hi-markdown-editor-lg",
            Self::Toolbar => "hi-markdown-editor-toolbar",
            Self::ToolbarButton => "hi-markdown-editor-toolbar-button",
            Self::ToolbarButtonActive => "hi-markdown-editor-toolbar-button-active",
            Self::ToolbarDivider => "hi-markdown-editor-toolbar-divider",
            Self::Content => "hi-markdown-editor-content",
            Self::Textarea => "hi-markdown-editor-textarea",
            Self::Preview => "hi-markdown-editor-preview",
            Self::SplitContainer => "hi-markdown-editor-split-container",
            Self::SplitPane => "hi-markdown-editor-split-pane",
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
            Self::Container => "hi-drag-layer",
            Self::DropZoneOverlay => "hi-drag-layer-drop-zone-overlay",
            Self::DropZone => "hi-drag-layer-drop-zone",
            Self::DragPreview => "hi-drag-layer-drag-preview",
            Self::DragPreviewContent => "hi-drag-layer-drag-preview-content",
            Self::DragPreviewLabel => "hi-drag-layer-drag-preview-label",
            Self::DragPreviewType => "hi-drag-layer-drag-preview-type",
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
            Self::Container => "hi-carousel",
            Self::Track => "hi-carousel-track",
            Self::Arrow => "hi-carousel-arrow",
            Self::ArrowPrev => "hi-carousel-arrow-prev",
            Self::ArrowNext => "hi-carousel-arrow-next",
            Self::Indicators => "hi-carousel-indicators",
            Self::IndicatorsDots => "hi-carousel-indicators-dots",
            Self::IndicatorsLine => "hi-carousel-indicators-line",
            Self::IndicatorsHidden => "hi-carousel-indicators-hidden",
            Self::Dot => "hi-carousel-dot",
            Self::DotActive => "hi-carousel-dot-active",
            Self::Pause => "hi-carousel-pause",
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
            Self::Container => "hi-comment",
            Self::Header => "hi-comment-header",
            Self::Avatar => "hi-comment-avatar",
            Self::Meta => "hi-comment-meta",
            Self::Author => "hi-comment-author",
            Self::Datetime => "hi-comment-datetime",
            Self::Content => "hi-comment-content",
            Self::Actions => "hi-comment-actions",
            Self::Nested => "hi-comment-nested",
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
            Self::Container => "hi-zoom-controls",
            Self::Button => "hi-zoom-controls-button",
            Self::ButtonDisabled => "hi-zoom-controls-button-disabled",
            Self::Percentage => "hi-zoom-controls-percentage",
            Self::Slider => "hi-zoom-controls-slider",
        }
    }
}
