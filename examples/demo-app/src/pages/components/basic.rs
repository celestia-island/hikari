// demo-app/src/pages/components/basic_overview.rs
// Basic components overview page

use dioxus::prelude::*;

use crate::components::Layout;

/// Basic Components Overview
#[allow(non_snake_case)]
pub fn ComponentsBasic() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::ComponentsBasic {},
            h1 { "基础组件" }
            p { "Basic Components - 基础UI组件" }

            div { class: "component-grid",
                div { class: "component-card",
                    h3 { "Button 按钮" }
                    p { "用于触发操作的按钮组件" }
                }
                div { class: "component-card",
                    h3 { "Input 输入框" }
                    p { "文本输入组件" }
                }
                div { class: "component-card",
                    h3 { "Card 卡片" }
                    p { "内容容器卡片" }
                }
                div { class: "component-card",
                    h3 { "Badge 徽章" }
                    p { "状态标识徽章" }
                }
            }
        }
    }
}
