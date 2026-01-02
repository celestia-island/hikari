// demo-app/src/pages/home.rs
// Home page component

use dioxus::prelude::*;
use dioxus_router::components::Link;
use crate::app::Route;
use crate::components::Layout;

#[component]
pub fn Home() -> Element {
    rsx! {
        Layout {
            current_route: Route::Home {},

            h1 { class: "text-3xl lg:text-4xl font-bold mb-5 text-[#1a1a2e]",
                "Welcome to Hikari UI Demo"
            }

            p { class: "text-base lg:text-lg leading-relaxed text-gray-600 mb-8",
                "Hikari is a modern UI component library for Dioxus, inspired by Arknights design aesthetics with FUI (Futuristic User Interface) elements and traditional Chinese colors. The name \"Hikari\" comes from the rhythm game Arcaea."
            }

            div { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 mt-10",
                DemoCard {
                    title: "Basic Components".to_string(),
                    description: "Button, Input, Card, Badge".to_string(),
                    route: Route::BasicComponents {},
                }
                DemoCard {
                    title: "Feedback Components".to_string(),
                    description: "Alert, Toast, Tooltip".to_string(),
                    route: Route::FeedbackComponents {},
                }
                DemoCard {
                    title: "Navigation Components".to_string(),
                    description: "Menu, Tabs, Breadcrumb".to_string(),
                    route: Route::NavigationComponents {},
                }
                DemoCard {
                    title: "Data Components".to_string(),
                    description: "Table, Tree".to_string(),
                    route: Route::DataComponents {},
                }
            }

            div { class: "mt-15 p-5 bg-white rounded-lg border-l-4 border-[#4a9eff] shadow-sm",
                h3 { class: "text-xl font-semibold mb-2.5 text-[#1a1a2e]", "About Hikari" }
                p { class: "m-0 text-gray-600 leading-relaxed",
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
            class: "block h-full",
            div {
                class: "bg-white p-6 rounded-xl shadow-md hover:shadow-lg \
                        hover:-translate-y-1 transition-all duration-200 cursor-pointer",
                h3 { class: "m-0 mb-2 text-[#1a1a2e] text-lg font-semibold",
                    "{title}"
                }
                p { class: "m-0 text-gray-600 text-sm",
                    "{description}"
                }
            }
        }
    }
}
