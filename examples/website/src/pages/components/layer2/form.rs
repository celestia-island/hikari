use dioxus::prelude::*;

use crate::components::{DemoSection, PageContainer};
use crate::hooks::use_i18n;
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, FontSize, Gap, MarginBottom, Padding, TextColor};

#[allow(non_snake_case)]
pub fn Layer2Form() -> Element {
    let i18n = use_i18n();

    let (page_title, page_desc) = match i18n {
        Some(ref ctx) => {
            let keys = &ctx.keys;
            (
                format!("Layer 2: {}", keys.sidebar.items.form),
                "Form and input-related composite components.".to_string(),
            )
        }
        None => (
            "Layer 2: 表单组件".to_string(),
            "表单和输入相关的复合组件。".to_string(),
        ),
    };

    let components = vec![
        ("Form", "表单", "表单容器组件", MdiIcon::FileEdit),
        ("Dropdown", "下拉菜单", "下拉菜单组件", MdiIcon::ChevronDown),
        ("Modal", "对话框", "对话框组件", MdiIcon::Maximize2),
        (
            "Collapse",
            "折叠面板",
            "可折叠面板组件",
            MdiIcon::ChevronsUpDown,
        ),
    ];

    rsx! {
        PageContainer {
            current_route: crate::app::Route::Layer2Form {},
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
