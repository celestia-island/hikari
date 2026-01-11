// website/src/pages/components/basic_overview.rs
// Basic components overview page

use dioxus::prelude::*;

use crate::components::Layout;
use _palette::classes::{
    ClassesBuilder, Display, FontSize, FontWeight, Gap, GridCols, MarginBottom, Padding, TextColor,
};

/// Basic Components Overview
#[allow(non_snake_case)]
pub fn ComponentsBasic() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::ComponentsBasic {},
            h1 { class: ClassesBuilder::new().add(FontSize::X4xl).add(FontWeight::Bold).build(), "基础组件" }
            p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "Basic Components - 基础UI组件" }

            div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap6).add(Padding::P6).build(),
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Button 按钮" }
                    p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "用于触发操作的按钮组件" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Input 输入框" }
                    p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "文本输入组件" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Card 卡片" }
                    p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "内容容器卡片" }
                }
                div { class: ClassesBuilder::new().add_raw("component-card").add(Padding::P6).build(),
                    h3 { class: ClassesBuilder::new().add(MarginBottom::Mb4).add(FontSize::Lg).add(FontWeight::Semibold).build(), "Badge 徽章" }
                    p { class: ClassesBuilder::new().add(TextColor::Gray600).build(), "状态标识徽章" }
                }
            }
        }
    }
}
