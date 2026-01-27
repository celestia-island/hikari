// website/src/pages/components/display.rs
// Display components overview page

use dioxus::prelude::*;

use crate::components::Layout;
use _palette::classes::{ ClassesBuilder, Display, FontSize, FontWeight, Gap, MarginBottom, Padding, TextColor, };

/// Display Components Overview
#[allow(non_snake_case)]
pub fn ComponentsDisplay() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::ComponentsDisplay {},
            h1 { class: ClassesBuilder::new().add(FontSize::X4xl).add(FontWeight::Bold).build(), "展示组件" }
            p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "Display Components - 用于展示内容、媒体和状态信息" }

            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap6).add(Padding::P6).build(),
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Avatar 头像" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "用户头像组件，支持多种尺寸和形状变体" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Image 图片" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "图片组件，支持多种适配模式和响应式设计" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Tag 标签" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "标签组件，用于显示关键词、标签或状态" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Empty 空状态" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "空状态组件，用于显示空数据或占位符" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Comment 评论" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "评论组件，用于展示用户评论和回复" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "DescriptionList 描述列表" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "描述列表，用于展示键值对信息" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "QRCode 二维码" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "二维码组件，用于显示二维码" }
                }
            }
        }
    }
}
