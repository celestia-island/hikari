// website/src/pages/components/layer2/overview.rs
// Layer 2 overview page

use dioxus::prelude::*;

use crate::components::PageContainer;
use crate::hooks::{use_i18n, use_language};
use _palette::classes::{ClassesBuilder, FontSize, TextColor};

pub fn Layer2Overview() -> Element {
    let i18n = use_i18n();
    let lang_ctx = use_language();
    let lang = (*lang_ctx.language.read()).url_prefix().to_string();

    let keys = i18n.keys();
    let page_title = format!(
        "{}: {}",
        keys.sidebar.components.title,
        keys.sidebar
            .components
            .layer2
            .clone()
            .unwrap_or_else(|| "Layer 2".to_string())
    );
    let page_desc = "Composite components built from multiple basic components.".to_string();
    drop(keys);

    rsx! {
        PageContainer {
            current_route: crate::app::Route::Layer2Overview { lang },
            title: page_title,
            description: page_desc,
        }
    }
}
