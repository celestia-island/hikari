// website/src/pages/demos/showcase.rs
// Demo showcase pages (simplified)

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _palette::classes::{
    ClassesBuilder, FontSize, FontWeight, MarginBottom,
    TextColor,
};

/// Demo overview page
#[component]
pub fn DemosOverview() -> Element {
    rsx! {
        Layout {
            current_route: Route::DemosOverview {},
            children: rsx! {
                div {
                    class: ClassesBuilder::new().add_raw("page-container").build(),

                    div {
                        class: ClassesBuilder::new().add_raw("page-header").build(),
                        h1 {
                            class: ClassesBuilder::new().add_raw("page-title").add(FontSize::X4xl).add(FontWeight::Bold).add(MarginBottom::Mb0).build(),
                            "Demos"
                        }
                        p {
                            class: ClassesBuilder::new().add_raw("page-description").add(TextColor::Secondary).build(),
                            "Complete application examples showcasing Hikari in action"
                        }
                    }

                    div {
                        class: ClassesBuilder::new().add_raw("info-box").build(),
                        p {
                            class: ClassesBuilder::new().add_raw("info-box-text").build(),
                            "This page is under construction. Check back soon for demo examples!"
                        }
                    }
                }
            }
        }
    }
}
