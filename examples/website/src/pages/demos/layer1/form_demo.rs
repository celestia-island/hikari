// website/src/pages/demos/layer1/form_demo.rs
// Layer 1: Form demo example

use dioxus::prelude::*;

use crate::components::Layout;
use _components::{Button, Card, Input};
use _palette::classes::{
    ClassesBuilder, Display, Flex, FontSize, Gap, MarginBottom, Padding, TextColor,
};

/// Form demo
#[component]
pub fn FormDemo() -> Element {
    let email = use_signal(|| String::new());
    let password = use_signal(|| String::new());

    rsx! {
        Layout {
            current_route: crate::app::Route::FormDemo {},
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
                        "表单示例"
                    }

                    p {
                        class: ClassesBuilder::new()
                            .add_raw("page-description")
                            .add(TextColor::Muted)
                            .add(FontSize::Xl)
                            .build(),
                        "展示如何使用 Layer 1 基础组件构建完整的登录表单"
                    }
                }

                // Demo Content
                div {
                    class: ClassesBuilder::new()
                        .add(Display::Flex)
                        .add_raw("justify-center items-center")
                        .add(Padding::P8)
                        .build(),

                    Card {
                        class: "form-card",
                        div {
                            class: "form-header",
                            h2 { "登录 Login" }
                            p { "欢迎回来，请登录您的账户" }
                        }

                        div {
                            class: ClassesBuilder::new()
                                .add_raw("form-body")
                                .add(MarginBottom::Mb6)
                                .build(),

                            // Email Field
                            div {
                                class: ClassesBuilder::new()
                                    .add_raw("form-field")
                                    .add(MarginBottom::Mb4)
                                    .build(),

                                label { class: "form-label", "邮箱 Email" }
                                Input {
                                    value: "{email}",
                                    placeholder: "请输入邮箱",
                                }
                            }

                            // Password Field
                            div {
                                class: ClassesBuilder::new()
                                    .add_raw("form-field")
                                    .add(MarginBottom::Mb4)
                                    .build(),

                                label { class: "form-label", "密码 Password" }
                                Input {
                                    value: "{password}",
                                    placeholder: "请输入密码",
                                    input_type: "password".to_string(),
                                }
                            }

                            // Actions
                            div {
                                class: ClassesBuilder::new()
                                    .add(Display::Flex)
                                    .add_raw("flex-row")
                                    .add_raw("justify-between items-center")
                                    .add(MarginBottom::Mb4)
                                    .build(),

                                label {
                                    class: "form-checkbox-label",
                                    input { r#type: "checkbox" }
                                    "记住我"
                                }

                                a { class: "form-link", "忘记密码？" }
                            }

                            // Submit Button
                            Button {
                                class: "form-submit",
                                "登录 Login"
                            }
                        }

                        div {
                            class: "form-footer",
                            p {
                                "还没有账户？"
                                a { class: "form-link", "立即注册" }
                            }
                        }
                    }
                }
            }
        }
    }
}
