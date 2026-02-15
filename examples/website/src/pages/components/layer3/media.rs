use dioxus::prelude::*;

use crate::components::{DemoSection, PageContainer};
use crate::hooks::use_i18n;
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, FontSize, Gap, MarginBottom, Padding, TextColor};

#[allow(non_snake_case)]
pub fn Layer3Media() -> Element {
    let i18n = use_i18n();

    let (page_title, page_desc) = match i18n {
        Some(ref ctx) => {
            let keys = &ctx.keys;
            (
                format!("Layer 3: {}", keys.sidebar.items.media),
                "Production-level media playback components. Reference: Video.js, Howler.js."
                    .to_string(),
            )
        }
        None => (
            "Layer 3: 媒体组件".to_string(),
            "生产级媒体播放组件。参考 Video.js、Howler.js。".to_string(),
        ),
    };

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
        PageContainer {
            current_route: crate::app::Route::Layer3Media {},
            title: page_title,
            description: page_desc,

            DemoSection {
                title: match i18n {
                    Some(_) => "Components".to_string(),
                    None => "组件列表".to_string(),
                },
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
