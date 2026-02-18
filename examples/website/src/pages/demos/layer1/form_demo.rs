use dioxus::prelude::*;

use crate::{components::{DemoSection, PageContainer}, hooks::{use_i18n, use_language}};
use _components::{Button, Card, Input};
use _palette::classes::{ ClassesBuilder, Display, Flex, FontSize, Gap, MarginBottom, Padding, TextColor, };

#[component]
pub fn FormDemo() -> Element {
    let email = use_signal(|| String::new());
    let password = use_signal(|| String::new());

    let i18n = use_i18n();
    let lang_ctx = use_language();
    let lang = (*lang_ctx.language.read()).url_prefix().to_string();

    let page_title = "Form Demo".to_string();
    let page_desc =
        "Demonstrates how to build a complete login form using Layer 1 basic components."
            .to_string();
    let section_title = "Login Form".to_string();

    rsx! {
        PageContainer {
            current_route: crate::app::Route::FormDemo { lang },
            title: page_title,
            description: page_desc,

            DemoSection {
                title: section_title,
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
