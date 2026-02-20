//! Media component classes (Calendar, Timeline, Audio/Video Player, etc.)

use serde::{Deserialize, Serialize};

use crate::classes::UtilityClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for CalendarClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CalendarClass::Calendar => "calendar",
            CalendarClass::CalendarHeader => "calendar-header",
            CalendarClass::CalendarNav => "calendar-nav",
            CalendarClass::CalendarNavButton => "calendar-nav-button",
            CalendarClass::CalendarTitle => "calendar-title",
            CalendarClass::CalendarMonthTitle => "calendar-month-title",
            CalendarClass::CalendarWeekdays => "calendar-weekdays",
            CalendarClass::CalendarWeekday => "calendar-weekday",
            CalendarClass::CalendarGrid => "calendar-grid",
            CalendarClass::CalendarDayCell => "calendar-day-cell",
            CalendarClass::CalendarDay => "calendar-day",
            CalendarClass::CalendarDaySelected => "calendar-day-selected",
            CalendarClass::CalendarDayToday => "calendar-day-today",
            CalendarClass::CalendarDayDisabled => "calendar-day-disabled",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for TimelineClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            TimelineClass::Timeline => "timeline",
            TimelineClass::Alternate => "timeline-alternate",
            TimelineClass::Left => "timeline-left",
            TimelineClass::Right => "timeline-right",
            TimelineClass::NoLine => "timeline-no-line",
            TimelineClass::Item => "timeline-item",
            TimelineClass::Dot => "timeline-dot",
            TimelineClass::Content => "timeline-content",
            TimelineClass::Time => "timeline-time",
            TimelineClass::Title => "timeline-title",
            TimelineClass::Last => "timeline-last",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for CodeHighlightClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CodeHighlightClass::Container => "code-highlight",
            CodeHighlightClass::Header => "code-highlight-header",
            CodeHighlightClass::Language => "code-highlight-language",
            CodeHighlightClass::CopyButton => "code-highlight-copy",
            CodeHighlightClass::Content => "code-highlight-content",
            CodeHighlightClass::LineNumbers => "code-highlight-line-numbers",
            CodeHighlightClass::LineNumber => "code-highlight-line-number",
            CodeHighlightClass::Code => "code-highlight-code",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VideoPlayerClass {
    Container,
    Video,
}

impl UtilityClass for VideoPlayerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            VideoPlayerClass::Container => "video-player",
            VideoPlayerClass::Video => "video-player-video",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for AudioPlayerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            AudioPlayerClass::Container => "audio-player",
            AudioPlayerClass::Sm => "audio-player-sm",
            AudioPlayerClass::Md => "audio-player-md",
            AudioPlayerClass::Lg => "audio-player-lg",
            AudioPlayerClass::Header => "audio-player-header",
            AudioPlayerClass::Cover => "audio-player-cover",
            AudioPlayerClass::CoverImage => "audio-player-cover-image",
            AudioPlayerClass::Info => "audio-player-info",
            AudioPlayerClass::Title => "audio-player-title",
            AudioPlayerClass::Artist => "audio-player-artist",
            AudioPlayerClass::Audio => "audio-player-audio",
            AudioPlayerClass::Controls => "audio-player-controls",
            AudioPlayerClass::PlayButton => "audio-player-play-button",
            AudioPlayerClass::ProgressSection => "audio-player-progress-section",
            AudioPlayerClass::ProgressBar => "audio-player-progress-bar",
            AudioPlayerClass::ProgressFill => "audio-player-progress-fill",
            AudioPlayerClass::Time => "audio-player-time",
            AudioPlayerClass::VolumeSection => "audio-player-volume-section",
            AudioPlayerClass::VolumeButton => "audio-player-volume-button",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RichTextEditorClass {
    Container,
    Toolbar,
    ToolbarButton,
    Editor,
}

