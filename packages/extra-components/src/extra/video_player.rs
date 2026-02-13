// hi-extra-components/src/extra/video_player.rs
// VideoPlayer component with Arknights + FUI styling

use dioxus::prelude::*;
use hikari_components::{basic::IconButton, MdiIcon};
use hikari_palette::classes::ClassesBuilder;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

#[derive(Clone, PartialEq, Props, Default)]
pub struct VideoPlayerProps {
    /// Video source URL
    pub src: String,

    /// Video title
    #[props(default)]
    pub title: Option<String>,

    /// Whether to show custom controls
    #[props(default)]
    pub show_controls: bool,

    /// Whether to autoplay
    #[props(default)]
    pub autoplay: bool,

    /// Whether to loop
    #[props(default)]
    pub loop_video: bool,

    /// Additional CSS class
    #[props(default)]
    pub class: String,
}

/// VideoPlayer component with custom controls
///
/// A video player with Arknights-style controls and FUI aesthetics.
/// Supports play/pause, volume control, and fullscreen.
///
/// # Examples
///
/// ## Basic Usage
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_extra_components::VideoPlayer;
///
/// fn app() -> Element {
///     rsx! {
///         VideoPlayer {
///             src: "https://example.com/video.mp4".to_string(),
///             show_controls: true,
///         }
///     }
/// }
/// ```
#[component]
pub fn VideoPlayer(props: VideoPlayerProps) -> Element {
    let mut is_playing = use_signal(|| false);
    let mut is_muted = use_signal(|| false);
    let volume = use_signal(|| 1.0f64);
    let current_time = use_signal(|| 0.0f64);
    let _duration = use_signal(|| 0.0f64);

    let toggle_play = move |_| {
        is_playing.set(!is_playing());
    };

    let toggle_mute = move |_| {
        is_muted.set(!is_muted());
    };

    let request_fullscreen = move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(window) = web_sys::window() {
                if let Some(document) = window.document() {
                    if let Ok(video_element) = document.query_selector(".hi-video-element") {
                        if let Some(video_element) = video_element {
                            if let Ok(element) = video_element.dyn_into::<web_sys::Element>() {
                                let _ = element.request_fullscreen();
                            }
                        }
                    }
                }
            }
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            let _ = ();
        }
    };

    let video_classes = ClassesBuilder::new()
        .add_raw("hi-video-player")
        .add_raw(&props.class)
        .build();

    rsx! {
        div { class: "{video_classes}",
            div { class: "hi-video-container",

                if let Some(title) = props.title {
                    div { class: "hi-video-title",
                        "{title}"
                    }
                }

                div { class: "hi-video-wrapper",
                    video {
                        class: "hi-video-element",
                        src: "{props.src}",
                        autoplay: props.autoplay,
                        r#loop: props.loop_video,
                        controls: !props.show_controls,
                        muted: is_muted(),
                        volume: "{volume()}",
                    }
                }

                if props.show_controls {
                    div { class: "hi-video-controls",
                        IconButton {
                            icon: if is_playing() {
                                MdiIcon::Pause
                            } else {
                                MdiIcon::Play
                            },
                            onclick: toggle_play,
                        }

                        div { class: "hi-video-time",
                            "{format_time(current_time())}"
                        }

                        IconButton {
                            icon: if is_muted() {
                                MdiIcon::VolumeMute
                            } else {
                                MdiIcon::VolumeHigh
                            },
                            onclick: toggle_mute,
                        }

                        IconButton {
                            icon: MdiIcon::Fullscreen,
                            onclick: request_fullscreen,
                        }
                    }
                }
            }
        }
    }
}

fn format_time(seconds: f64) -> String {
    let mins = (seconds / 60.0) as u32;
    let secs = (seconds % 60.0) as u32;
    format!("{:02}:{:02}", mins, secs)
}

/// VideoPlayer component's type wrapper for StyledComponent
pub struct VideoPlayerComponent;

impl hikari_components::StyledComponent for VideoPlayerComponent {
    fn styles() -> &'static str {
        r#"
.hi-video-player {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.hi-video-container {
  position: relative;
  background: var(--hi-surface);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

[data-theme="dark"] .hi-video-container {
  background: var(--hi-background);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.hi-video-title {
  padding: 12px 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--hi-text-primary);
  border-bottom: 1px solid var(--hi-border);
}

.hi-video-wrapper {
  position: relative;
  width: 100%;
}

.hi-video-element {
  width: 100%;
  display: block;
}

.hi-video-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--hi-surface);
  border-top: 1px solid var(--hi-border);
}

[data-theme="dark"] .hi-video-controls {
  background: var(--hi-background);
  border-top-color: var(--hi-border);
}



.hi-video-time {
  font-size: 14px;
  color: var(--hi-text-secondary);
  min-width: 100px;
  text-align: center;
}

[data-theme="dark"] .hi-video-time {
  color: var(--hi-text-secondary);
}
"#
    }

    fn name() -> &'static str {
        "video_player"
    }
}
