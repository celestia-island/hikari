// website/src/pages/demos/layer3/video_demo.rs
// Layer 3: Video player demo example

use dioxus::prelude::*;

use crate::components::Layout;
use _components::{Button, Card};
use _palette::classes::{
    ClassesBuilder, Display, Flex, FontSize, Gap, MarginBottom, Padding, TextColor,
};

/// Video player demo
#[component]
pub fn VideoDemo() -> Element {
    let mut is_playing = use_signal(|| false);
    let current_time = use_signal(|| "0:00");
    let duration = use_signal(|| "10:30");

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
                        "视频播放器示例"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add_raw("page-description")
                            .add(TextColor::Muted)
                            .add(FontSize::Xl)
                            .build(),
                        "展示 Layer 3 视频播放器组件的完整功能"
                    }
                }

                // Video Player Demo
                div {
                    class: ClassesBuilder::new()
                        .add(Display::Flex)
                        .add_raw("justify-center items-center")
                        .add(Padding::P8)
                        .build(),

                    Card {
                        class: "video-player-card",

                        // Video Container
                        div {
                            class: "video-container",
                            div {
                                class: "video-placeholder",
                                "🎬 Video Placeholder"
                            }
                        }

                        // Controls
                        div {
                            class: ClassesBuilder::new()
                                .add_raw("video-controls")
                                .add(Padding::P4)
                                .build(),

                            // Progress Bar
                            div {
                                class: "progress-container",
                                div {
                                    class: "progress-bar",
                                    style: "width: 30%;",
                                }
                            }

                            // Time Display
                            div {
                                class: ClassesBuilder::new()
                                    .add(Display::Flex)
                                    .add_raw("justify-between items-center")
                                    .add(MarginBottom::Mb4)
                                    .build(),

                                span { class: "time-display", "{current_time}" }
                                span { class: "time-display", "{duration}" }
                            }

                            // Action Buttons
                            div {
                                class: ClassesBuilder::new()
                                    .add(Display::Flex)
                                    .add_raw("justify-center items-center gap-4")
                                    .build(),

                                Button {
                                    variant: _components::ButtonVariant::Ghost,
                                    "快退 -10s"
                                }

                                Button {
                                    variant: _components::ButtonVariant::Primary,
                                    onclick: move |_| is_playing.toggle(),
                                    if *is_playing.read() {
                                        "暂停 Pause"
                                    } else {
                                        "播放 Play"
                                    }
                                }

                                Button {
                                    variant: _components::ButtonVariant::Ghost,
                                    "快进 +10s"
                                }

                                // Volume Control
                                div {
                                    class: ClassesBuilder::new()
                                        .add(Display::Flex)
                                        .add_raw("justify-center items-center gap-4")
                                        .build(),

                                    Button {
                                        variant: _components::ButtonVariant::Ghost,
                                        "🔇"
                                    }

                                    div {
                                        class: "volume-slider",
                                        "Volume"
                                    }

                                    Button {
                                        variant: _components::ButtonVariant::Ghost,
                                        "🔈"
                                    }
                                }
                            }

                            // Settings
                            div {
                                class: ClassesBuilder::new()
                                    .add(Display::Flex)
                                    .add_raw("justify-between items-center mt-4")
                                    .build(),

                                div {
                                    class: "video-info",
                                    h4 { "示例视频.mp4" }
                                    p { "1920x1080 • H.264 • 10:30" }
                                }

                                Button {
                                    variant: _components::ButtonVariant::Ghost,
                                    "设置"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
