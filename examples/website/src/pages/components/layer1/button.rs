use _components::basic::button::Button;
use _components::{ButtonVariant, IconButton, IconButtonSize};
use _icons::MdiIcon;
use _palette::classes::{ClassesBuilder, Display, FlexDirection, FlexWrap, Gap, Padding};
use dioxus::prelude::*;

use crate::components::Layout;

#[allow(non_snake_case)]
pub fn ButtonPage() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::Button {},
            div {
                class: ClassesBuilder::new()
                    .add_raw("page-container")
                    .build(),

                h1 {
                    class: ClassesBuilder::new()
                        .add_raw("page-title")
                        .build(),
                    "Button 按钮"
                }

                p {
                    class: ClassesBuilder::new()
                        .add_raw("page-description")
                        .build(),
                    "按钮用于触发操作或事件，如提交表单、打开对话框、取消操作或执行删除操作。"
                }

                section {
                    class: ClassesBuilder::new()
                        .add_raw("demo-section")
                        .build(),

                    h2 {
                        class: ClassesBuilder::new()
                            .add_raw("section-title")
                            .build(),
                        "按钮变体"
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add(Display::Flex)
                            .add(FlexDirection::Row)
                            .add(Gap::Gap4)
                            .add(FlexWrap::Wrap)
                            .add(Padding::P4)
                            .build(),

                        Button { variant: ButtonVariant::Primary, "Primary" }
                        Button { variant: ButtonVariant::Secondary, "Secondary" }
                        Button { variant: ButtonVariant::Ghost, "Ghost" }
                        Button { variant: ButtonVariant::Danger, "Danger" }
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
                        "禁用状态"
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add(Display::Flex)
                            .add(FlexDirection::Row)
                            .add(Gap::Gap4)
                            .add(FlexWrap::Wrap)
                            .add(Padding::P4)
                            .build(),

                        Button { variant: ButtonVariant::Primary, disabled: true, "Primary" }
                        Button { variant: ButtonVariant::Secondary, disabled: true, "Secondary" }
                        Button { variant: ButtonVariant::Ghost, disabled: true, "Ghost" }
                        Button { variant: ButtonVariant::Danger, disabled: true, "Danger" }
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
                        "图标按钮"
                    }

                    div {
                        class: ClassesBuilder::new()
                            .add(Display::Flex)
                            .add(FlexDirection::Row)
                            .add(Gap::Gap4)
                            .add(FlexWrap::Wrap)
                            .add(Padding::P4)
                            .build(),

                        IconButton {
                            icon: MdiIcon::Check,
                            size: IconButtonSize::Small,
                            onclick: move |_| {},
                        }
                        IconButton {
                            icon: MdiIcon::Pencil,
                            size: IconButtonSize::Medium,
                            onclick: move |_| {},
                        }
                        IconButton {
                            icon: MdiIcon::Close,
                            size: IconButtonSize::Large,
                            onclick: move |_| {},
                        }
                    }
                }
            }
        }
    }
}
