// website/src/pages/components/layer1/switch.rs
// Layer 1: Switch component index page

use dioxus::prelude::*;

use crate::components::PageContainer;
use crate::hooks::use_i18n;
use _icons::{Icon, MdiIcon};
use _palette::classes::{
    ClassesBuilder, Display, FlexDirection, FontSize, Gap, GridCols, MarginBottom, Padding,
    TextColor,
};

/// Layer 1 Switch Component Index
#[allow(non_snake_case)]
pub fn Layer1Switch() -> Element {
    let i18n = use_i18n();

    let (page_title, page_desc) = match i18n {
        Some(ctx) => {
            let keys = &ctx.keys;
            (
                format!(
                    "{}: {}",
                    keys.sidebar.components.title, keys.sidebar.items.switch
                ),
                "Basic switch control components.".to_string(),
            )
        }
        None => (
            "Layer 1: 开关组件".to_string(),
            "开关控件相关的基础组件。".to_string(),
        ),
    };

    let components = vec![
        ("Switch", "Toggle switch component", MdiIcon::ToggleSwitch),
        ("Progress", "Progress bar component", MdiIcon::Graph),
        ("Slider", "Range slider component", MdiIcon::Tune),
    ];

    rsx! {
        PageContainer {
            current_route: crate::app::Route::Layer1Switch {},
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
