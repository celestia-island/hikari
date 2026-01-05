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
                "fixed lg:static inset-y-0 left-0 z-50 w-64 \
                 bg-[#1a1a2e] text-white p-5 flex flex-col gap-2 \
                 transition-transform duration-300 ease-in-out \
                 {}",
                if is_open { "translate-x-0" } else { "-translate-x-full lg:translate-x-0" }
            ),

            // Close button (mobile only)
            button {
                class: "lg:hidden self-end p-2 hover:bg-white/10 rounded transition-colors",
                onclick: move |_| on_close.call(()),
                "✕"
            }

            // Title
            h2 { class: "hidden lg:block text-2xl text-[#4a9eff] mb-5 font-semibold", "Hikari Demo" }

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
        div { class: "mb-4",
            div { class: "px-4 py-2 text-sm font-semibold text-gray-400 uppercase tracking-wider",
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
