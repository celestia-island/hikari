// demo-app/src/pages/system/animations.rs
// GSAP-inspired animation system page (simplified)

use dioxus::prelude::*;

/// Animations showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemAnimations() -> Element {
    rsx! {
        div { class: "space-y-6",
            div { class: "mb-8",
                h1 { class: "hi-text-4xl hi-font-bold hi-text-gray-800 hi-mb-2", "Animation System" }
                p { class: "hi-text-gray-600", "GSAP-inspired state machine for smooth, declarative animations" }
            }

            div { class: "bg-blue-50 hi-border border-blue-200 hi-rounded-lg hi-p-6",
                p { class: "hi-text-blue-800",
                    "This page is under construction. Check back soon for detailed documentation and examples!"
                }
            }
        }
    }
}
