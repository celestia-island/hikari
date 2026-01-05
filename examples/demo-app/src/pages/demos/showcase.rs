// demo-app/src/pages/demos/showcase.rs
// Demo showcase pages (simplified)

use dioxus::prelude::*;

/// Demo overview page
#[component]
pub fn DemosOverview() -> Element {
    rsx! {
        div { class: "space-y-6",
            div { class: "mb-8",
                h1 { class: "hi-text-4xl hi-font-bold hi-text-gray-800 hi-mb-2", "Demos" }
                p { class: "hi-text-gray-600", "Complete application examples showcasing Hikari in action" }
            }

            div { class: "bg-blue-50 hi-border border-blue-200 hi-rounded-lg hi-p-6",
                p { class: "hi-text-blue-800",
                    "This page is under construction. Check back soon for demo examples!"
                }
            }
        }
    }
}
