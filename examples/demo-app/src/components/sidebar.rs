// demo-app/src/components/sidebar.rs
// Sidebar navigation component with responsive drawer

use dioxus::prelude::*;
use dioxus_router::components::Link;
use crate::app::Route;
use hikari_icons::{Icon, LucideIcon};

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
            // Responsive drawer classes:
            // - Desktop (lg): static positioning, always visible
            // - Mobile: fixed positioning, slide in/out based on is_open
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
                Icon {
                    icon: LucideIcon::cross,
                    class: "w-5 h-5".to_string()
                }
            }

            // Title (desktop only, hidden on mobile header)
            h2 { class: "hidden lg:block text-2xl text-[#4a9eff] mb-5 font-semibold", "Hikari Demo" }

            // Navigation links
            NavLink {
                to: Route::Home {},
                is_active: is_active(&Route::Home {}),
                on_close: on_close,
                "Home"
            }
            NavLink {
                to: Route::BasicComponents {},
                is_active: is_active(&Route::BasicComponents {}),
                on_close: on_close,
                "Basic Components"
            }
            NavLink {
                to: Route::FeedbackComponents {},
                is_active: is_active(&Route::FeedbackComponents {}),
                on_close: on_close,
                "Feedback Components"
            }
            NavLink {
                to: Route::NavigationComponents {},
                is_active: is_active(&Route::NavigationComponents {}),
                on_close: on_close,
                "Navigation Components"
            }
            NavLink {
                to: Route::DataComponents {},
                is_active: is_active(&Route::DataComponents {}),
                on_close: on_close,
                "Data Components"
            }
        }
    }
}

/// Navigation link component with active state styling
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
                // Close drawer on mobile when navigating
                on_close.call(());
            },
            { children }
        }
    }
}
