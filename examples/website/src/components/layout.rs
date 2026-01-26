// website/src/components/layout.rs
// Layout component using modernized Hikari components

use dioxus::prelude::*;
use dioxus_router::components::Link;

use super::{sidebar::Sidebar, AsideFooter};
use crate::app::Route;
use _components::{
    basic::Logo,
    layout::{Aside, Header, Layout as HikariLayout},
};
use _palette::classes::{AlignItems, ClassesBuilder, Display, FontWeight, Gap, Padding};

/// Layout component that wraps all pages with modern design
///
/// This is a website specific wrapper around hikari-components Layout
/// that adds custom navigation, breadcrumbs, and routing logic.
#[component]
pub fn Layout(children: Element, #[allow(unused_variables)] current_route: Route) -> Element {
    let mut is_drawer_open = use_signal(|| false);

    // Get current route from router (ignore passed prop)
    let current_route = use_route::<Route>();

    rsx! {
        HikariLayout {
            header: rsx! {
                Header {
                    show_menu_toggle: true,
                    on_menu_toggle: move |_| is_drawer_open.toggle(),
                    bordered: true,

                    Logo {
                        src: "/images/logo.png".to_string(),
                        alt: "Hikari Logo".to_string(),
                        height: 36,
                        max_width: 140,
                    }
                }
            },

            aside: rsx! {
                Aside {
                    width: "lg".to_string(),
                    variant: "light".to_string(),
                    initial_open: *is_drawer_open.read(),
                    on_close: move |_| is_drawer_open.set(false),
                    footer: rsx! {
                        AsideFooter {}
                    },

                    Sidebar { current_route: current_route.clone() }
                }
            },

            // Breadcrumb navigation (before content)
            div { class: ClassesBuilder::new().add(Padding::P4).build(),
                BreadcrumbNav { current_route }
            }

            {children}
        }
    }
}

/// Breadcrumb navigation component with refined styling
#[component]
fn BreadcrumbNav(current_route: Route) -> Element {
    let breadcrumb_items = get_breadcrumb_items(&current_route);

    rsx! {
        nav {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(AlignItems::Center)
                .add(Gap::Gap2)
                .build(),

            // Home link
            Link {
                to: Route::Home {},
                class: ClassesBuilder::new()
                    .add_raw("hi-text-secondary")
                    .add_raw("hi-transition-colors")
                    .add_raw("hi-duration-150")
                    .add(Display::Flex)
                    .add(AlignItems::Center)
                    .build(),
                div { "Home" }
            }

            // Breadcrumb items with separators
            for (i, item) in breadcrumb_items.iter().enumerate() {
                // Separator
                div { class: ClassesBuilder::new().add_raw("hi-text-muted").build(),
                    "/"
                }

                // Item
                if i == breadcrumb_items.len() - 1 {
                    // Current page (not a link)
                    span { class: ClassesBuilder::new().add_raw("hi-text-primary").add(FontWeight::Medium).build(),
                        "{item.label}"
                    }
                } else if let Some(route) = &item.route {
                    // Clickable link
                    Link {
                        to: route.clone(),
                        class: ClassesBuilder::new()
                            .add_raw("hi-text-secondary")
                            .add_raw("hi-transition-colors")
                            .add_raw("hi-duration-150")
                            .build(),
                        "{item.label}"
                    }
                } else {
                    span { class: ClassesBuilder::new().add_raw("hi-text-muted").build(),
                        "{item.label}"
                    }
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
                label: "CSS".to_string(),
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

        _ => vec![],
    }
}
