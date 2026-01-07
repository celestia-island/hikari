// demo-app/src/pages/system/palette.rs
// Chinese traditional color palette system page (simplified)

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};

/// Palette showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemPalette() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemPalette {},
            children: rsx! {
                div {
                    class: "page-container",

                    div {
                        class: "page-header",
                        h1 {
                            class: "page-title",
                            "Chinese Traditional Colors"
                        }
                        p {
                            class: "page-description",
                            "500+ traditional colors from Chinese culture and history"
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
