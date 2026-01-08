// website/src/pages/components/feedback_overview.rs
// Feedback components overview page

use dioxus::prelude::*;

use crate::components::Layout;

/// Feedback Components Overview
#[allow(non_snake_case)]
pub fn ComponentsFeedback() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::ComponentsFeedback {},
            h1 { "反馈组件" }
            p { "Feedback Components - 反馈组件" }

            div { class: "component-grid",
                div { class: "component-card",
                    h3 { "Alert 警告" }
                    p { "警告提示组件" }
                }
                div { class: "component-card",
                    h3 { "Toast 提示" }
                    p { "轻量级消息提示" }
                }
                div { class: "component-card",
                    h3 { "Tooltip 文字提示" }
                    p { "悬浮提示组件" }
                }
            }
        }
    }
}
