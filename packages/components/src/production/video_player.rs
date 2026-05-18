// packages/components/src/production/video_player.rs
// Video player component
//
// Platform API: Uses tairitsu WIT bindings for video playback control
// (play, pause, seek, mute, volume) via html-media-element interface.
// Stubs are provided in platform/wit.rs for environments without WIT support.

use hikari_palette::classes::{ClassesBuilder, VideoPlayerClass};
use tairitsu_vdom::events::MouseEvent;

use crate::platform;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct VideoPlayerComponent;

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

    pub on_play: Option<EventHandler<()>>,
    pub on_pause: Option<EventHandler<()>>,
    pub on_time_update: Option<EventHandler<f64>>,
    pub on_fullscreen_change: Option<EventHandler<bool>>,
}

fn format_video_time(seconds: f64) -> String {
    let mins = (seconds / 60.0) as u32;
    let secs = (seconds % 60.0) as u32;
    format!("{:02}:{:02}", mins, secs)
}

#[component]
pub fn VideoPlayer(props: VideoPlayerProps) -> Element {
    let is_playing = use_signal(|| false);
    let is_muted = use_signal(|| props.muted);
    let current_time = use_signal(|| 0.0f64);
    let duration = use_signal(|| 0.0f64);

    let is_fullscreen = use_signal(|| false);

    let container_classes = ClassesBuilder::new()
        .add_typed(VideoPlayerClass::Container)
        .add(&props.class)
        .build();

    let video_classes = ClassesBuilder::new()
        .add_typed(VideoPlayerClass::Video)
        .build();

    let ct = current_time.get();
    let dur = duration.get();
    let formatted_time = format!("{} / {}", format_video_time(ct), format_video_time(dur));
    let progress_percent = if dur <= 0.0 {
        "0%".to_string()
    } else {
        format!("{}%", (ct / dur * 100.0).clamp(0.0, 100.0) as u32)
    };

    let is_fullscreen = use_signal(|| false);

    rsx! {
        div { class: container_classes, style: props.style,

            video {
                class: video_classes,
                src: props.src,
                poster: "{props.poster}",
                autoplay: props.autoplay,
                controls: props.controls,
                r#loop: props.loop_,
                muted: is_muted.get(),
            }

            if !props.controls {
                div { class: "hi-video-controls",
                    button {
                        class: "hi-video-control-btn",
                        onclick: move |_| {
                            if is_playing.get() {
                                is_playing.set(false);
                                platform::video_pause(0);
                                if let Some(handler) = props.on_pause.as_ref() {
                                    handler.call(());
                                }
                            } else {
                                is_playing.set(true);
                                platform::video_play(0);
                                if let Some(handler) = props.on_play.as_ref() {
                                    handler.call(());
                                }
                            }
                        },
                        "{if is_playing.get() { \"⏸\" } else { \"▶\" }}"
                    }

                    span { class: "hi-video-time", "{formatted_time}" }

                    div {
                        class: "hi-video-progress",
                        onclick: move |e: MouseEvent| {
                            let dur = duration.get();
                            if dur > 0.0 {
                                let seek_to = dur;
                                platform::video_seek(0, seek_to);
                            }
                        },
                        div { class: "hi-video-progress-bar", style: "width: {progress_percent};" }
                    }

                    button {
                        class: "hi-video-control-btn",
                        onclick: move |_| {
                            let new_muted = !is_muted.get();
                            is_muted.set(new_muted);
                            platform::video_set_muted(0, new_muted);
                        },
                        "{if is_muted.get() { \"🔇\" } else { \"🔊\" }}"
                    }

                    button {
                        class: "hi-video-control-btn",
                        onclick: move |_| {
                            let new_fs = !is_fullscreen.get();
                            is_fullscreen.set(new_fs);
                            if new_fs {
                                platform::request_fullscreen(0);
                            }
                            if let Some(handler) = props.on_fullscreen_change.as_ref() {
                                handler.call(new_fs);
                            }
                        },
                        "{if is_fullscreen.get() { \"⛶\" } else { \"⛶\" }}"
                    }
                }
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

[data-theme="dark"] .hi-video-player {
    background-color: var(--hi-color-bg-container);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
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

.hi-video-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--hi-color-bg-elevated);
    border-top: 1px solid var(--hi-color-border);
}

[data-theme="dark"] .hi-video-controls {
    background: var(--hi-color-bg-container);
    border-top-color: var(--hi-color-border);
}

.hi-video-control-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0;
    background-color: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--hi-color-text-primary);
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.hi-video-control-btn:hover {
    background-color: var(--hi-color-primary-bg);
    color: var(--hi-color-primary);
}

.hi-video-time {
    font-size: 14px;
    color: var(--hi-color-text-secondary);
    min-width: 100px;
    text-align: center;
}

[data-theme="dark"] .hi-video-time {
    color: var(--hi-color-text-secondary);
}

.hi-video-progress {
    flex: 1;
    height: 4px;
    background: var(--hi-color-border);
    border-radius: 2px;
    overflow: hidden;
    cursor: pointer;
}

.hi-video-progress-bar {
    height: 100%;
    background: var(--hi-color-primary);
    transition: width 0.1s linear;
}
"#
    }

    fn name() -> &'static str {
        "video-player"
    }
}
