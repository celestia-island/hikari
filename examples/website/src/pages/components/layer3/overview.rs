// website/src/pages/components/layer3/overview.rs
// Layer 3 overview page

use crate::components::Layout;
use _palette::classes::{ClassesBuilder, Display, FontSize, Padding, TextColor};
use dioxus::prelude::*;

pub fn Layer3Overview() -> Element {
    rsx! {
        Layout {
            current_route: crate::app::Route::Layer3Overview {},
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
                        "Layer 3: 生产级组件"
                    }
                    p {
                        class: ClassesBuilder::new()
                            .add_raw("page-description")
                            .add(TextColor::Muted)
                            .add(FontSize::Xl)
                            .build(),
                        "完整的业务功能组件，基于 Layer 2 构建。"
                    }
                }
            }
        }
    }
}
