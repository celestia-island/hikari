// demo-app/src/pages/components/overview.rs
// Components overview page (simplified)

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::app::Route;

/// Component overview page
#[component]
pub fn ComponentsOverview() -> Element {
    let basic_route = Route::ComponentsBasic {};
    let feedback_route = Route::ComponentsFeedback {};
    let navigation_route = Route::ComponentsNavigation {};
    let data_route = Route::ComponentsData {};

    rsx! {
        div { class: "space-y-6",
            // Header
            div { class: "mb-8",
                h1 { class: "hi-text-4xl hi-font-bold hi-text-gray-800 hi-mb-2", "Components" }
                p { class: "hi-text-gray-600", "Explore all Hikari UI components organized by category" }
            }

            // Component categories grid
            div { class: "hi-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",
                // Basic Components
                ComponentCategoryCard {
                    title: "Basic Components".to_string(),
                    description: "Fundamental building blocks for your UI".to_string(),
                    route: basic_route,
                    components: vec!["Button".to_string(), "Input".to_string(), "Card".to_string(), "Badge".to_string()],
                }

                // Feedback Components
                ComponentCategoryCard {
                    title: "Feedback Components".to_string(),
                    description: "Provide status and feedback to users".to_string(),
                    route: feedback_route,
                    components: vec!["Alert".to_string(), "Toast".to_string(), "Tooltip".to_string()],
                }

                // Navigation Components
                ComponentCategoryCard {
                    title: "Navigation Components".to_string(),
                    description: "Help users navigate your application".to_string(),
                    route: navigation_route,
                    components: vec!["Menu".to_string(), "Tabs".to_string(), "Breadcrumb".to_string()],
                }

                // Data Components
                ComponentCategoryCard {
                    title: "Data Components".to_string(),
                    description: "Display and manage complex data".to_string(),
                    route: data_route,
                    components: vec!["Table".to_string(), "Tree".to_string(), "Pagination".to_string()],
                }
            }
        }
    }
}

/// Component category card
#[component]
fn ComponentCategoryCard(
    title: String,
    description: String,
    route: Route,
    components: Vec<String>,
) -> Element {
    rsx! {
        Link {
            to: route,
            class: "hi-block group",
            div {
                class: "hi-bg-white hi-rounded-lg shadow-md hi-p-6 hover:shadow-lg hover:-translate-y-1 hi-transition-all duration-200 border-2 border-transparent hover:border-[#4a9eff]",
                h3 { class: "hi-text-xl hi-font-semibold hi-text-gray-800 hi-mb-2", "{title}" }
                p { class: "hi-text-gray-600 hi-text-sm hi-mb-3", "{description}" }
                div { class: "hi-text-xs hi-text-gray-500",
                    span { class: "hi-bg-gray-100 hi-px-2 py-1 hi-rounded", "{components.len()} components" }
                }
                div { class: "hi-mt-3",
                    for component in &components {
                        span { class: "hi-inline-block hi-bg-gray-100 hi-px-2 py-1 hi-rounded hi-mr-2 hi-mb-2 hi-text-xs", "{component}" }
                    }
                }
            }
        }
    }
}
