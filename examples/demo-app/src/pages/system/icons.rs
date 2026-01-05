// demo-app/src/pages/system/icons.rs
// Icons system page (simplified)

use dioxus::prelude::*;

/// Icons showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemIcons() -> Element {
    rsx! {
        div { class: "space-y-6",
            div { class: "mb-8",
                h1 { class: "hi-text-4xl hi-font-bold hi-text-gray-800 hi-mb-2", "Icons" }
                p { class: "hi-text-gray-600", "Powered by Lucide - 1000+ beautifully crafted icons" }
            }

            div { class: "bg-blue-50 hi-border border-blue-200 hi-rounded-lg hi-p-6",
                p { class: "hi-text-blue-800",
                    "This page is under construction. Check back soon for detailed documentation and examples!"
                }
            }
        }
    }
}
