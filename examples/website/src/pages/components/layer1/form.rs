// website/src/pages/components/layer1/form.rs
// Layer 1: Form components index

use dioxus::prelude::*;

use crate::components::Layout;
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, FontSize, Gap, MarginBottom, Padding, TextColor};

/// Layer 1 Form Components Index
#[allow(non_snake_case)]
pub fn Layer1Form() -> Element {
    let components = vec![
        ("Field", "字段", "表单字段组件", MdiIcon::Pencil),
        ("Label", "标签", "表单标签组件", MdiIcon::Tag),
        (
            "Validation",
            "验证",
            "表单验证组件",
            MdiIcon::CheckboxMarkedCircle,
        ),
    ];

    rsx! {
        Layout {
            current_route: crate::app::Route::Layer1Form {},
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
                        "Layer 1: 表单组件"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add_raw("page-description")
                            .add(TextColor::Muted)
                            .add(FontSize::Xl)
                            .build(),
                        "表单相关的基础组件。"
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
