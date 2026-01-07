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
//!         nav {
//!             a { "Link 1" }
//!             a { "Link 2" }
//!         }
//!     }
//! }
//! ```

use dioxus::prelude::*;

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
        "sm" => "hi-aside-sm",
        "lg" => "hi-aside-lg",
        _ => "hi-aside-md", // md (default)
    };

    // Get variant-specific styles
    let variant_class = match variant.as_str() {
        "light" => "hi-aside-light",
        _ => "hi-aside-dark",
    };

    rsx! {
        aside {
            // Responsive drawer classes:
            // - Desktop (lg): static positioning, always visible
            // - Mobile: fixed positioning, slide in/out based on is_open
            class: format!(
                "hi-aside hi-aside-drawer {} {} {} {}",
                width_class,
                variant_class,
                if *is_open.read() {
                    "hi-aside-drawer-open"
                } else {
                    ""
                },
                class
            ),

            // Sidebar content with scroll support
            div {
                class: "hi-aside-content",
                { children }
            }
        }
    }
}
