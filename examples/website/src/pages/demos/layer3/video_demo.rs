use dioxus::prelude::*;

use crate::components::{DemoSection, PageContainer};
use crate::hooks::{use_i18n, use_language};
use _components::{Button, Card};
use _extra_components::extra::{AudioWaveform, VideoPlayer};
use _palette::classes::{
    ClassesBuilder, Display, Flex, FontSize, Gap, MarginBottom, Padding, TextColor,
};

#[component]
pub fn VideoDemo() -> Element {
    let i18n = use_i18n();
    let lang_ctx = use_language();
    let lang = (*lang_ctx.language.read()).url_prefix().to_string();

    let (page_title, page_desc, video_title, video_desc, audio_title, audio_desc) = match i18n {
        Some(_) => (
            "Video & Audio Demo".to_string(),
            "Demonstrates the full functionality of Layer 3 video player and audio waveform components.".to_string(),
            "VideoPlayer".to_string(),
            "Full-featured video player with playback controls, volume adjustment, and fullscreen support.".to_string(),
            "AudioWaveform".to_string(),
            "Audio player with real-time waveform visualization (WASM platform).".to_string(),
        ),
        None => (
            "视频和音频示例".to_string(),
            "展示 Layer 3 视频播放器和音频波形组件的完整功能".to_string(),
            "VideoPlayer 视频播放器".to_string(),
            "完整的视频播放器，支持播放控制、音量调节和全屏功能。".to_string(),
            "AudioWaveform 音频波形".to_string(),
            "音频播放器，带有实时波形可视化（WASM 平台）。".to_string(),
        ),
    };

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
