// website/src/pages/components/overview.rs
// Components overview page

use dioxus::prelude::*;

use crate::components::Layout;
use _icons::{Icon, MdiIcon};
use _palette::classes::{
    ClassesBuilder, Display, Gap, MarginBottom, Padding,
};

/// Components Overview
#[allow(non_snake_case)]
pub fn ComponentsOverview() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::ComponentsOverview {
            },
            h1 { "组件总览" }
            p { "Components Overview - Hikari UI 组件库" }

            div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                h2 { "布局组件 Layout" }
                div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap6).build(),
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::Alert, size: 24 }
                        div {
                            h3 { "Container 容器" }
                            p { "内容容器组件" }
                        }
                    }
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::Alert, size: 24 }
                        div {
                            h3 { "Grid 网格" }
                            p { "网格布局系统" }
                        }
                    }
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::Alert, size: 24 }
                        div {
                            h3 { "Section 分区" }
                            p { "内容分区组件" }
                        }
                    }
                }
            }

            div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                h2 { "基础组件 Basic" }
                div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap6).build(),
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::Alert, size: 24 }
                        div {
                            h3 { "Button 按钮" }
                            p { "操作按钮组件" }
                        }
                    }
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::Alert, size: 24 }
                        div {
                            h3 { "Input 输入框" }
                            p { "文本输入组件" }
                        }
                    }
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::Alert, size: 24 }
                        div {
                            h3 { "Card 卡片" }
                            p { "内容卡片组件" }
                        }
                    }
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::Alert, size: 24 }
                        div {
                            h3 { "Badge 徽章" }
                            p { "状态徽章组件" }
                        }
                    }
                }
            }
        }
    }
}
