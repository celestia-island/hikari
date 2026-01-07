// demo-app/src/pages/system/animations.rs
// GSAP-inspired animation system page (simplified)

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};

/// Animations showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemAnimations() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemAnimations {},
            children: rsx! {
                div {
                    class: "page-container",

                    div {
                        class: "page-header",
                        h1 {
                            class: "page-title",
                            "Animation System"
                        }
                        p {
                            class: "page-description",
                            "GSAP-inspired state machine for smooth, declarative animations"
                        }
                    }

                    div {
                        class: "info-box",
                        p {
                            class: "info-box-text",
                            "This page is under construction. Check back soon for detailed documentation and examples!"
                        }
                    }
                }
            }
        }
    }
}
