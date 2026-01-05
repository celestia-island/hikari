// demo-app/src/pages/system/overview.rs
// System overview page (simplified)

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::app::Route;

/// System overview page
#[allow(non_snake_case)]
#[component]
pub fn SystemOverview() -> Element {
    rsx! {
        div { class: "hi-space-y-6",
            div { class: "hi-mb-8",
                h1 { class: "hi-text-4xl hi-font-bold hi-text-gray-800 hi-mb-2", "System" }
                p { class: "hi-text-gray-600", "Explore Hikari's foundational systems and utilities" }
            }

            // System categories grid
            div { class: "hi-grid hi-grid-cols-1 hi-md:grid-cols-2 hi-gap-6",
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
            class: "hi-block group",
            div {
                class: "hi-bg-white hi-rounded-lg shadow-md hi-p-6 hover:shadow-lg hover:-translate-y-1 hi-transition-all duration-200 border-2 border-transparent hover:border-[#4a9eff]",
                h3 { class: "hi-text-2xl hi-font-semibold hi-text-gray-800 hi-mb-2", "{title}" }
                p { class: "hi-text-gray-600", "{description}" }
            }
        }
    }
}
