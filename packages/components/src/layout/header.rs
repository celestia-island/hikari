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

use std::result::Result;

use dioxus::prelude::*;
use dioxus_core::VNode;
use palette::{classes::*, ClassesBuilder};

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

    /// Right side content (e.g., theme toggle, user menu)
    #[props(default = VNode::empty())]
    right_content: Element,
) -> Element {
    // Build utility classes for header content container
    let content_classes = ClassesBuilder::new()
        .add(Display::Flex)
        .add(AlignItems::Center)
        .add(Gap::Gap3)
        .add(MinWidth::MinW0)
        .add(Flex::Shrink0)
        .build();

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
                    class: "{content_classes}",
                    { children }
                }
            }

            // Right section (optional actions)
            div {
                class: "hi-header-right",
                { right_content }
            }
        }
    }
}
