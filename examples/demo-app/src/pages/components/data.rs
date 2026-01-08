// demo-app/src/pages/components/data_overview.rs
// Data components overview page

use dioxus::prelude::*;

use crate::components::Layout;

/// Data Components Overview
#[allow(non_snake_case)]
pub fn ComponentsData() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::ComponentsData {},
            h1 { "数据组件" }
            p { "Data Components - 数据展示组件" }

            div { class: "component-grid",
                div { class: "component-card",
                    h3 { "Table 表格" }
                    p { "表格数据展示" }
                    p { "Coming Soon..." }
                }
                div { class: "component-card",
                    h3 { "Tree 树形控件" }
                    p { "树形数据展示" }
                    p { "Coming Soon..." }
                }
                div { class: "component-card",
                    h3 { "Pagination 分页" }
                    p { "分页组件" }
                    p { "Coming Soon..." }
                }
            }
        }
    }
}
