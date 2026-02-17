// website/src/pages/components/layer3/overview.rs
// Layer 3 overview page

use dioxus::prelude::*;

use crate::components::PageContainer;
use crate::hooks::{use_i18n, use_language};
use _palette::classes::{ClassesBuilder, FontSize, TextColor};

pub fn Layer3Overview() -> Element {
    let i18n = use_i18n();
    let lang_ctx = use_language();
    let lang = (*lang_ctx.language.read()).url_prefix().to_string();

    let (page_title, page_desc) = match i18n {
        Some(ctx) => {
            let keys = &ctx.keys;
            (
                format!(
                    "{}: {}",
                    keys.sidebar.components.title,
                    keys.sidebar
                        .components
                        .layer3
                        .clone()
                        .unwrap_or_else(|| "Layer 3".to_string())
                ),
                "Complete business components built on Layer 2.".to_string(),
            )
        }
        None => (
            "Layer 3: 生产级组件".to_string(),
            "完整的业务功能组件，基于 Layer 2 构建。".to_string(),
        ),
    };

    rsx! {
        PageContainer {
            current_route: crate::app::Route::Layer3Overview { lang },
            title: page_title,
            description: page_desc,
        }
    }
}
