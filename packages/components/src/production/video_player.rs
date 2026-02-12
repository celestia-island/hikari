// packages/components/src/production/video_player.rs
// Video player component with Arknights + FUI styling

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, VideoPlayerClass, UtilityClass};

use crate::styled::StyledComponent;

/// VideoPlayer component type wrapper (for StyledComponent)
pub struct VideoPlayerComponent;

/// Video player component with Arknights + FUI styling
///
/// A video player with custom controls, progress bar, and fullscreen support.
#[derive(Clone, PartialEq, Props)]
pub struct VideoPlayerProps {
    /// Video source URL
    pub src: String,

    /// Video poster image
    #[props(default)]
    pub poster: String,

    /// Autoplay video
    #[props(default)]
    pub autoplay: bool,

    /// Show controls
    #[props(default = true)]
    pub controls: bool,

    /// Loop video
    #[props(default)]
    pub loop_: bool,

    /// Muted by default
    #[props(default)]
    pub muted: bool,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Additional CSS styles
    #[props(default)]
    pub style: String,
}

#[component]
pub fn VideoPlayer(props: VideoPlayerProps) -> Element {
    let container_classes = ClassesBuilder::new()
        .add(VideoPlayerClass::Container)
        .add_raw(&props.class)
        .build();

    let video_classes = ClassesBuilder::new()
        .add(VideoPlayerClass::Video)
        .build();

    rsx! {
        div {
            class: "{container_classes}",
            style: "{props.style}",

            video {
                class: "{video_classes}",
                src: "{props.src}",
                poster: "{props.poster}",
                autoplay: props.autoplay,
                controls: props.controls,
                loop: props.loop_,
                muted: props.muted,
                
                // Your browser does not support the video tag.
            }
        }
    }
}

impl StyledComponent for VideoPlayerComponent {
    fn styles() -> &'static str {
        r#"
.hi-video-player {
    background-color: var(--hi-color-bg-container);
    border: 1px solid var(--hi-color-border);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.hi-video-player video {
    width: 100%;
    display: block;
    background-color: #000;
}

.hi-video-player video::-webkit-media-controls-panel {
    background-color: var(--hi-color-bg-elevated);
}

.hi-video-player video::-webkit-media-controls-current-time-display,
.hi-video-player video::-webkit-media-controls-time-remaining-display {
    color: var(--hi-color-text-primary);
}
"#
    }

    fn name() -> &'static str {
        "video-player"
    }
}
