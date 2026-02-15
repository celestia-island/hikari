// website/src/pages/components/layer2/overview.rs
// Layer 2 overview page

use dioxus::prelude::*;

use crate::components::PageContainer;
use crate::hooks::use_i18n;
use _palette::classes::{ClassesBuilder, FontSize, TextColor};

pub fn Layer2Overview() -> Element {
    let i18n = use_i18n();

    let (page_title, page_desc) = match i18n {
        Some(ctx) => {
            let keys = &ctx.keys;
            (
                format!(
                    "{}: {}",
                    keys.sidebar.components.title,
                    keys.sidebar
                        .components
                        .layer2
                        .clone()
                        .unwrap_or_else(|| "Layer 2".to_string())
                ),
                "Composite components built from multiple basic components.".to_string(),
            )
        }
        None => (
            "Layer 2: 复合组件".to_string(),
            "由多个基础组件组合而成的复合组件。".to_string(),
        ),
    };

    rsx! {
        PageContainer {
            current_route: crate::app::Route::Layer2Overview {},
            title: page_title,
            description: page_desc,
        }
    }
}
