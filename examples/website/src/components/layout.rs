// website/src/components/layout.rs
// Layout component using modernized Hikari components

use dioxus::prelude::*;
use dioxus_router::components::Link;

use super::sidebar::Sidebar;
use crate::app::{Route, ThemeContext};
use _components::{
    basic::{Background, Button, ButtonVariant, Logo},
    layout::{Aside, Header, Layout as HikariLayout},
};
use _icons::{Icon, MdiIcon};
use _palette::classes::{
    AlignItems, BgColor, BorderRadius, ClassesBuilder, Cursor, Display, Duration, Flex, FontSize,
    FontWeight, Gap, Height, JustifyContent, Margin, Padding, TextColor, Transition, Width,
};

/// Layout component that wraps all pages with modern design
///
/// This is a website specific wrapper around hikari-components Layout
/// that adds custom navigation, breadcrumbs, and routing logic.
#[component]
pub fn Layout(children: Element, current_route: Route) -> Element {
    let mut is_drawer_open = use_signal(|| false);

    // Consume theme context
    let mut theme_context = use_context::<ThemeContext>();

    // Compute current icon based on theme
    // Use use_memo to automatically track theme changes
    let current_icon = use_memo(move || {
        let theme = theme_context.theme.read();
        if theme.as_str() == "hikari" {
            MdiIcon::WhiteBalanceSunny
        } else {
            MdiIcon::MoonWaningCrescent
        }
    });

    // Create a reactive key that changes when the theme/icon changes
    // This forces the Button component to be destroyed and recreated
    let icon_key = use_memo(move || format!("{:?}", current_icon.read()));

    rsx! {
        Background { div { class: "layout-container",
        HikariLayout {
            header: rsx! {
                Header {
                    show_menu_toggle: true,
                    on_menu_toggle: move |_| is_drawer_open.toggle(),
                    bordered: true,

                    right_content: rsx! {
                        Button {
                            key: "{icon_key}",
                            variant: ButtonVariant::Ghost,
                            icon: rsx! {
                                Icon {
                                    icon: *current_icon.read(),
                                    size: 20,
                                }
                            },
                            onclick: move |_| {
                                let current = theme_context.theme.read().clone();
                                let new_theme = if current.as_str() == "hikari" { "tairitsu" } else { "hikari" };
                                theme_context.theme.set(new_theme.to_string());
                            }
                        }
                    },

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


                    Sidebar { current_route: current_route.clone() }
                }
            },

            // Breadcrumb navigation
            div { class: ClassesBuilder::new().add(Padding::P4).build(),
                BreadcrumbNav { current_route: current_route.clone() }
            }

            // Main content
            div { class: ClassesBuilder::new().add(Padding::P6).build(), {children} }
        }
        } }
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
                        .add(TextColor::Secondary)
                        .add(Transition::Colors)
                        .add(Duration::D150)
                        .build(),
                    Icon { icon: MdiIcon::TrophyAward, size: 16 }
                }

                // Breadcrumb items with separators
                for (i , item) in breadcrumb_items.iter().enumerate() {
                    // Separator icon
                    div { class: ClassesBuilder::new().add(TextColor::Muted).build(),
                        Icon { icon: MdiIcon::ChevronRight, size: 16 }
                    }

                    // Item
                if i == breadcrumb_items.len() - 1 {
                    // Current page (not a link)
                    span { class: ClassesBuilder::new().add(TextColor::Primary).add(FontWeight::Medium).build(),
                        "{item.label}"
                    }
                } else if let Some(route) = &item.route {
                    // Clickable link
                    Link {
                        to: route.clone(),
                        class: ClassesBuilder::new()
                            .add(TextColor::Secondary)
                            .add(Transition::Colors)
                            .add(Duration::D150)
                            .build(),
                        "{item.label}"
                    }
                } else {
                    span { class: ClassesBuilder::new().add(TextColor::Muted).build(),
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

/// Helper function to match routes
fn matches_route(route: &Route, target: Route) -> bool {
    std::mem::discriminant(route) == std::mem::discriminant(&target)
}
