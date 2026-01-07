// hikari-components/src/layout/layout.rs
//! Layout component - Modern application layout wrapper
//!
//! Inspired by Material UI and Element Plus design systems.
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::{Layout, Header, Aside};
//! use dioxus::prelude::*;
//!
//! rsx! {
//!     Layout {
//!         header: rsx! {
//!             Header {
//!                 h1 { "My App" }
//!             }
//!         },
//!         aside: rsx! {
//!             Aside {
//!                 nav {
//!                     a { "Link 1" }
//!                     a { "Link 2" }
//!                 }
//!             }
//!         },
//!         h1 { "Main content" }
//!     }
//! }
//! ```

use dioxus::prelude::*;

/// Layout component - Modern application layout wrapper
///
/// # Design Philosophy
/// - Clean, minimal structure with refined shadows and borders
/// - Smooth transitions and micro-interactions
/// - Responsive by design with mobile-first approach
/// - Glass morphism effects for modern feel
///
/// # Features
/// - Responsive sidebar with backdrop overlay on mobile
/// - Optional glassmorphism header
/// - Smooth slide-in/out animations
/// - Proper z-index layering
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

    /// Whether to use glassmorphism effects (default: true)
    #[props(default = true)]
    glassmorphism: bool,

    /// Background color (default: subtle gray)
    #[props(default = "#f8fafc".to_string())]
    background_color: String,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    let mut is_drawer_open = use_signal(|| false);

    rsx! {
        div {
            class: format!(
                "hi-layout hi-layout-light {} {}",
                if aside.is_some() { "hi-layout-has-sidebar" } else { "" },
                class,
            ),

            // Header (if provided) - full width at top
            if let Some(header_content) = header {
                {header_content}
            }

            // Body container with Aside and Main
            div { class: "hi-layout-body",

                // Mobile overlay (backdrop) with blur effect
                if aside.is_some() {
                    div {
                        class: if *is_drawer_open.read() { "hi-layout-overlay-open" } else { "" },
                        onclick: move |_| is_drawer_open.set(false),
                    }
                }

                // Sidebar (if provided)
                if let Some(ref aside_content) = aside {
                    {aside_content}
                }

                // Main content area
                div { class: "hi-layout-main",

                    // Main content with refined scroll
                    main { class: "hi-layout-content", {children} }
                }
            }
        }
    }
}
