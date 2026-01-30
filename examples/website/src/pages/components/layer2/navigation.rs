// website/src/pages/components/layer2/navigation.rs
// Layer 2: Navigation components index

use dioxus::prelude::*;

use crate::components::Layout;
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, FontSize, Gap, MarginBottom, Padding, TextColor};

/// Layer 2 Navigation Components Index
#[allow(non_snake_case)]
pub fn Layer2Navigation() -> Element {
    let components = vec![
        ("Menu", "菜单", "菜单组件", MdiIcon::Menu),
        ("Tabs", "标签页", "标签页组件", MdiIcon::Layers),
        ("Breadcrumb", "面包屑", "面包屑组件", MdiIcon::ChevronRight),
        ("Steps", "步骤条", "步骤条组件", MdiIcon::List),
    ];

    rsx! {
        Layout {
            current_route: crate::app::Route::Layer2Navigation {},
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
                        "Layer 2: 导航组件"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add_raw("page-description")
                            .add(TextColor::Muted)
                            .add(FontSize::Xl)
                            .build(),
                        "导航和路由相关的复合组件。"
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
