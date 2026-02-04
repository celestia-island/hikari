// hikari-components/src/layout/aside.rs
//! Aside component - Modern sidebar navigation panel
//!
//! Inspired by Element Plus and Material Navigation Drawer designs.
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::Aside;
//! use dioxus::prelude::*;
//!
//! rsx! {
//!     Aside {
//!         header: rsx! {
//!             h2 { "Menu" }
//!         },
//!         nav {
//!             a { "Link 1" }
//!             a { "Link 2" }
//!         },
//!         footer: rsx! {
//!             Footer { "Settings" }
//!         }
//!     }
//! }
//! ```

use dioxus::prelude::*;
use palette::{classes::components::*, ClassesBuilder, UtilityClass};

/// Aside component - Modern sidebar navigation panel
///
/// # Design Features
/// - Clean, minimal design with subtle shadows
/// - Smooth slide-in/out animation on mobile
/// - Refined padding and spacing
/// - Optional close button on mobile
/// - Proper border for visual separation
///
/// # Responsive Behavior
/// - Desktop (≥1024px): Static positioning, always visible
/// - Mobile (<1024px): Fixed positioning, slides in from left
#[component]
pub fn Aside(
    /// Sidebar content
    children: Element,

    /// Header content (optional)
    #[props(optional)]
    header: Option<Element>,

    /// Footer content (optional)
    #[props(optional)]
    footer: Option<Element>,

    /// Width preset (sm: 200px, md: 250px, lg: 300px, default: md)
    #[props(default = "md".to_string())]
    width: String,

    /// Background variant (default, white, light)
    #[props(default = "white".to_string())]
    variant: String,

    /// Whether to be collapsible on mobile
    #[props(default = true)]
    collapsible: bool,

    /// Initial open state for mobile
    #[props(default = false)]
    initial_open: bool,

    /// Callback when close button is clicked (mobile)
    on_close: EventHandler,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    let is_open = use_signal(|| initial_open);

    // Get width classes
    let width_class = match width.as_str() {
        "sm" => AsideClass::Sm,
        "lg" => AsideClass::Lg,
        _ => AsideClass::Md, // md (default)
    };

    // Get variant-specific styles
    let variant_class = match variant.as_str() {
        "light" => AsideClass::Light,
        _ => AsideClass::Dark,
    };

    let mut builder = ClassesBuilder::new()
        .add(AsideClass::Aside)
        .add(AsideClass::Drawer)
        .add(width_class)
        .add(variant_class);

    // Add drawer-open state class if open
    if *is_open.read() {
        builder = builder.add(AsideClass::DrawerOpen);
    }

    let classes = builder.add_raw(&class).build();
    let content_class = AsideClass::Content.as_class();
    let header_class = "hi-layout-aside-header".to_string();
    let footer_class = "hi-layout-aside-footer".to_string();

    rsx! {
        aside {
            // Responsive drawer classes:
            // - Desktop (lg): static positioning, always visible
            // - Mobile: fixed positioning, slide in/out based on is_open
            class: "{classes}",

            // Sidebar header (if provided)
            if let Some(header_content) = header {
                div { class: "{header_class}", {header_content} }
            }

            // Sidebar content with scroll support
            div {
                class: "{content_class}",
                { children }
            }

            // Sidebar footer (if provided)
            if let Some(footer_content) = footer {
                div { class: "{footer_class}", {footer_content} }
            }
        }
    }
}
