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
#[component]
pub fn Layout(children: Element, #[allow(unused_variables)] current_route: Route) -> Element {
    let mut is_drawer_open = use_signal(|| false);
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
                        height: 32,
                        max_width: 120,
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

            div { class: ClassesBuilder::new().add(Padding::P4).build(),
                BreadcrumbNav { current_route }
            }

            {children}
        }
    }
}

/// Breadcrumb navigation component
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

            for (i, item) in breadcrumb_items.iter().enumerate() {
                div { class: ClassesBuilder::new().add_raw("hi-text-muted").build(),
                    "/"
                }

                if i == breadcrumb_items.len() - 1 {
                    span { class: ClassesBuilder::new().add_raw("hi-text-primary").add(FontWeight::Medium).build(),
                        "{item.label}"
                    }
                } else if let Some(route) = &item.route {
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

        // Layer 1 Routes
        Route::Layer1Basic {}
        | Route::Layer1Form {}
        | Route::Layer1Switch {}
        | Route::Layer1Feedback {}
        | Route::Layer1Display {}
        | Route::NumberInput {}
        | Route::Search {}
        | Route::Avatar {}
        | Route::Image {}
        | Route::Tag {}
        | Route::Empty {}
        | Route::Comment {}
        | Route::DescriptionList {} => vec![
            BreadcrumbItem {
                label: "Components".to_string(),
                route: Some(Route::ComponentsOverview {}),
            },
            BreadcrumbItem {
                label: "Layer 1".to_string(),
                route: None,
            },
        ],

        // Layer 2 Routes
        Route::Layer2Overview {}
        | Route::Layer2Navigation {}
        | Route::Layer2Data {}
        | Route::Layer2Form {}
        | Route::Layer2Feedback {}
        | Route::Cascader {}
        | Route::Transfer {}
        | Route::Collapsible {}
        | Route::Timeline {}
        | Route::Table {}
        | Route::Tree {}
        | Route::Pagination {}
        | Route::QRCode {} => vec![
            BreadcrumbItem {
                label: "Components".to_string(),
                route: Some(Route::ComponentsOverview {}),
            },
            BreadcrumbItem {
                label: "Layer 2".to_string(),
                route: None,
            },
        ],

        // Layer 3 Routes
        Route::Layer3Overview {}
        | Route::Layer3Media {}
        | Route::Layer3Editor {}
        | Route::Layer3Visualization {}
        | Route::UserGuide {}
        | Route::ZoomControls {} => vec![
            BreadcrumbItem {
                label: "Components".to_string(),
                route: Some(Route::ComponentsOverview {}),
            },
            BreadcrumbItem {
                label: "Layer 3".to_string(),
                route: None,
            },
        ],

        // System Routes
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

        Route::AnimationDemo {} => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {}),
            },
            BreadcrumbItem {
                label: "Animation Demo".to_string(),
                route: None,
            },
        ],

        Route::SystemI18n {} => vec![
            BreadcrumbItem {
                label: "System".to_string(),
                route: Some(Route::SystemOverview {}),
            },
            BreadcrumbItem {
                label: "I18n".to_string(),
                route: None,
            },
        ],

        // Demos Routes
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

        Route::FormDemo {} => vec![
            BreadcrumbItem {
                label: "Demos".to_string(),
                route: Some(Route::DemosOverview {}),
            },
            BreadcrumbItem {
                label: "Form Demo".to_string(),
                route: None,
            },
        ],

        Route::DashboardDemo {} => vec![
            BreadcrumbItem {
                label: "Demos".to_string(),
                route: Some(Route::DemosOverview {}),
            },
            BreadcrumbItem {
                label: "Dashboard Demo".to_string(),
                route: None,
            },
        ],

        Route::VideoDemo {} => vec![
            BreadcrumbItem {
                label: "Demos".to_string(),
                route: Some(Route::DemosOverview {}),
            },
            BreadcrumbItem {
                label: "Video Demo".to_string(),
                route: None,
            },
        ],

        _ => vec![],
    }
}
