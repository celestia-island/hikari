// demo-app/src/components/top_nav.rs
// Top navigation bar using Hikari Tabs component

use dioxus::prelude::*;

use crate::app::Route;

/// Top navigation bar with FUI styling
///
/// Provides navigation between main sections (组件/系统/案例)
/// using Hikari Tabs component with acrylic background and glow effects
#[component]
pub fn TopNav(current_route: Route) -> Element {
    // Determine active tab based on current route
    let mut active_tab = use_signal(|| {
        match current_route {
            Route::Home {} | Route::ComponentsOverview {} |
            Route::ComponentsBasic {} | Route::ComponentsFeedback {} |
            Route::ComponentsNavigation {} | Route::ComponentsData {} => "0",

            Route::SystemOverview {} | Route::SystemCSS {} |
            Route::SystemIcons {} | Route::SystemPalette {} |
            Route::SystemAnimations {} => "1",

            Route::DemosOverview {} => "2",
            _ => "0",
        }
    });

    rsx! {
        div {
            class: "top-nav",

            // Logo and title
            div {
                class: "top-nav-header",

                div {
                    class: "top-nav-brand",

                    div {
                        class: "top-nav-logo",
                        span {
                            class: "top-nav-logo-text",
                            "H"
                        }
                    }

                    h1 {
                        class: "top-nav-title",
                        "Hikari UI"
                    }
                }

                a {
                    href: "https://github.com/celestia/hikari",
                    target: "_blank",
                    class: "top-nav-github-link",
                    "GitHub"
                }
            }

            // Navigation tabs (inline implementation)
            div {
                class: "top-nav-tabs",

                dioxus_router::components::Link {
                    to: Route::ComponentsOverview {},
                    class: if *active_tab.read() == "0" {
                        "top-nav-tab-active"
                    } else {
                        "top-nav-tab"
                    },
                    onclick: move |_| { active_tab.set("0"); },
                    "组件"
                }

                dioxus_router::components::Link {
                    to: Route::SystemOverview {},
                    class: if *active_tab.read() == "1" {
                        "top-nav-tab-active"
                    } else {
                        "top-nav-tab"
                    },
                    onclick: move |_| { active_tab.set("1"); },
                    "系统"
                }

                dioxus_router::components::Link {
                    to: Route::DemosOverview {},
                    class: if *active_tab.read() == "2" {
                        "top-nav-tab-active"
                    } else {
                        "top-nav-tab"
                    },
                    onclick: move |_| { active_tab.set("2"); },
                    "案例"
                }
            }
        }
    }
}
