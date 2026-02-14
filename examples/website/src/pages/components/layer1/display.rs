// website/src/pages/components/layer1/display.rs
// Layer 1: Display components index

use dioxus::prelude::*;

use crate::components::Layout;
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, FontSize, Gap, MarginBottom, Padding, TextColor};

/// Layer 1 Display Components Index
#[allow(non_snake_case)]
pub fn Layer1Display() -> Element {
    let components = vec![
        ("Avatar", "头像", "头像组件", MdiIcon::Account),
        ("Progress", "进度条", "进度条组件", MdiIcon::Pulse),
        ("Spinner", "加载", "加载指示器", MdiIcon::Loading),
        ("Image", "图片", "图片组件", MdiIcon::Image),
        ("Tag", "标签", "标签组件", MdiIcon::Tag),
        ("Divider", "分割线", "分割线组件", MdiIcon::Minus),
        ("Skeleton", "骨架屏", "骨架屏组件", MdiIcon::FormatAlignLeft),
    ];

    rsx! {
        Layout {
            current_route: crate::app::Route::Layer1Display {},
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
                        "Layer 1: 展示组件"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add_raw("page-description")
                            .add(TextColor::Muted)
                            .add(FontSize::Xl)
                            .build(),
                        "内容展示相关的基础组件。"
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
