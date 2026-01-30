// website/src/pages/components/layer1/feedback.rs
// Layer 1: Feedback components index

use dioxus::prelude::*;

use crate::components::Layout;
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, FontSize, Gap, MarginBottom, Padding, TextColor};

/// Layer 1 Feedback Components Index
#[allow(non_snake_case)]
pub fn Layer1Feedback() -> Element {
    let components = vec![
        ("Alert", "提示", "提示组件", MdiIcon::AlertTriangle),
        ("Toast", "轻提示", "轻提示组件", MdiIcon::MessageSquare),
        ("Tooltip", "工具提示", "工具提示组件", MdiIcon::Help),
    ];

    rsx! {
        Layout {
            current_route: crate::app::Route::Layer1Feedback {},
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
                        "Layer 1: 反馈组件"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add_raw("page-description")
                            .add(TextColor::Muted)
                            .add(FontSize::Xl)
                            .build(),
                        "用户反馈相关的基础组件。"
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
