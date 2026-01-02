// demo-app/src/components/layout.rs
// Layout component with responsive drawer

use dioxus::prelude::*;
use crate::app::Route;
use crate::components::Sidebar;
use hikari_icons::{Icon, LucideIcon};

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
        div { class: "flex h-screen font-sans overflow-hidden",

            // Mobile overlay (backdrop)
            div {
                class: if *is_drawer_open.read() {
                    "fixed inset-0 bg-black/50 z-40 lg:hidden"
                } else {
                    "hidden"
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
            div { class: "flex-1 flex flex-col overflow-hidden lg:ml-0",

                // Mobile header with hamburger menu
                header {
                    class: "lg:hidden flex items-center justify-between p-4 bg-[#1a1a2e] text-white",

                    button {
                        class: "p-2 rounded-lg hover:bg-white/10 transition-colors",
                        onclick: move |_| is_drawer_open.toggle(),
                        Icon {
                            icon: LucideIcon::align_horizontal_justify_start,
                            class: "w-6 h-6".to_string()
                        }
                    }

                    h2 { class: "text-xl text-[#4a9eff] font-semibold", "Hikari Demo" }
                }

                // Main content
                main {
                    class: "flex-1 overflow-y-auto p-6 lg:p-10 bg-[#f5f5f5]",
                    { children }
                }
            }
        }
    }
}
