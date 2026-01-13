// website/src/pages/components/data.rs
// Data components overview page

use dioxus::prelude::*;

use crate::components::Layout;
use _palette::classes::{ ClassesBuilder, Display, FontSize, FontWeight, Gap, GridCols, MarginBottom, Padding, TextColor, };

/// Data Components Overview
#[allow(non_snake_case)]
pub fn ComponentsData() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::ComponentsData {},
            h1 { class: ClassesBuilder::new().add(FontSize::X4xl).add(FontWeight::Bold).build(), "数据组件" }
            p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "Data Components - 数据展示组件" }

            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap6).add(Padding::P6).build(),
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Table 表格" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "表格数据展示" }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb4).build(), "Coming Soon..." }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Tree 树形控件" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "树形数据展示" }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb4).build(), "Coming Soon..." }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Pagination 分页" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "分页组件" }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb4).build(), "Coming Soon..." }
                }
            }
        }
    }
}
