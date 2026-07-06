// packages/components/src/production/video_player.rs
// Video player component with Arknights + FUI styling
//
// NOTE: This component wraps the native HTML5 video element with
// Arknights-style container styling. It uses browser native controls.
// For custom video controls, consider extending this component or
// using libraries like Video.js or Plyr.

use hikari_palette::classes::{ClassesBuilder, VideoPlayerClass};

use crate::{prelude::*, styled::StyledComponent};

pub struct VideoPlayerComponent;

/// Props for the VideoPlayer component
#[define_props]
pub struct VideoPlayerProps {
    pub src: String,

    #[default(String::default())]
    pub poster: String,

    #[default(false)]
    pub autoplay: bool,

    #[default(true)]
    pub controls: bool,

    #[default(false)]
    pub loop_: bool,

    #[default(false)]
    pub muted: bool,

    #[default(String::default())]
    pub class: String,

    #[default(String::default())]
    pub style: String,
}

#[component]
pub fn VideoPlayer(props: VideoPlayerProps) -> Element {
    let container_classes = ClassesBuilder::new()
        .add(VideoPlayerClass::Container)
        .add_raw(&props.class)
        .build();

    let video_classes = ClassesBuilder::new().add(VideoPlayerClass::Video).build();

    rsx! {
        div { class: container_classes, style: props.style,

            video {
                class: video_classes,
                src: props.src,
                poster: "{props.poster}",
                autoplay: props.autoplay,
                controls: props.controls,
                r#loop: props.loop_,
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
