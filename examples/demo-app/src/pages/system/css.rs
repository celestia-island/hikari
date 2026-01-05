// demo-app/src/pages/system/css.rs
// CSS utilities system page (simplified)

use dioxus::prelude::*;

/// CSS utilities showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemCSS() -> Element {
    rsx! {
        div { class: "space-y-6",
            div { class: "mb-8",
                h1 { class: "hi-text-4xl hi-font-bold hi-text-gray-800 hi-mb-2", "CSS Utilities" }
                p { class: "hi-text-gray-600", "Tailwind-compatible utility classes for rapid styling" }
            }

            div { class: "bg-blue-50 hi-border border-blue-200 hi-rounded-lg hi-p-6",
                p { class: "hi-text-blue-800",
                    "This page is under construction. Check back soon for detailed documentation and examples!"
                }
            }
        }
    }
}
