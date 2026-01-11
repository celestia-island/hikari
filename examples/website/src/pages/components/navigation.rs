// website/src/pages/components/navigation_overview.rs
// Navigation components overview page

use dioxus::prelude::*;

use crate::components::Layout;
use _palette::classes::{
    ClassesBuilder, Display, FontSize, FontWeight, Gap, GridCols, MarginBottom, Padding, TextColor,
};

/// Navigation Components Overview
#[allow(non_snake_case)]
pub fn ComponentsNavigation() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::ComponentsNavigation {},
            h1 { class: ClassesBuilder::new().add(FontSize::X4xl).add(FontWeight::Bold).build(), "导航组件" }
            p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "Navigation Components - 导航组件" }

            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap6).add(Padding::P6).build(),
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Menu 菜单" }
                    p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "菜单导航组件" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Tabs 标签页" }
                    p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "标签页切换组件" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Breadcrumb 面包屑" }
                    p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "路径导航组件" }
                }
            }
        }
    }
}
