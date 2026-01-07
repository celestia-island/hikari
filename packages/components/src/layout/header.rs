// hikari-components/src/layout/header.rs
//! Header component - Modern application header bar
//!
//! Inspired by Element Plus and Material App Bar designs.
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::Header;
//! use dioxus::prelude::*;
//!
//! rsx! {
//!     Header {
//!         h1 { "My Application" }
//!     }
//! }
//! ```

use dioxus::prelude::*;

/// Header component - Modern application header bar
///
/// # Design Features
/// - Glassmorphism effect with backdrop blur
/// - Subtle border for visual separation
/// - Smooth elevation shadow
/// - Refined spacing and typography
///
/// # Elevation System
/// - Default: elevation-1 (subtle shadow)
/// - Can be customized with elevation prop
#[component]
pub fn Header(
    /// Header content
    children: Element,

    /// Border bottom (default: true)
    #[props(default = true)]
    bordered: bool,

    /// Whether to show mobile menu toggle button
    #[props(default = false)]
    show_menu_toggle: bool,

    /// Callback when menu toggle is clicked
    on_menu_toggle: EventHandler,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    rsx! {
        header {
            class: format!(
                "hi-header hi-header-sticky hi-header-md {} {class}",
                if bordered { "" } else { "hi-header-transparent" },
            ),

            // Left section: Menu toggle + optional content
            div {
                class: "hi-header-left",

                // Menu toggle button (mobile)
                if show_menu_toggle {
                    button {
                        class: "hi-header-toggle",
                        onclick: move |_| on_menu_toggle.call(()),
                        "aria-label": "Toggle menu",

                        // Menu icon (hamburger)
                        svg {
                            xmlns: "http://www.w3.org/2000/svg",
                            fill: "none",
                            view_box: "0 0 24 24",
                            stroke: "currentColor",
                            stroke_width: "2",
                            stroke_linecap: "round",
                            stroke_linejoin: "round",
                            path { d: "M4 6h16M4 12h16M4 18h16" }
                        }
                    }
                }

                // Header content
                div {
                    class: "flex items-center gap-3 min-w-0 flex-shrink-0",
                    { children }
                }
            }

            // Right section (optional actions)
            div {
                class: "hi-header-right",
                // Placeholder for right-side content
                // Can be used for user menu, notifications, etc.
            }
        }
    }
}
