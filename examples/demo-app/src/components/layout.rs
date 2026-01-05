// demo-app/src/components/layout.rs
// Layout component with responsive drawer

use dioxus::prelude::*;
use icons::{Icon, LucideIcon};

use crate::{app::Route, components::Sidebar};

/// Layout component that wraps all pages with a responsive sidebar
///
/// # Features
/// - Desktop: Fixed sidebar (250px wide)
/// - Mobile: Collapsible drawer with hamburger menu
/// - Overlay background when drawer is open on mobile
#[component]
pub fn Layout(children: Element, current_route: Route) -> Element {
    let mut is_drawer_open = use_signal(|| false);

    rsx! {
        div { class: "hi-flex hi-h-screen hi-font-sans hi-overflow-hidden",

            // Mobile overlay (backdrop)
            div {
                class: if *is_drawer_open.read() {
                    "hi-fixed hi-inset-0 hi-bg-black/50 hi-z-40 hi-lg:hidden"
                } else {
                    "hi-hidden"
                },
                onclick: move |_| is_drawer_open.set(false)
            }

            // Sidebar (responsive drawer)
            Sidebar {
                current_route: current_route.clone(),
                is_open: *is_drawer_open.read(),
                on_close: move |_| is_drawer_open.set(false)
            }

            // Main content area
            div { class: "hi-flex-1 hi-flex hi-flex-col hi-overflow-hidden lg:ml-0",

                // Mobile header with hamburger menu
                header {
                    class: "lg:hidden hi-flex hi-items-center hi-justify-between hi-p-4 hi-bg-dark-theme hi-text-white",

                    button {
                        class: "hi-p-2 hi-rounded-lg hi-hover:bg-white/10 hi-transition-colors",
                        onclick: move |_| is_drawer_open.toggle(),
                        Icon {
                            icon: LucideIcon::align_horizontal_justify_start,
                            class: "hi-w-6 hi-h-6".to_string()
                        }
                    }

                    h2 { class: "hi-text-xl hi-text-primary-light hi-font-semibold", "Hikari Demo" }
                }

                // Main content
                main {
                    class: "hi-flex-1 hi-overflow-y-auto hi-p-6 lg:p-10 hi-bg-light-theme",
                    { children }
                }
            }
        }
    }
}
