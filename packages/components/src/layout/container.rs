// hikari-components/src/layout/container.rs
//! Container component - Responsive content container with centered layout
//!
//! # Example
//!
//! ```rust
//! use hikari_components::layout::Container;
//! use dioxus::prelude::*;
//!
//! rsx! {
//!     Container {
//!         h1 { "Content is centered and max-width constrained" }
//!     }
//! }
//! ```

use dioxus::prelude::*;

/// Container component - Responsive content container
///
/// Provides a centered container with responsive max-width constraints.
/// Perfect for main content areas.
///
/// # Features
/// - Responsive max-width (sm/md/lg/xl breakpoints)
/// - Centered layout with auto margins
/// - Optional padding control
/// - Clean, minimal design
#[component]
pub fn Container(
    /// Container content
    children: Element,

    /// Max width preset (sm: 640px, md: 768px, lg: 1024px, xl: 1280px, default: lg)
    #[props(default = "lg".to_string())]
    max_width: String,

    /// Custom CSS classes
    #[props(default)]
    class: String,

    /// Custom inline styles
    #[props(default)]
    style: String,
) -> Element {
    let max_width_class = match max_width.as_str() {
        "sm" => "hi-container-sm",
        "xl" => "hi-container-xl",
        "xxl" => "hi-container-xxl",
        _ => "hi-container-lg", // lg (default)
    };

    rsx! {
        div {
            class: format!("hi-container {max_width_class} {class}"),
            style: "{style}",
            { children }
        }
    }
}
