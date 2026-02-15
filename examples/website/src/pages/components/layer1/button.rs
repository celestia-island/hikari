use _components::basic::button::Button;
use _components::{ButtonVariant, IconButton, IconButtonSize};
use _icons::MdiIcon;
use _palette::classes::{ClassesBuilder, Display, FlexDirection, FlexWrap, Gap, Padding};
use dioxus::prelude::*;

use crate::components::{DemoSection, PageContainer};
use crate::hooks::use_i18n;

#[allow(non_snake_case)]
pub fn ButtonPage() -> Element {
    let i18n = use_i18n();

    let (page_title, page_desc, variants_title, disabled_title, icon_btn_title) = match i18n {
        Some(ctx) => {
            let keys = &ctx.keys;
            (
                format!("{} {}", keys.sidebar.items.button, "Button"),
                "Buttons are used to trigger actions or events, such as submitting forms, opening dialogs, or performing delete operations.".to_string(),
                "Button Variants".to_string(),
                "Disabled State".to_string(),
                "Icon Buttons".to_string(),
            )
        }
        None => (
            "Button 按钮".to_string(),
            "按钮用于触发操作或事件，如提交表单、打开对话框、取消操作或执行删除操作。".to_string(),
            "按钮变体".to_string(),
            "禁用状态".to_string(),
            "图标按钮".to_string(),
        ),
    };

    rsx! {
        PageContainer {
            current_route: crate::app::Route::Button {},
            title: page_title,
            description: page_desc,

            DemoSection {
                title: variants_title,
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

            DemoSection {
                title: disabled_title,
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

            DemoSection {
                title: icon_btn_title,
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
