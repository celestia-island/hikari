// website/src/pages/demos/layer3/video_demo.rs
// Layer 3: Video player and audio waveform demo example

use dioxus::prelude::*;

use crate::components::Layout;
use _components::{Button, Card};
use _extra_components::extra::{AudioWaveform, VideoPlayer};
use _palette::classes::{
    ClassesBuilder, Display, Flex, FontSize, Gap, MarginBottom, Padding, TextColor,
};

/// Video player and audio waveform demo
#[component]
pub fn VideoDemo() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::VideoDemo {},
            div {
                class: ClassesBuilder::new()
                    .add_raw("page-container")
                    .build(),

                div {
                    class: ClassesBuilder::new()
                        .add_raw("page-header")
                        .build(),

                    h1 {
                        class: ClassesBuilder::new()
                            .add_raw("page-title")
                            .add(FontSize::X4xl)
                            .build(),
                        "视频和音频示例"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add_raw("page-description")
                            .add(TextColor::Muted)
                            .add(FontSize::Xl)
                            .build(),
                        "展示 Layer 3 视频播放器和音频波形组件的完整功能"
                    }
                }

                // Video Player Demo
                div {
                    class: ClassesBuilder::new()
                        .add_raw("section")
                        .add(MarginBottom::Mb8)
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X2xl)
                            .add(MarginBottom::Mb4)
                            .build(),
                        "VideoPlayer 视频播放器"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add(TextColor::Muted)
                            .add(MarginBottom::Mb4)
                            .build(),
                        "完整的视频播放器，支持播放控制、音量调节和全屏功能。"
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

                // Audio Waveform Demo
                div {
                    class: ClassesBuilder::new()
                        .add_raw("section")
                        .add(MarginBottom::Mb8)
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X2xl)
                            .add(MarginBottom::Mb4)
                            .build(),
                        "AudioWaveform 音频波形"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add(TextColor::Muted)
                            .add(MarginBottom::Mb4)
                            .build(),
                        "音频播放器，带有实时波形可视化（WASM 平台）。"
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
}
