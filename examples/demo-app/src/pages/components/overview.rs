// demo-app/src/pages/components/overview.rs
// Components overview page

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::{app::Route, components::Layout};

/// Component overview page
#[component]
pub fn ComponentsOverview() -> Element {
    let basic_route = Route::ComponentsBasic {};
    let feedback_route = Route::ComponentsFeedback {};
    let navigation_route = Route::ComponentsNavigation {};
    let data_route = Route::ComponentsData {};

    rsx! {
        Layout {
            current_route: Route::ComponentsOverview {},
            div {
                class: "page-container",

                // Header
                div {
                    class: "page-header",
                    h1 {
                        class: "page-title",
                        "Components"
                    }
                    p {
                        class: "page-description",
                        "Explore all Hikari UI components organized by category"
                    }
                }

                // Component categories grid
                div {
                    class: "component-grid",
                    ComponentCategoryCard {
                        title: "Basic Components".to_string(),
                        description: "Fundamental building blocks for your UI".to_string(),
                        route: basic_route,
                        components: vec!["Button".to_string(), "Input".to_string(), "Card".to_string(), "Badge".to_string()],
                    }

                    ComponentCategoryCard {
                        title: "Feedback Components".to_string(),
                        description: "Provide status and feedback to users".to_string(),
                        route: feedback_route,
                        components: vec!["Alert".to_string(), "Toast".to_string(), "Tooltip".to_string()],
                    }

                    ComponentCategoryCard {
                        title: "Navigation Components".to_string(),
                        description: "Help users navigate your application".to_string(),
                        route: navigation_route,
                        components: vec!["Menu".to_string(), "Tabs".to_string(), "Breadcrumb".to_string()],
                    }

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
            class: "component-category-card",

            h3 {
                class: "component-category-title",
                "{title}"
            }
            p {
                class: "component-category-description",
                "{description}"
            }
            div {
                class: "component-list",
                for component in &components {
                    span {
                        class: "component-tag",
                        "{component}"
                    }
                }
            }
        }
    }
}
