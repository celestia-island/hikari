use _components::{
    Badge, BadgeVariant, Button, ButtonVariant, Card, CardActions, CardContent, CardHeader,
    Divider, DividerOrientation, DividerTextPosition, IconButton, IconButtonSize,
};
use _icons::MdiIcon;
use _palette::classes::{
    AlignItems, ClassesBuilder, Display, FlexDirection, FlexWrap, Gap, Padding,
};
use dioxus::prelude::*;

use crate::components::Layout;

#[allow(non_snake_case)]
pub fn Layer1Display() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::Layer1Display {},
            div {
                class: ClassesBuilder::new()
                    .add_raw("page-container")
                    .build(),

                h1 {
                    class: ClassesBuilder::new()
                        .add_raw("page-title")
                        .build(),
                    "Display 展示组件"
                }

                p {
                    class: ClassesBuilder::new()
                        .add_raw("page-description")
                        .build(),
                    "内容展示相关的基础组件，包括卡片、徽章和分割线。"
                }

                section {
                    class: ClassesBuilder::new()
                        .add_raw("demo-section")
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add_raw("section-title")
                            .build(),
                        "Card 卡片"
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add(Display::Flex)
                            .add(FlexDirection::Row)
                            .add(Gap::Gap4)
                            .add(FlexWrap::Wrap)
                            .add(Padding::P4)
                            .build(),

                        Card { title: Some("基础卡片".to_string()), "这是一个基础的卡片组件" }

                        Card {
                            CardHeader { title: Some("带操作的卡片".to_string()) }
                            CardContent { div { "卡片内容区域" } }
                            CardActions {
                                Button { variant: ButtonVariant::Ghost, "取消" }
                                Button { variant: ButtonVariant::Primary, "确认" }
                            }
                        }

                        Card {
                            CardHeader {
                                title: Some("完整卡片".to_string()),
                                subtitle: Some("带有副标题".to_string()),
                                action: Some(rsx! {
                                    IconButton {
                                        icon: MdiIcon::DotsHorizontal,
                                        size: IconButtonSize::Small,
                                        onclick: move |_| {},
                                    }
                                }),
                            }
                            CardContent { div { "这是一个完整卡片，包含头部、内容和操作区域" } }
                            CardActions {
                                Button { variant: ButtonVariant::Ghost, "关闭" }
                                Button { variant: ButtonVariant::Secondary, "保存" }
                            }
                        }
                    }
                }

                section {
                    class: ClassesBuilder::new()
                        .add_raw("demo-section")
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add_raw("section-title")
                            .build(),
                        "Badge 徽章"
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add(Display::Flex)
                            .add(FlexDirection::Row)
                            .add(AlignItems::Center)
                            .add(Gap::Gap4)
                            .add(FlexWrap::Wrap)
                            .add(Padding::P4)
                            .build(),

                        div {
                            class: ClassesBuilder::new()
                                .add(Display::Flex)
                                .add(FlexDirection::Row)
                                .add(AlignItems::Center)
                                .add(Gap::Gap2)
                                .build(),
                            "消息"
                            Badge { variant: BadgeVariant::Primary, count: Some(5) }
                        }

                        div {
                            class: ClassesBuilder::new()
                                .add(Display::Flex)
                                .add(FlexDirection::Row)
                                .add(AlignItems::Center)
                                .add(Gap::Gap2)
                                .build(),
                            "状态"
                            Badge { variant: BadgeVariant::Success }
                        }

                        div {
                            class: ClassesBuilder::new()
                                .add(Display::Flex)
                                .add(FlexDirection::Row)
                                .add(AlignItems::Center)
                                .add(Gap::Gap2)
                                .build(),
                            "警告"
                            Badge { variant: BadgeVariant::Warning, count: Some(3) }
                        }

                        div {
                            class: ClassesBuilder::new()
                                .add(Display::Flex)
                                .add(FlexDirection::Row)
                                .add(AlignItems::Center)
                                .add(Gap::Gap2)
                                .build(),
                            "错误"
                            Badge { variant: BadgeVariant::Danger, count: Some(2) }
                        }
                    }
                }

                section {
                    class: ClassesBuilder::new()
                        .add_raw("demo-section")
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add_raw("section-title")
                            .build(),
                        "Divider 分割线"
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add(Display::Flex)
                            .add(FlexDirection::Column)
                            .add(Gap::Gap4)
                            .add(Padding::P4)
                            .build(),

                        div { class: ClassesBuilder::new().add(Padding::P4).build(), "上方内容" }
                        Divider {}
                        div { class: ClassesBuilder::new().add(Padding::P4).build(), "下方内容" }
                        Divider {
                            text_position: DividerTextPosition::Center,
                            text: "分隔文本".to_string(),
                        }
                    }
                }
            }
        }
    }
}
