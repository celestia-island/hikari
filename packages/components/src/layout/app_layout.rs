// hikari-components/src/layout/app_layout.rs
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
//!         footer: rsx! {
//!             Footer {
//!                 "© 2026 Hikari UI"
//!             }
//!         },
//!         h1 { "Main content" }
//!     }
//! }
//! ```

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, components::Layout as LayoutClass};

use crate::basic::Background;

/// Layout component - Modern application layout wrapper
///
/// # Design Philosophy
/// - Clean, minimal structure with refined shadows and borders
/// - Smooth transitions and micro-interactions
/// - Responsive by design with mobile-first approach
/// - Glass morphism effects for modern feel
///
/// # Features
/// - Global gradient background (via Background component)
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

    /// Footer content
    #[props(optional)]
    footer: Option<Element>,

    /// Main content
    children: Element,

    /// Whether to use glassmorphism effects (default: true)
    #[props(default = true)]
    glassmorphism: bool,

    /// Background color (default: uses theme background variable)
    #[props(default = "var(--hi-background, #f8fafc)".to_string())]
    background_color: String,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    let mut is_drawer_open = use_signal(|| false);

    let layout_classes = ClassesBuilder::new()
        .add(LayoutClass::Layout)
        .add(LayoutClass::Light)
        .add_if(LayoutClass::HasSidebar, || aside.is_some())
        .add_raw(&class)
        .build();

    let overlay_classes = ClassesBuilder::new()
        .add_if(LayoutClass::OverlayOpen, || *is_drawer_open.read())
        .build();

    rsx! {
        // Global gradient background (fixed, behind everything)
        Background {}

        div {
            class: "{layout_classes}",

            // Header (if provided) - full width at top
            if let Some(header_content) = header {
                {header_content}
            }

            // Body container with Aside and Main
            div { class: "hi-layout-body",

                // Mobile overlay (backdrop) with blur effect
                if aside.is_some() {
                    div {
                        class: "{overlay_classes}",
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

            // Footer (if provided) - full width at bottom
            if let Some(footer_content) = footer {
                {footer_content}
            }
        }
    }
}
