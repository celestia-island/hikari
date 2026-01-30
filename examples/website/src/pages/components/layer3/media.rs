// website/src/pages/components/layer3/media.rs
// Layer 3: Media components index

use dioxus::prelude::*;

use crate::components::Layout;
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, FontSize, Gap, MarginBottom, Padding, TextColor};

/// Layer 3 Media Components Index
#[allow(non_snake_case)]
pub fn Layer3Media() -> Element {
    let components = vec![
        ("VideoPlayer", "视频播放器", "高级视频播放器", MdiIcon::Play),
        (
            "AudioPlayer",
            "音频播放器",
            "高级音频播放器",
            MdiIcon::Music,
        ),
    ];

    rsx! {
            Layout {
                current_route: crate::app::Route::Layer3Media {},
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
                            "Layer 3: 媒体组件"
                        }

                        p {
                            class: ClassesBuilder::new()
                                .add_raw("page-description")
                                .add(TextColor::Muted)
                                .add(FontSize::Xl)
                                .build(),
                            "生产级媒体播放组件。参考 Video.js、Howler.js。"
                        }
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add(Display::Grid)
                            .add_raw("grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6")
                            .build(),

                            for (name, cn_name, description, icon) in components {
                                div {
                                    class: ClassesBuilder::new()
                                        .add_raw("component-card")
                                        .add(Padding::P6)
                                        .build(),

                                    Icon {
                                        icon,
                                        size: 32,
                                        class: "component-icon"
                                    }

                                    h3 {
                                        class: ClassesBuilder::new()
                                            .add(FontSize::Lg)
                                            .add(MarginBottom::Mb1)
                                            .build(),
                                        "{name}"
                                    }

                                    p {
                                        class: ClassesBuilder::new()
                                            .add(TextColor::Muted)
                                            .add(MarginBottom::Mb2)
                                            .build(),
                                        "{cn_name}"
                                    }

                                    p {
                                        class: ClassesBuilder::new()
                                            .add(TextColor::Muted)
                                            .build(),
                                        "{description}"
                }
            }
        }
    }

                }
            }
        }
}
