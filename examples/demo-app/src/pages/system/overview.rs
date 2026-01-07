// demo-app/src/pages/system/overview.rs
// System overview page (simplified)

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::{app::Route, components::Layout};

/// System overview page
#[allow(non_snake_case)]
#[component]
pub fn SystemOverview() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemOverview {},
            children: rsx! {
                div {
                    class: "page-container",

                    div {
                        class: "page-header",
                        h1 {
                            class: "page-title",
                            "System"
                        }
                        p {
                            class: "page-description",
                            "Explore Hikari's foundational systems and utilities"
                        }
                    }

                    // System categories grid
                    div {
                        class: "component-grid",
                        SystemCard {
                            title: "CSS Utilities".to_string(),
                            description: "Tailwind-compatible utility classes for rapid styling".to_string(),
                            route: Route::SystemCSS {}
                        }

                        SystemCard {
                            title: "Icons".to_string(),
                            description: "Comprehensive icon library powered by Lucide".to_string(),
                            route: Route::SystemIcons {}
                        }

                        SystemCard {
                            title: "Palette".to_string(),
                            description: "Chinese traditional color system with 500+ colors".to_string(),
                            route: Route::SystemPalette {}
                        }

                        SystemCard {
                            title: "Animations".to_string(),
                            description: "GSAP-inspired animation system for smooth transitions".to_string(),
                            route: Route::SystemAnimations {}
                        }
                    }
                }
            }
        }
    }
}

/// System feature card
#[component]
fn SystemCard(
    title: String,
    description: String,
    route: Route,
) -> Element {
    rsx! {
        Link {
            to: route,
            class: "system-card",
            div {
                class: "system-card-inner",
                h3 {
                    class: "system-card-title",
                    "{title}"
                }
                p {
                    class: "system-card-description",
                    "{description}"
                }
            }
        }
    }
}
