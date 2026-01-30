// website/src/pages/components/layer2/overview.rs
// Layer 2 overview page

use crate::components::Layout;
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, FontSize, MarginBottom, Padding, TextColor};
use dioxus::prelude::*;

pub fn Layer2Overview() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::Layer2Overview {},
            div {
                class: ClassesBuilder::new()
                    .add_raw("page-container")
                    .build(),
                div {
                    class: ClassesBuilder::new()
                        .add_raw("page-header")
                        .build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add_raw("page-title")
                            .add(FontSize::X4xl)
                            .build(),
                        "Layer 2: 复合组件"
                    }
                    p {
                        class: ClassesBuilder::new()
                            .add_raw("page-description")
                            .add(TextColor::Muted)
                            .add(FontSize::Xl)
                            .build(),
                        "由多个基础组件组合而成的复合组件。"
                    }
                }
            }
        }
    }
}
