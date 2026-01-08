// website/src/pages/demos/showcase.rs
// Demo showcase pages (simplified)

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};

/// Demo overview page
#[component]
pub fn DemosOverview() -> Element {
    rsx! {
        Layout {
            current_route: Route::DemosOverview {},
            children: rsx! {
                div {
                    class: "page-container",

                    div {
                        class: "page-header",
                        h1 {
                            class: "page-title",
                            "Demos"
                        }
                        p {
                            class: "page-description",
                            "Complete application examples showcasing Hikari in action"
                        }
                    }

                    div {
                        class: "info-box",
                        p {
                            class: "info-box-text",
                            "This page is under construction. Check back soon for demo examples!"
                        }
                    }
                }
            }
        }
    }
}
