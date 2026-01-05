// demo-app/src/pages/system/animations.rs
// GSAP-inspired animation system page (simplified)

use dioxus::prelude::*;

/// Animations showcase page
#[allow(non_snake_case)]
pub fn SystemAnimations() -> Element {
    rsx! {
        div { class: "space-y-6",
            div { class: "mb-8",
                h1 { class: "text-4xl font-bold text-gray-800 mb-2", "Animation System" }
                p { class: "text-gray-600", "GSAP-inspired state machine for smooth, declarative animations" }
            }

            div { class: "bg-blue-50 border border-blue-200 rounded-lg p-6",
                p { class: "text-blue-800",
                    "This page is under construction. Check back soon for detailed documentation and examples!"
                }
            }
        }
    }
}
