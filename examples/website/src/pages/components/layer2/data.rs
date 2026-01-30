// website/src/pages/components/layer2/data.rs
// Layer 2: Data components index

use dioxus::prelude::*;

use crate::components::Layout;
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, FontSize, Gap, MarginBottom, Padding, TextColor};

/// Layer 2 Data Components Index
#[allow(non_snake_case)]
pub fn Layer2Data() -> Element {
    let components = vec![
        ("Table", "表格", "数据表格组件", MdiIcon::Table),
        ("Tree", "树", "树形组件", MdiIcon::SourceBranch),
        ("Pagination", "分页", "分页组件", MdiIcon::ChevronLeft),
    ];

    rsx! {
        Layout {
            current_route: crate::app::Route::Layer2Data {},
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
                        "Layer 2: 数据组件"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add_raw("page-description")
                            .add(TextColor::Muted)
                            .add(FontSize::Xl)
                            .build(),
                        "数据展示和管理的复合组件。"
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
