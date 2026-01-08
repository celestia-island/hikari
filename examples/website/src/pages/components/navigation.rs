// website/src/pages/components/navigation_overview.rs
// Navigation components overview page

use dioxus::prelude::*;

use crate::components::Layout;

/// Navigation Components Overview
#[allow(non_snake_case)]
pub fn ComponentsNavigation() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::ComponentsNavigation {},
            h1 { "导航组件" }
            p { "Navigation Components - 导航组件" }

            div { class: "component-grid",
                div { class: "component-card",
                    h3 { "Menu 菜单" }
                    p { "菜单导航组件" }
                }
                div { class: "component-card",
                    h3 { "Tabs 标签页" }
                    p { "标签页切换组件" }
                }
                div { class: "component-card",
                    h3 { "Breadcrumb 面包屑" }
                    p { "路径导航组件" }
                }
            }
        }
    }
}
