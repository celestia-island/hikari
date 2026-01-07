// demo-app/src/components/sidebar.rs
// Modern sidebar navigation with refined styling

use dioxus::prelude::*;
use dioxus_router::components::Link;
use icons::{Icon, LucideIcon};

use crate::app::Route;

/// Sidebar component - Modern navigation content for Aside
///
/// This component provides the navigation content that goes inside
/// the hikari-components Aside component with premium styling.
#[component]
pub fn Sidebar(current_route: Route) -> Element {
    let is_active_route = |route: &Route| -> bool {
        std::mem::discriminant(&current_route) == std::mem::discriminant(route)
    };

    rsx! {
        // Logo and title
        div {
            class: "sidebar-header",
            img {
                class: "sidebar-logo",
                src: "/images/logo.png",
                alt: "Hikari Logo",
            }
            div {
                class: "sidebar-title-group",
                h1 {
                    class: "sidebar-title",
                    "Hikari UI"
                }
                span {
                    class: "sidebar-subtitle",
                    "Component Library"
                }
            }
        }

        // Navigation
        div {
            class: "sidebar-nav",

            NavGroup {
                title: "Overview",
                children: rsx! {
                    NavItem {
                        to: Route::Home {},
                        is_active: is_active_route(&Route::Home {}),
                        icon: "home",
                        label: "Home"
                    }
                }
            }

            NavGroup {
                title: "Components",
                children: rsx! {
                    NavItem {
                        to: Route::ComponentsOverview {},
                        is_active: is_active_route(&Route::ComponentsOverview {}),
                        icon: "layers",
                        label: "All Components"
                    }
                    NavSubItem {
                        to: Route::ComponentsBasic {},
                        is_active: is_active_route(&Route::ComponentsBasic {}),
                        label: "Basic"
                    }
                    NavSubItem {
                        to: Route::ComponentsFeedback {},
                        is_active: is_active_route(&Route::ComponentsFeedback {}),
                        label: "Feedback"
                    }
                    NavSubItem {
                        to: Route::ComponentsNavigation {},
                        is_active: is_active_route(&Route::ComponentsNavigation {}),
                        label: "Navigation"
                    }
                    NavSubItem {
                        to: Route::ComponentsData {},
                        is_active: is_active_route(&Route::ComponentsData {}),
                        label: "Data"
                    }
                }
            }

            NavGroup {
                title: "System",
                children: rsx! {
                    NavItem {
                        to: Route::SystemOverview {},
                        is_active: is_active_route(&Route::SystemOverview {}),
                        icon: "settings",
                        label: "All Systems"
                    }
                    NavSubItem {
                        to: Route::SystemCSS {},
                        is_active: is_active_route(&Route::SystemCSS {}),
                        label: "CSS Utilities"
                    }
                    NavSubItem {
                        to: Route::SystemIcons {},
                        is_active: is_active_route(&Route::SystemIcons {}),
                        label: "Icons"
                    }
                    NavSubItem {
                        to: Route::SystemPalette {},
                        is_active: is_active_route(&Route::SystemPalette {}),
                        label: "Palette"
                    }
                    NavSubItem {
                        to: Route::SystemAnimations {},
                        is_active: is_active_route(&Route::SystemAnimations {}),
                        label: "Animations"
                    }
                }
            }

            NavGroup {
                title: "Demos",
                children: rsx! {
                    NavItem {
                        to: Route::DemosOverview {},
                        is_active: is_active_route(&Route::DemosOverview {}),
                        icon: "sparkles",
                        label: "All Demos"
                    }
                }
            }
        }

        // Footer
        div {
            class: "sidebar-footer",
            div {
                class: "sidebar-footer-content",
                div {
                    class: "sidebar-footer-text",
                    span { "🔗" }
                    span { "Version 0.1.0" }
                }
            }
        }
    }
}

/// Navigation group with refined styling
#[component]
fn NavGroup(title: String, children: Element) -> Element {
    rsx! {
        div {
            class: "nav-group",
            div {
                class: "nav-group-title",
                "{title}"
            }
            { children }
        }
    }
}

/// Navigation item with icon and refined hover effects
#[component]
fn NavItem(
    to: Route,
    is_active: bool,
    icon: String,
    label: String,
) -> Element {
    let lucide_icon = map_icon_name(&icon);

    rsx! {
        Link {
            to: to,
            class: format!(
                "nav-item {}",
                if is_active { "nav-item-active" } else { "" }
            ),

            // Icon with refined styling
            div {
                class: "nav-item-icon",
                Icon {
                    icon: lucide_icon,
                    size: 20
                }
            }

            span {
                class: "nav-item-label",
                "{label}"
            }
        }
    }
}

/// Navigation sub-item with refined styling
#[component]
fn NavSubItem(
    to: Route,
    is_active: bool,
    label: String,
) -> Element {
    rsx! {
        Link {
            to: to,
            class: format!(
                "nav-subitem {}",
                if is_active { "nav-subitem-active" } else { "" }
            ),

            span {
                class: "nav-item-label",
                "{label}"
            }
        }
    }
}

/// Map icon name to LucideIcon
///
/// Note: Some icons may not be available in the current generated set (A-C only).
/// This function provides fallbacks to available icons.
fn map_icon_name(icon: &str) -> LucideIcon {
    match icon {
        "home" => LucideIcon::award, // Using award as home alternative (A-C icons only)
        "layers" => LucideIcon::component, // Using component as layers alternative
        "settings" => LucideIcon::cog, // Cog is available
        "sparkles" => LucideIcon::circle_star, // Circle star is available
        _ => LucideIcon::badge, // Fallback to badge
    }
}