impl UtilityClass for RichTextEditorClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            RichTextEditorClass::Container => "rich-text-editor",
            RichTextEditorClass::Toolbar => "rich-text-editor-toolbar",
            RichTextEditorClass::ToolbarButton => "rich-text-editor-toolbar-button",
            RichTextEditorClass::Editor => "rich-text-editor-editor",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for UserGuideClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            UserGuideClass::Overlay => "user-guide-overlay",
            UserGuideClass::Container => "user-guide-container",
            UserGuideClass::Arrow => "user-guide-arrow",
            UserGuideClass::Content => "user-guide-content",
            UserGuideClass::Header => "user-guide-header",
            UserGuideClass::Title => "user-guide-title",
            UserGuideClass::Counter => "user-guide-counter",
            UserGuideClass::Description => "user-guide-description",
            UserGuideClass::Footer => "user-guide-footer",
            UserGuideClass::SkipButton => "user-guide-skip-button",
            UserGuideClass::Navigation => "user-guide-navigation",
            UserGuideClass::NavButton => "user-guide-nav-button",
            UserGuideClass::PrimaryButton => "user-guide-primary-button",
            UserGuideClass::Progress => "user-guide-progress",
            UserGuideClass::ProgressDot => "user-guide-progress-dot",
            UserGuideClass::ProgressDotActive => "user-guide-progress-dot-active",
            UserGuideClass::PlacementTop => "user-guide-placement-top",
            UserGuideClass::PlacementBottom => "user-guide-placement-bottom",
            UserGuideClass::PlacementLeft => "user-guide-placement-left",
            UserGuideClass::PlacementRight => "user-guide-placement-right",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for MarkdownEditorClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            MarkdownEditorClass::Container => "markdown-editor",
            MarkdownEditorClass::Sm => "markdown-editor-sm",
            MarkdownEditorClass::Md => "markdown-editor-md",
            MarkdownEditorClass::Lg => "markdown-editor-lg",
            MarkdownEditorClass::Toolbar => "markdown-editor-toolbar",
            MarkdownEditorClass::ToolbarButton => "markdown-editor-toolbar-button",
            MarkdownEditorClass::ToolbarButtonActive => "markdown-editor-toolbar-button-active",
            MarkdownEditorClass::ToolbarDivider => "markdown-editor-toolbar-divider",
            MarkdownEditorClass::Content => "markdown-editor-content",
            MarkdownEditorClass::Textarea => "markdown-editor-textarea",
            MarkdownEditorClass::Preview => "markdown-editor-preview",
            MarkdownEditorClass::SplitContainer => "markdown-editor-split-container",
            MarkdownEditorClass::SplitPane => "markdown-editor-split-pane",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DragLayerClass {
    Container,
    DropZoneOverlay,
    DropZone,
    DragPreview,
    DragPreviewContent,
    DragPreviewLabel,
    DragPreviewType,
}

impl UtilityClass for DragLayerClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            DragLayerClass::Container => "drag-layer",
            DragLayerClass::DropZoneOverlay => "drag-layer-drop-zone-overlay",
            DragLayerClass::DropZone => "drag-layer-drop-zone",
            DragLayerClass::DragPreview => "drag-layer-drag-preview",
            DragLayerClass::DragPreviewContent => "drag-layer-drag-preview-content",
            DragLayerClass::DragPreviewLabel => "drag-layer-drag-preview-label",
            DragLayerClass::DragPreviewType => "drag-layer-drag-preview-type",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for CarouselClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CarouselClass::Container => "carousel",
            CarouselClass::Track => "carousel-track",
            CarouselClass::Arrow => "carousel-arrow",
            CarouselClass::ArrowPrev => "carousel-arrow-prev",
            CarouselClass::ArrowNext => "carousel-arrow-next",
            CarouselClass::Indicators => "carousel-indicators",
            CarouselClass::IndicatorsDots => "carousel-indicators-dots",
            CarouselClass::IndicatorsLine => "carousel-indicators-line",
            CarouselClass::IndicatorsHidden => "carousel-indicators-hidden",
            CarouselClass::Dot => "carousel-dot",
            CarouselClass::DotActive => "carousel-dot-active",
            CarouselClass::Pause => "carousel-pause",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

impl UtilityClass for CommentClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            CommentClass::Container => "comment",
            CommentClass::Header => "comment-header",
            CommentClass::Avatar => "comment-avatar",
            CommentClass::Meta => "comment-meta",
            CommentClass::Author => "comment-author",
            CommentClass::Datetime => "comment-datetime",
            CommentClass::Content => "comment-content",
            CommentClass::Actions => "comment-actions",
            CommentClass::Nested => "comment-nested",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ZoomControlsClass {
    Container,
    Button,
    ButtonDisabled,
    Percentage,
    Slider,
}

impl UtilityClass for ZoomControlsClass {
    fn as_suffix(&self) -> &'static str {
        match self {
            ZoomControlsClass::Container => "zoom-controls",
            ZoomControlsClass::Button => "zoom-controls-button",
            ZoomControlsClass::ButtonDisabled => "zoom-controls-button-disabled",
            ZoomControlsClass::Percentage => "zoom-controls-percentage",
            ZoomControlsClass::Slider => "zoom-controls-slider",
        }
    }
}
