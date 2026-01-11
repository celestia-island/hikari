// website/src/pages/components/feedback_overview.rs
// Feedback components overview page

use dioxus::prelude::*;

use crate::components::Layout;
use _palette::classes::{
    ClassesBuilder, Display, FontSize, FontWeight, Gap, GridCols, MarginBottom, Padding, TextColor,
};

/// Feedback Components Overview
#[allow(non_snake_case)]
pub fn ComponentsFeedback() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::ComponentsFeedback {},
            h1 { class: ClassesBuilder::new().add(FontSize::X4xl).add(FontWeight::Bold).build(), "反馈组件" }
            p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "Feedback Components - 反馈组件" }

            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap6).add(Padding::P6).build(),
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Alert 警告" }
                    p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "警告提示组件" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Toast 提示" }
                    p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "轻量级消息提示" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Tooltip 文字提示" }
                    p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "悬浮提示组件" }
                }
            }
        }
    }
}
