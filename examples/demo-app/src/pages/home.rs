// demo-app/src/pages/home.rs
// Home page component

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::{app::Route, components::Layout};

#[component]
pub fn Home() -> Element {
    rsx! {
        Layout {
            current_route: Route::Home {},

            h1 { class: "hi-text-3xl lg:text-4xl hi-font-bold hi-mb-5 hi-text-dark-theme",
                "Welcome to Hikari UI Demo"
            }

            p { class: "hi-text-base lg:text-lg hi-leading-relaxed hi-text-gray-600 mb-8",
                "Hikari is a modern UI component library for Dioxus, inspired by Arknights design aesthetics with FUI (Futuristic User Interface) elements and traditional Chinese colors. The name \"Hikari\" comes from the rhythm game Arcaea."
            }

            div { class: "hi-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 mt-10",
                DemoCard {
                    title: "Basic Components".to_string(),
                    description: "Button, Input, Card, Badge".to_string(),
                    route: Route::ComponentsBasic {},
                }
                DemoCard {
                    title: "Feedback Components".to_string(),
                    description: "Alert, Toast, Tooltip".to_string(),
                    route: Route::ComponentsFeedback {},
                }
                DemoCard {
                    title: "Navigation Components".to_string(),
                    description: "Menu, Tabs, Breadcrumb".to_string(),
                    route: Route::ComponentsNavigation {},
                }
                DemoCard {
                    title: "Data Components".to_string(),
                    description: "Table, Tree".to_string(),
                    route: Route::ComponentsData {},
                }
            }

            div { class: "mt-15 hi-p-5 hi-bg-white hi-rounded-lg border-l-4 border-[#4a9eff] shadow-sm",
                h3 { class: "hi-text-xl hi-font-semibold mb-2.5 hi-text-dark-theme", "About Hikari" }
                p { class: "hi-m-0 hi-text-gray-600 hi-leading-relaxed",
                    "Hikari (光) means 'light' in Japanese. This library brings together the best of modern web design with traditional Chinese color palettes, creating a unique and beautiful UI experience."
                }
            }
        }
    }
}

#[component]
fn DemoCard(title: String, description: String, route: Route) -> Element {
    rsx! {
        Link { to: route,
            class: "hi-block hi-h-full",
            div {
                class: "hi-bg-white hi-p-6 hi-rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 hi-transition-all duration-200 hi-cursor-pointer",
                h3 { class: "hi-m-0 hi-mb-2 hi-text-dark-theme hi-text-lg hi-font-semibold",
                    "{title}"
                }
                p { class: "hi-m-0 hi-text-gray-600 hi-text-sm",
                    "{description}"
                }
            }
        }
    }
}
