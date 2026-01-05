// demo-app/src/pages/system/icons.rs
// Icons system page (simplified)

use dioxus::prelude::*;

/// Icons showcase page
#[allow(non_snake_case)]
pub fn SystemIcons() -> Element {
    rsx! {
        div { class: "space-y-6",
            div { class: "mb-8",
                h1 { class: "text-4xl font-bold text-gray-800 mb-2", "Icons" }
                p { class: "text-gray-600", "Powered by Lucide - 1000+ beautifully crafted icons" }
            }

            div { class: "bg-blue-50 border border-blue-200 rounded-lg p-6",
                p { class: "text-blue-800",
                    "This page is under construction. Check back soon for detailed documentation and examples!"
                }
            }
        }
    }
}
