use dioxus::prelude::*;

use crate::{components::{DemoSection, PageContainer}, hooks::{use_i18n, use_language}};
use _components::{Button, Card};
use _extra_components::extra::{AudioWaveform, VideoPlayer};
use _palette::classes::{ ClassesBuilder, Display, Flex, FontSize, Gap, MarginBottom, Padding, TextColor, };

#[component]
pub fn VideoDemo() -> Element {
    let i18n = use_i18n();
    let lang_ctx = use_language();
    let lang = (*lang_ctx.language.read()).url_prefix().to_string();

    let page_title = "Video & Audio Demo".to_string();
    let page_desc = "Demonstrates the full functionality of Layer 3 video player and audio waveform components.".to_string();
    let video_title = "VideoPlayer".to_string();
    let video_desc = "Full-featured video player with playback controls, volume adjustment, and fullscreen support.".to_string();
    let audio_title = "AudioWaveform".to_string();
    let audio_desc =
        "Audio player with real-time waveform visualization (WASM platform).".to_string();

    rsx! {
        PageContainer {
            current_route: crate::app::Route::VideoDemo { lang },
            title: page_title,
            description: page_desc,

            DemoSection {
                title: video_title,
                div {
                    class: ClassesBuilder::new()
                        .add(TextColor::Muted)
                        .add(MarginBottom::Mb4)
                        .build(),
                    "{video_desc}"
                }

                Card {
                    class: "demo-card",
                    VideoPlayer {
                        src: "https://www.w3schools.com/html/mov_bbb.mp4".to_string(),
                        title: Some("示例视频".to_string()),
                        show_controls: true,
                    }
                }
            }

            DemoSection {
                title: audio_title,
                div {
                    class: ClassesBuilder::new()
                        .add(TextColor::Muted)
                        .add(MarginBottom::Mb4)
                        .build(),
                    "{audio_desc}"
                }

                Card {
                    class: "demo-card",
                    AudioWaveform {
                        src: "https://www.w3schools.com/html/horse.mp3".to_string(),
                        show_controls: true,
                    }
                }
            }
        }
    }
}
