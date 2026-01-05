// hikari-components/src/layout/layout.rs
//! Layout component - Main layout wrapper with responsive sidebar
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::Layout;
//! use dioxus::prelude::*;
//!
//! rsx! {
//!     Layout {
//!         header: rsx! { header { "My App" } },
//!         aside: rsx! { aside { /* sidebar content */ } },
//!         h1 { "Main content" }
//!     }
//! }
//! ```

use dioxus::prelude::*;

/// Layout component - Main application layout wrapper
///
/// # Features
/// - Responsive design (mobile drawer, desktop fixed sidebar)
/// - Optional header and sidebar
/// - Mobile overlay when drawer is open
/// - Smooth transitions and animations
#[component]
pub fn Layout(
    /// Header content
    #[props(optional)]
    header: Option<Element>,

    /// Sidebar/Aside content
    #[props(optional)]
    aside: Option<Element>,

    /// Main content
    children: Element,

    /// Whether sidebar is collapsible on mobile
    #[props(default = true)]
    collapsible: bool,

    /// Sidebar width (default: 250px)
    #[props(default = "250px".to_string())]
    sidebar_width: String,
) -> Element {
    let mut is_drawer_open = use_signal(|| false);

    rsx! {
        div { class: "flex h-screen font-sans overflow-hidden",

            // Mobile overlay (backdrop)
            if collapsible {
                div {
                    class: if *is_drawer_open.read() {
                        "fixed inset-0 bg-black/50 z-40 lg:hidden"
                    } else {
                        "hidden"
                    },
                    onclick: move |_| is_drawer_open.set(false)
                }
            }

            // Sidebar (if provided)
            if let Some(aside_content) = aside {
                {aside_content}
            }

            // Main content area
            div { class: "flex-1 flex flex-col overflow-hidden lg:ml-0",

                // Header (if provided)
                if let Some(header_content) = header {
                    {header_content}
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
