// demo-app/src/pages/system/palette.rs
// Chinese traditional color palette system page (simplified)

use dioxus::prelude::*;

/// Palette showcase page
#[allow(non_snake_case)]
pub fn SystemPalette() -> Element {
    rsx! {
        div { class: "space-y-6",
            div { class: "mb-8",
                h1 { class: "text-4xl font-bold text-gray-800 mb-2", "Chinese Traditional Colors" }
                p { class: "text-gray-600", "500+ traditional colors from Chinese culture and history" }
            }

            div { class: "bg-blue-50 border border-blue-200 rounded-lg p-6",
                p { class: "text-blue-800",
                    "This page is under construction. Check back soon for detailed documentation and examples!"
                }
            }
        }
    }
}
