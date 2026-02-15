use _components::{
    Badge, BadgeVariant, Button, ButtonVariant, Card, CardActions, CardContent, CardHeader,
    Divider, DividerOrientation, DividerTextPosition, IconButton, IconButtonSize,
};
use _icons::MdiIcon;
use _palette::classes::{
    AlignItems, ClassesBuilder, Display, FlexDirection, FlexWrap, Gap, Padding,
};
use dioxus::prelude::*;

use crate::components::{DemoSection, PageContainer};
use crate::hooks::use_i18n;

#[allow(non_snake_case)]
pub fn Layer1Display() -> Element {
    let i18n = use_i18n();

    let (page_title, page_desc, card_title, badge_title, divider_title) = match i18n {
        Some(ctx) => {
            let keys = &ctx.keys;
            (
                format!(
                    "{}: {}",
                    keys.sidebar.components.title, keys.sidebar.items.display
                ),
                "Basic display components including Card, Badge, and Divider.".to_string(),
                "Card".to_string(),
                "Badge".to_string(),
                "Divider".to_string(),
            )
        }
        None => (
            "Display 展示组件".to_string(),
            "内容展示相关的基础组件，包括卡片、徽章和分割线。".to_string(),
            "Card 卡片".to_string(),
            "Badge 徽章".to_string(),
            "Divider 分割线".to_string(),
        ),
    };

    rsx! {
        PageContainer {
            current_route: crate::app::Route::Layer1Display {},
            title: page_title,
            description: page_desc,

            DemoSection {
                title: card_title,
                div {
                    class: ClassesBuilder::new()
                        .add(Display::Flex)
                        .add(FlexDirection::Row)
                        .add(Gap::Gap4)
                        .add(FlexWrap::Wrap)
                        .add(Padding::P4)
                        .build(),

                    Card { title: Some("Basic Card".to_string()), "This is a basic card component" }

                    Card {
                        CardHeader { title: Some("Card with Actions".to_string()) }
                        CardContent { div { "Card content area" } }
                        CardActions {
                            Button { variant: ButtonVariant::Ghost, "Cancel" }
                            Button { variant: ButtonVariant::Primary, "Confirm" }
                        }
                    }

                    Card {
                        CardHeader {
                            title: Some("Full Card".to_string()),
                            subtitle: Some("With subtitle".to_string()),
                            action: Some(rsx! {
                                IconButton {
                                    icon: MdiIcon::DotsHorizontal,
                                    size: IconButtonSize::Small,
                                    onclick: move |_| {},
                                }
                            }),
                        }
                        CardContent { div { "A complete card with header, content and actions" } }
                        CardActions {
                            Button { variant: ButtonVariant::Ghost, "Close" }
                            Button { variant: ButtonVariant::Secondary, "Save" }
                        }
                    }
                }
            }

            DemoSection {
                title: badge_title,
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
                        "Messages"
                        Badge { variant: BadgeVariant::Primary, count: Some(5) }
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add(Display::Flex)
                            .add(FlexDirection::Row)
                            .add(AlignItems::Center)
                            .add(Gap::Gap2)
                            .build(),
                        "Status"
                        Badge { variant: BadgeVariant::Success }
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add(Display::Flex)
                            .add(FlexDirection::Row)
                            .add(AlignItems::Center)
                            .add(Gap::Gap2)
                            .build(),
                        "Warning"
                        Badge { variant: BadgeVariant::Warning, count: Some(3) }
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add(Display::Flex)
                            .add(FlexDirection::Row)
                            .add(AlignItems::Center)
                            .add(Gap::Gap2)
                            .build(),
                        "Error"
                        Badge { variant: BadgeVariant::Danger, count: Some(2) }
                    }
                }
            }

            DemoSection {
                title: divider_title,
                div {
                    class: ClassesBuilder::new()
                        .add(Display::Flex)
                        .add(FlexDirection::Column)
                        .add(Gap::Gap4)
                        .add(Padding::P4)
                        .build(),

                    div { class: ClassesBuilder::new().add(Padding::P4).build(), "Content above" }
                    Divider {}
                    div { class: ClassesBuilder::new().add(Padding::P4).build(), "Content below" }
                    Divider {
                        text_position: DividerTextPosition::Center,
                        text: "Separator".to_string(),
                    }
                }
            }
        }
    }
}
