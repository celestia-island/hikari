// demo-app/src/components/layout.rs
// Layout component using modernized Hikari components

extern crate components as hikari_components;

use dioxus::prelude::*;
use dioxus_router::components::Link;
use icons::{Icon, LucideIcon};

use crate::{app::Route, components::Sidebar};
use components::layout::{Aside, Header, Layout as HikariLayout};

/// Layout component that wraps all pages with modern design
///
/// This is a demo-app specific wrapper around hikari-components Layout
/// that adds custom navigation, breadcrumbs, and routing logic.
#[component]
pub fn Layout(children: Element, current_route: Route) -> Element {
    let mut is_drawer_open = use_signal(|| false);

    rsx! {
        HikariLayout {
            header: rsx! {
                Header {
                    show_menu_toggle: true,
                    on_menu_toggle: move |_| is_drawer_open.toggle(),
                    bordered: true,

                // Logo and title


                    // Right side: navigation tabs
                    div { class: "layout-header-left",
                        img {
                            class: "layout-header-logo",
                            src: "/images/logo.png",
                            alt: "Hikari Logo",
                        }
                        h2 { class: "layout-header-title", "Hikari UI" }
                    }

                    div { class: "layout-header-nav",
                        NavTab {
                            to: Route::ComponentsOverview {},
                            current_route: current_route.clone(),
                            is_components: true,
                            label: "组件",
                        }
                        NavTab {
                            to: Route::SystemOverview {},
                            current_route: current_route.clone(),
                            is_system: true,
                            label: "系统",
                        }
                        NavTab {
                            to: Route::DemosOverview {},
                            current_route: current_route.clone(),
                            label: "案例",
                        }
                    }
                }
            },

            aside: rsx! {
                Aside {
                    width: "lg".to_string(),
                    variant: "light".to_string(),
                    initial_open: *is_drawer_open.read(),
                    on_close: move |_| is_drawer_open.set(false),


                    Sidebar { current_route: current_route.clone() }
                }
            },

            // Breadcrumb navigation
            div { class: "breadcrumb-nav",
                BreadcrumbNav { current_route: current_route.clone() }
            }

            // Main content
            div { class: "page-content", {children} }
        }
    }
}

/// Navigation tab button with refined styling
#[component]
fn NavTab(
    to: Route,
    current_route: Route,
    label: String,
    #[props(optional)] is_components: bool,
    #[props(optional)] is_system: bool,
) -> Element {
    let is_active = if is_components {
        matches_route(&current_route, Route::ComponentsOverview {})
            || matches_route(&current_route, Route::ComponentsBasic {})
            || matches_route(&current_route, Route::ComponentsFeedback {})
            || matches_route(&current_route, Route::ComponentsNavigation {})
            || matches_route(&current_route, Route::ComponentsData {})
    } else if is_system {
        matches_route(&current_route, Route::SystemOverview {})
            || matches_route(&current_route, Route::SystemCSS {})
            || matches_route(&current_route, Route::SystemIcons {})
            || matches_route(&current_route, Route::SystemPalette {})
            || matches_route(&current_route, Route::SystemAnimations {})
    } else {
        std::mem::discriminant(&current_route) == std::mem::discriminant(&to)
    };

    rsx! {
        Link {
            to,
            class: format!(
                "layout-header-nav-tab {}",
                if is_active { "layout-header-nav-tab-active" } else { "" },
            ),
            "{label}"
        }
    }
}

/// Breadcrumb navigation component with refined styling
#[component]
fn BreadcrumbNav(current_route: Route) -> Element {
    let breadcrumb_items = get_breadcrumb_items(&current_route);

    rsx! {
        nav { class: "breadcrumb-nav",

            // Home link with refined styling
            Link { to: Route::Home {}, class: "breadcrumb-link",
                Icon { icon: LucideIcon::award, size: 16 }
            }

            // Breadcrumb items with refined separators
            for (i , item) in breadcrumb_items.iter().enumerate() {
                // Refined separator icon
                div { class: "breadcrumb-separator",
                    Icon { icon: LucideIcon::chevron_right, size: 16 }
                }

                // Item
                if i == breadcrumb_items.len() - 1 {
                    // Current page (not a link)
                    span { class: "breadcrumb-item breadcrumb-item-current", "{item.label}" }
                } else if let Some(route) = &item.route {
                    // Clickable link
                    Link { to: route.clone(), class: "breadcrumb-item", "{item.label}" }
                } else {
                    span { class: "breadcrumb-item breadcrumb-item-disabled", "{item.label}" }
                }
            }
        }
    }
}

/// Breadcrumb item structure
struct BreadcrumbItem {
    label: String,
    route: Option<Route>,
}

/// Get breadcrumb items for a given route
fn get_breadcrumb_items(route: &Route) -> Vec<BreadcrumbItem> {
    match route {
        Route::Home {} => vec![BreadcrumbItem {
            label: "Home".to_string(),
            route: None,
        }],

        Route::ComponentsOverview {} => vec![
            BreadcrumbItem {
                label: "Components".to_string(),
                route: Some(Route::ComponentsOverview {}),
            },
            BreadcrumbItem {
                label: "Overview".to_string(),
                route: None,
            },
        ],

        Route::ComponentsBasic {} => vec![
            BreadcrumbItem {
                label: "Components".to_string(),
                route: Some(Route::ComponentsOverview {}),
            },
            BreadcrumbItem {
                label: "Basic".to_string(),
                route: None,
            },
        ],

        Route::ComponentsFeedback {} => vec![
            BreadcrumbItem {
                label: "Components".to_string(),
                route: Some(Route::ComponentsOverview {}),
            },
            BreadcrumbItem {
                label: "Feedback".to_string(),
                route: None,
            },
        ],

        Route::ComponentsNavigation {} => vec![
            BreadcrumbItem {
                label: "Components".to_string(),
                route: Some(Route::ComponentsOverview {}),
            },
            BreadcrumbItem {
                label: "Navigation".to_string(),
                route: None,
            },
        ],

        Route::ComponentsData {} => vec![
            BreadcrumbItem {
                label: "Components".to_string(),
                route: Some(Route::ComponentsOverview {}),
            },
            BreadcrumbItem {
                label: "Data".to_string(),
                route: None,
            },
        ],

        Route::SystemOverview {} => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {}),
            },
            BreadcrumbItem {
                label: "Overview".to_string(),
                route: None,
            },
        ],

        Route::SystemCSS {} => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {}),
            },
            BreadcrumbItem {
                label: "CSS Utilities".to_string(),
                route: None,
            },
        ],

        Route::SystemIcons {} => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {}),
            },
            BreadcrumbItem {
                label: "Icons".to_string(),
                route: None,
            },
        ],

        Route::SystemPalette {} => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {}),
            },
            BreadcrumbItem {
                label: "Palette".to_string(),
                route: None,
            },
        ],

        Route::SystemAnimations {} => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {}),
            },
            BreadcrumbItem {
                label: "Animations".to_string(),
                route: None,
            },
        ],

        Route::DemosOverview {} => vec![
            BreadcrumbItem {
                label: "Demos".to_string(),
                route: Some(Route::DemosOverview {}),
            },
            BreadcrumbItem {
                label: "Overview".to_string(),
                route: None,
            },
        ],
    }
}

/// Helper function to check if current route matches a target route
fn matches_route(current: &Route, target: Route) -> bool {
    std::mem::discriminant(current) == std::mem::discriminant(&target)
}
