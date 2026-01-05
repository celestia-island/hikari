// hikari-components/src/layout/content.rs
//! Content component - Main content area wrapper

use dioxus::prelude::*;

/// Content component - Main content area wrapper
///
/// # Example
///
/// ```rust
/// use hikari_components::layout::Content;
/// use dioxus::prelude::*;
///
/// rsx! {
///     Content {
///         h1 { "Page Title" }
///         p { "Page content goes here..." }
///     }
/// }
/// ```
#[component]
pub fn Content(
    /// Content
    children: Element,

    /// Background color (default: #f5f5f5)
    #[props(default = "#f5f5f5".to_string())]
    background_color: String,

    /// Padding (default: p-6 lg:p-10)
    #[props(default = "p-6 lg:p-10".to_string())]
    padding: String,

    /// Whether to enable scroll
    #[props(default = true)]
    scrollable: bool,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    rsx! {
        div {
            class: format!(
                "{} {}",
                if scrollable { "overflow-y-auto" } else { "" },
                class
            ),
            style: "background-color: {background_color}; padding: {padding}",
            { children }
        }
    }
}
