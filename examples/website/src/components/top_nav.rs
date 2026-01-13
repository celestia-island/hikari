// website/src/components/top_nav.rs
// Top navigation bar using Hikari Tabs component

use dioxus::prelude::*;

use crate::app::Route;
use _animation::style::{CssProperty, StyleStringBuilder};
use _palette::classes::{ AlignItems, BgColor, BorderRadius, ClassesBuilder, Display, FlexDirection, FontSize, FontWeight, Gap, JustifyContent, MarginBottom, Padding, TextColor, };

/// Top navigation bar with FUI styling
///
/// Provides navigation between main sections (组件/系统/案例)
/// using Hikari Tabs component with acrylic background and glow effects
#[component]
pub fn TopNav(current_route: Route) -> Element {
    // Determine active tab based on current route
    let mut active_tab = use_signal(|| match current_route {
        Route::Home {}
        | Route::ComponentsOverview {}
        | Route::ComponentsBasic {}
        | Route::ComponentsFeedback {}
        | Route::ComponentsNavigation {}
        | Route::ComponentsData {} => "0",

        Route::SystemOverview {}
        | Route::SystemCSS {}
        | Route::SystemIcons {}
        | Route::SystemPalette {}
        | Route::SystemAnimations {} => "1",

        Route::DemosOverview {} => "2",
        _ => "0",
    });

    rsx! {
        div {
            class: ClassesBuilder::new().add_raw("top-nav").build(),

            // Logo and title
            div {
                class: ClassesBuilder::new().add_raw("top-nav-header").add(Display::Flex).add(FlexDirection::Row).add(JustifyContent::Between).add(AlignItems::Center).add(MarginBottom::Mb3).build(),

                div {
                    class: ClassesBuilder::new().add_raw("top-nav-brand").add(Display::Flex).add(AlignItems::Center).add(Gap::Gap3).build(),

                    div {
                        class: ClassesBuilder::new().add_raw("top-nav-logo").build(),
                        span {
                            class: ClassesBuilder::new().add_raw("top-nav-logo-text").build(),
                            "H"
                        }
                    }

                    h1 {
                        class: ClassesBuilder::new().add_raw("top-nav-title").add(MarginBottom::Mb0).add(FontSize::Xl).add(FontWeight::Semibold).build(),
                        "Hikari UI"
                    }
                }

                a {
                    href: "https://github.com/celestia/hikari",
                    target: "_blank",
                    class: ClassesBuilder::new().add_raw("top-nav-github-link").build(),
                    "GitHub"
                }
            }

            // Navigation tabs (inline implementation)
            div {
                class: ClassesBuilder::new().add_raw("top-nav-tabs").add(Display::InlineFlex).build(),

                dioxus_router::components::Link {
                    to: Route::ComponentsOverview {},
                    class: ClassesBuilder::new()
                        .add_raw(if *active_tab.read() == "0" { "top-nav-tab-active" } else { "top-nav-tab" })
                        .build(),
                    onclick: move |_| { active_tab.set("0"); },
                    "组件"
                }

                dioxus_router::components::Link {
                    to: Route::SystemOverview {},
                    class: ClassesBuilder::new()
                        .add_raw(if *active_tab.read() == "1" { "top-nav-tab-active" } else { "top-nav-tab" })
                        .build(),
                    onclick: move |_| { active_tab.set("1"); },
                    "系统"
                }

                dioxus_router::components::Link {
                    to: Route::DemosOverview {},
                    class: ClassesBuilder::new()
                        .add_raw(if *active_tab.read() == "2" { "top-nav-tab-active" } else { "top-nav-tab" })
                        .build(),
                    onclick: move |_| { active_tab.set("2"); },
                    "案例"
                }
            }
        }
    }
}
