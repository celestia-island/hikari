// website/src/pages/system/animations.rs
// GSAP-inspired animation system page (simplified)

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _palette::classes::{
    ClassesBuilder, FontSize, FontWeight, MarginBottom,
    TextColor,
};

/// Animations showcase page
#[allow(non_snake_case)]
#[component]
pub fn SystemAnimations() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemAnimations {},
            children: rsx! {
                div {
                    class: ClassesBuilder::new().add_raw("page-container").build(),

                    div {
                        class: ClassesBuilder::new().add_raw("page-header").build(),
                        h1 {
                            class: ClassesBuilder::new().add_raw("page-title").add(FontSize::X4xl).add(FontWeight::Bold).add(MarginBottom::Mb0).build(),
                            "Animation System"
                        }
                        p {
                            class: ClassesBuilder::new().add_raw("page-description").add(TextColor::Secondary).build(),
                            "GSAP-inspired state machine for smooth, declarative animations"
                        }
                    }

                    div {
                        class: ClassesBuilder::new().add_raw("info-box").build(),
                        p {
                            class: ClassesBuilder::new().add_raw("info-box-text").build(),
                            "This page is under construction. Check back soon for detailed documentation and examples!"
                        }
                    }
                }
            }
        }
    }
}
