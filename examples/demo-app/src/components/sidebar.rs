// demo-app/src/components/sidebar.rs
// New sidebar navigation (simplified)

use dioxus::prelude::*;
use dioxus_router::components::Link;

use crate::app::Route;

#[component]
pub fn Sidebar(
    current_route: Route,
    is_open: bool,
    on_close: EventHandler,
) -> Element {
    // Helper function to check if a route is active
    let is_active = |route: &Route| -> bool {
        std::mem::discriminant(&current_route) == std::mem::discriminant(route)
    };

    rsx! {
        aside {
            class: format!(
                "hi-fixed hi-lg:static hi-inset-y-0 hi-left-0 hi-z-50 hi-w-64 \
                 hi-bg-dark-theme hi-text-white hi-p-5 hi-flex hi-flex-col hi-gap-2 \
                 hi-transition-transform hi-duration-300 hi-ease-in-out \
                 {}",
                if is_open { "hi-translate-x-0" } else { "hi--translate-x-full hi-lg:translate-x-0" }
            ),

            // Close button (mobile only)
            button {
                class: "hi-lg:hidden hi-self-end hi-p-2 hi-hover:bg-white/10 hi-rounded hi-transition-colors",
                onclick: move |_| on_close.call(()),
                "✕"
            }

            // Title
            h2 { class: "hi-hidden hi-lg:block hi-text-2xl hi-text-primary-light hi-mb-5 hi-font-semibold", "Hikari Demo" }

            // Navigation sections
            NavSection {
                title: "Overview",
                children: rsx! {
                    NavLink {
                        to: Route::Home {},
                        is_active: is_active(&Route::Home {}),
                        on_close: on_close,
                        "Home"
                    }
                }
            }

            NavSection {
                title: "Components",
                children: rsx! {
                    NavLink {
                        to: Route::ComponentsOverview {},
                        is_active: is_active(&Route::ComponentsOverview {}),
                        on_close: on_close,
                        "All Components"
                    }
                    SubNavLink {
                        to: Route::ComponentsBasic {},
                        is_active: is_active(&Route::ComponentsBasic {}),
                        on_close: on_close,
                        "Basic"
                    }
                    SubNavLink {
                        to: Route::ComponentsFeedback {},
                        is_active: is_active(&Route::ComponentsFeedback {}),
                        on_close: on_close,
                        "Feedback"
                    }
                    SubNavLink {
                        to: Route::ComponentsNavigation {},
                        is_active: is_active(&Route::ComponentsNavigation {}),
                        on_close: on_close,
                        "Navigation"
                    }
                    SubNavLink {
                        to: Route::ComponentsData {},
                        is_active: is_active(&Route::ComponentsData {}),
                        on_close: on_close,
                        "Data"
                    }
                }
            }

            NavSection {
                title: "System",
                children: rsx! {
                    NavLink {
                        to: Route::SystemOverview {},
                        is_active: is_active(&Route::SystemOverview {}),
                        on_close: on_close,
                        "All Systems"
                    }
                    SubNavLink {
                        to: Route::SystemCSS {},
                        is_active: is_active(&Route::SystemCSS {}),
                        on_close: on_close,
                        "CSS Utilities"
                    }
                    SubNavLink {
                        to: Route::SystemIcons {},
                        is_active: is_active(&Route::SystemIcons {}),
                        on_close: on_close,
                        "Icons"
                    }
                    SubNavLink {
                        to: Route::SystemPalette {},
                        is_active: is_active(&Route::SystemPalette {}),
                        on_close: on_close,
                        "Palette"
                    }
                    SubNavLink {
                        to: Route::SystemAnimations {},
                        is_active: is_active(&Route::SystemAnimations {}),
                        on_close: on_close,
                        "Animations"
                    }
                }
            }

            NavSection {
                title: "Demos",
                children: rsx! {
                    NavLink {
                        to: Route::DemosOverview {},
                        is_active: is_active(&Route::DemosOverview {}),
                        on_close: on_close,
                        "All Demos"
                    }
                }
            }
        }
    }
}

/// Navigation section component
#[component]
fn NavSection(title: String, children: Element) -> Element {
    rsx! {
        div { class: "hi-mb-4",
            div { class: "hi-px-4 hi-py-2 hi-text-sm hi-font-semibold hi-text-gray-400 hi-uppercase hi-tracking-wider",
                {title}
            }
            { children }
        }
    }
}

/// Main navigation link component
#[component]
fn NavLink(
    to: Route,
    is_active: bool,
    on_close: EventHandler,
    children: Element,
) -> Element {
    rsx! {
        Link {
            to: to,
            class: format!(
                "block px-4 py-2.5 rounded-lg transition-all duration-200 \
                 hover:bg-white/10 active:scale-95 {}",
                if is_active {
                    "bg-white/20 font-medium shadow-lg shadow-black/20"
                } else {
                    ""
                }
            ),
            onclick: move |_| {
                on_close.call(());
            },
            { children }
        }
    }
}

/// Sub-navigation link component (indented)
#[component]
fn SubNavLink(
    to: Route,
    is_active: bool,
    on_close: EventHandler,
    children: Element,
) -> Element {
    rsx! {
        Link {
            to: to,
            class: format!(
                "block px-8 py-2 rounded-lg transition-all duration-200 \
                 hover:bg-white/10 active:scale-95 text-sm {}",
                if is_active {
                    "bg-white/20 font-medium"
                } else {
                    ""
                }
            ),
            onclick: move |_| {
                on_close.call(());
            },
            { children }
        }
    }
}
