// website/src/pages/components/overview.rs
// Components overview page

use dioxus::prelude::*;

use crate::components::{DemoSection, PageContainer};
use crate::hooks::{use_i18n, use_language};
use _icons::{Icon, MdiIcon};
use _palette::classes::{ClassesBuilder, Display, Gap, Padding};

#[allow(non_snake_case)]
pub fn ComponentsOverview() -> Element {
    let i18n = use_i18n();
    let lang_ctx = use_language();
    let lang = (*lang_ctx.language.read()).url_prefix().to_string();

    let keys = i18n.keys();
    let page_title = keys.page.components.title.clone();
    let page_desc = keys.page.components.description.clone();
    let layout_title = "Layout Components".to_string();
    let basic_title = keys
        .sidebar
        .components
        .layer1
        .clone()
        .unwrap_or_else(|| "Basic Components".to_string());
    drop(keys);

    rsx! {
        PageContainer {
            current_route: crate::app::Route::ComponentsOverview { lang },
            title: page_title,
            description: page_desc,

            DemoSection {
                title: layout_title,
                div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap6).build(),
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::ViewDashboard, size: 24 }
                        div {
                            h3 { "Container" }
                            p { "Content container component" }
                        }
                    }
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::ViewColumn, size: 24 }
                        div {
                            h3 { "Grid" }
                            p { "Grid layout system" }
                        }
                    }
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::Panel, size: 24 }
                        div {
                            h3 { "Section" }
                            p { "Content section component" }
                        }
                    }
                }
            }

            DemoSection {
                title: basic_title,
                div { class: ClassesBuilder::new().add(Display::Grid).add(Gap::Gap6).build(),
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::GestureTap, size: 24 }
                        div {
                            h3 { "Button" }
                            p { "Action button component" }
                        }
                    }
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::TextBox, size: 24 }
                        div {
                            h3 { "Input" }
                            p { "Text input component" }
                        }
                    }
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::CubeOutline, size: 24 }
                        div {
                            h3 { "Card" }
                            p { "Content card component" }
                        }
                    }
                    div { class: ClassesBuilder::new().add(Display::Flex).add(Gap::Gap4).add(Padding::P4).build(),
                        Icon { icon: MdiIcon::Tag, size: 24 }
                        div {
                            h3 { "Badge" }
                            p { "Status badge component" }
                        }
                    }
                }
            }
        }
    }
}
