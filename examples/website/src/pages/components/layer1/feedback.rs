// website/src/pages/components/layer1/feedback.rs
// Layer 1: Feedback components index

use dioxus::prelude::*;

use crate::components::PageContainer;
use crate::hooks::use_i18n;
use _icons::{Icon, MdiIcon};
use _palette::classes::{
    ClassesBuilder, Display, FlexDirection, FontSize, Gap, GridCols, MarginBottom, Padding,
    TextColor,
};

/// Layer 1 Feedback Components Index
#[allow(non_snake_case)]
pub fn Layer1Feedback() -> Element {
    let i18n = use_i18n();

    let (page_title, page_desc) = match i18n {
        Some(ctx) => {
            let keys = &ctx.keys;
            (
                format!(
                    "{}: {}",
                    keys.sidebar.components.title, keys.sidebar.items.feedback
                ),
                "Basic user feedback components.".to_string(),
            )
        }
        None => (
            "Layer 1: 反馈组件".to_string(),
            "用户反馈相关的基础组件。".to_string(),
        ),
    };

    let components = vec![
        (
            "Alert",
            "Alert notification component",
            MdiIcon::AlertTriangle,
        ),
        (
            "Toast",
            "Light notification component",
            MdiIcon::MessageSquare,
        ),
        ("Tooltip", "Tooltip component", MdiIcon::Help),
    ];

    rsx! {
        PageContainer {
            current_route: crate::app::Route::Layer1Feedback {},
            title: page_title,
            description: page_desc,

            div {
                class: ClassesBuilder::new()
                    .add(Display::Grid)
                    .add(GridCols::Col3)
                    .add(Gap::Gap6)
                    .build(),

                for (name, description, icon) in components {
                    div {
                        class: ClassesBuilder::new()
                            .add(Padding::P6)
                            .add(Display::Flex)
                            .add(FlexDirection::Column)
                            .add(Gap::Gap2)
                            .build(),

                        Icon {
                            icon,
                            size: 32,
                        }

                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(MarginBottom::Mb1)
                                .add(TextColor::Primary)
                                .build(),
                            "{name}"
                        }

                        p {
                            class: ClassesBuilder::new()
                                .add(TextColor::Secondary)
                                .add(FontSize::Sm)
                                .build(),
                            "{description}"
                        }
                    }
                }
            }
        }
    }
}
