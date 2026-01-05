// demo-app/src/pages/demos/showcase.rs
// Demo showcase pages (simplified)

use dioxus::prelude::*;

/// Demo overview page
#[component]
pub fn DemosOverview() -> Element {
    rsx! {
        div { class: "space-y-6",
            div { class: "mb-8",
                h1 { class: "text-4xl font-bold text-gray-800 mb-2", "Demos" }
                p { class: "text-gray-600", "Complete application examples showcasing Hikari in action" }
            }

            div { class: "bg-blue-50 border border-blue-200 rounded-lg p-6",
                p { class: "text-blue-800",
                    "This page is under construction. Check back soon for demo examples!"
                }
            }
        }
    }
}
