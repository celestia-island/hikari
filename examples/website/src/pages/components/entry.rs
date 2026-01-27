// website/src/pages/components/entry.rs
// Entry components overview page

use dioxus::prelude::*;

use crate::components::Layout;
use _palette::classes::{ ClassesBuilder, Display, FontSize, FontWeight, Gap, MarginBottom, Padding, TextColor, };

/// Entry Components Overview
#[allow(non_snake_case)]
pub fn ComponentsEntry() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::ComponentsEntry {},
            h1 { class: ClassesBuilder::new().add(FontSize::X4xl).add(FontWeight::Bold).build(), "入口组件" }
            p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "Entry Components - 表单入口组件" }

            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap6).add(Padding::P6).build(),
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Cascader 级联选择器" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "带层级下拉的级联选择器，支持多级数据选择" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Transfer 穿梭框" }
                    p { class: ClassesBuilder::new().add(TextColor::Secondary).build(), "在两个列表之间移动项目的穿梭框，支持搜索过滤" }
                }
            }
        }
    }
}
