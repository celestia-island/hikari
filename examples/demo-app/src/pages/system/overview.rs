// demo-app/src/pages/system/overview.rs
// System overview page (simplified)

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::{app::Route, components::Layout};
use palette::classes::{
    BgColor, BorderRadius, ClassesBuilder, Display, Duration, FlexDirection, FontSize, FontWeight,
    Gap, GridCols, Margin, Padding, Shadow, TextColor, Transition,
};

/// System overview page
#[allow(non_snake_case)]
#[component]
pub fn SystemOverview() -> Element {
    rsx! {
        Layout {
            current_route: Route::SystemOverview {},
            children: rsx! {
                div {
                    class: ClassesBuilder::new()
                        .add(Display::Flex)
                        .add(FlexDirection::Column)
                        .add(Gap::Gap6)
                        .build(),

                // System categories grid

    

                    div { class: ClassesBuilder::new().add(Margin::M0).build(),
                        h1 {
                            class: ClassesBuilder::new()
                                .add(FontSize::X4xl)
                                .add(FontWeight::Bold)
                                .add(TextColor::Gray900)
                                .add(Margin::M0)
                                .build(),
                            "System"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Gray600).build(),
                            "Explore Hikari's foundational systems and utilities"
                        }
                    }
    
                    div { class: ClassesBuilder::new().add(Display::Grid).add(GridCols::Col3).add(Gap::Gap6).build(),
                        SystemCard {
                            title: "CSS Utilities".to_string(),
                            description: "Tailwind-compatible utility classes for rapid styling".to_string(),
                            route: Route::SystemCSS {},
                        }
    
                        SystemCard {
                            title: "Icons".to_string(),
                            description: "Comprehensive icon library powered by Lucide".to_string(),
                            route: Route::SystemIcons {},
                        }
    
                        SystemCard {
                            title: "Palette".to_string(),
                            description: "Chinese traditional color system with 500+ colors".to_string(),
                            route: Route::SystemPalette {},
                        }
    
                        SystemCard {
                            title: "Animations".to_string(),
                            description: "GSAP-inspired animation system for smooth transitions".to_string(),
                            route: Route::SystemAnimations {},
                        }
                    }
                }
            },
        }
    }
}

/// System feature card
#[component]
fn SystemCard(title: String, description: String, route: Route) -> Element {
    rsx! {
        Link {
            to: route,
            class: ClassesBuilder::new()
                .add(Display::Block)
                .add(Transition::All)
                .add(Duration::D300)
                .build(),
            div {
                class: ClassesBuilder::new()
                    .add(BgColor::White)
                    .add(BorderRadius::Lg)
                    .add(Padding::P6)
                    .add(Shadow::Md)
                    .add(Transition::All)
                    .add(Duration::D300)
                    .build(),
                h3 {
                    class: ClassesBuilder::new()
                        .add(FontSize::X2xl)
                        .add(FontWeight::Semibold)
                        .add(TextColor::Gray900)
                        .add(Margin::M0)
                        .build(),
                    "{title}"
                }
                p { class: ClassesBuilder::new().add(TextColor::Gray600).add(Margin::M0).build(),
                    "{description}"
                }
            }
        }
    }
}
