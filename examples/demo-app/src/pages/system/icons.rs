// demo-app/src/pages/system/icons.rs
// Icons system page (simplified)

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};

/// Icons showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemIcons() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemIcons {},
            children: rsx! {
                div {
                    class: "page-container",

                    div {
                        class: "page-header",
                        h1 {
                            class: "page-title",
                            "Icons"
                        }
                        p {
                            class: "page-description",
                            "Powered by Lucide - 1000+ beautifully crafted icons"
                        }
                    }

                    div {
                        class: "info-box",
                        p {
                            class: "info-box-text",
                            "This page is under construction. Check back soon for detailed documentation and examples!"
                        }
                    }
                }
            }
        }
    }
}
