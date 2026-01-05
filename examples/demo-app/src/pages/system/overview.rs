// demo-app/src/pages/system/overview.rs
// System overview page (simplified)

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::app::Route;

/// System overview page
#[allow(non_snake_case)]
pub fn SystemOverview() -> Element {
    rsx! {
        div { class: "space-y-6",
            div { class: "mb-8",
                h1 { class: "text-4xl font-bold text-gray-800 mb-2", "System" }
                p { class: "text-gray-600", "Explore Hikari's foundational systems and utilities" }
            }

            // System categories grid
            div { class: "grid grid-cols-1 md:grid-cols-2 gap-6",
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
            class: "block group",
            div {
                class: "bg-white rounded-lg shadow-md p-6 \
                         hover:shadow-lg hover:-translate-y-1 \
                         transition-all duration-200 \
                         border-2 border-transparent \
                         hover:border-[#4a9eff]",
                h3 { class: "text-2xl font-semibold text-gray-800 mb-2", "{title}" }
                p { class: "text-gray-600", "{description}" }
            }
        }
    }
}
