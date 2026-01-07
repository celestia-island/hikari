// demo-app/src/pages/system/css.rs
// CSS utilities system page (simplified)

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};

/// CSS utilities showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemCSS() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemCSS {},
            children: rsx! {
                div {
                    class: "page-container",

                    div {
                        class: "page-header",
                        h1 {
                            class: "page-title",
                            "CSS Utilities"
                        }
                        p {
                            class: "page-description",
                            "Tailwind-compatible utility classes for rapid styling"
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
