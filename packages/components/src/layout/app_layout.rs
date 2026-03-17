// hikari-components/src/layout/app_layout.rs
//! Layout component - Modern application layout wrapper
//!
//! Inspired by Material UI and Element Plus design systems.
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::{Layout, Header, Aside};
//! use crate::prelude::*;
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

use crate::prelude::*;
use hikari_palette::classes::{
    AppLayoutClass, ClassesBuilder, UtilityClass, components::Layout as LayoutClass,
};

use crate::basic::Background;

///
///
#[component]
pub fn Layout(
    #[props(optional)]
    header: Option<Element>,

    #[props(optional)]
    aside: Option<Element>,

    #[props(optional)]
    footer: Option<Element>,

    children: Element,

    #[props(default = true)]
    glassmorphism: bool,

    #[props(default = "var(--hi-background, #f8fafc)".to_string())]
    background_color: String,

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
        .add_if(LayoutClass::OverlayOpen, || is_drawer_open.read())
        .build();

    rsx! {
        // Global gradient background (fixed, behind everything)
        Background {}

        div {
            class: layout_classes,

            // Header (if provided) - full width at top
            if let Some(header_content) = header {
                {header_content}
            }

            // Body container with Aside and Main
            div { class: AppLayoutClass::Body.as_class(),

                // Mobile overlay (backdrop) with blur effect
                if aside.is_some() {
                    div {
                        class: overlay_classes,
                        onclick: move |_| is_drawer_open.set(false),
                    }
                }

                // Sidebar (if provided)
                if let Some(ref aside_content) = aside {
                    {aside_content.clone()}
                }

                // Main content area
                div { class: AppLayoutClass::Main.as_class(),

                    // Main content with refined scroll
                    main { class: AppLayoutClass::Content.as_class(), {children} }
                }
            }

            // Footer (if provided) - full width at bottom
            if let Some(footer_content) = footer {
                {footer_content}
            }
        }
    }
}
