// hikari-components/src/layout/scrollbar.rs
//! Custom Scrollbar Container component
//!
//! A Dioxus component wrapper that uses the script-based scrollbar system.
//! The component renders a container that's initialized by the script.

use dioxus::prelude::*;

/// Custom Scrollbar Container component
///
/// This component renders a container with a special class that's picked up
/// by the scrollbar initialization script. The scrollbar is fully managed
/// by the WASM script system.
///
/// # Example
///
/// ```rust,ignore
/// use hikari_components::ScrollbarContainer;
/// use dioxus::prelude::*;
///
/// rsx! {
///     ScrollbarContainer {
///         height: "400px",
///         div { "Content with custom scrollbar..." }
///     }
/// }
/// ```
#[component]
pub fn ScrollbarContainer(
    /// Content to display with custom scrollbar
    children: Element,

    /// Container height (default: "100%")
    #[props(default = "100%".to_string())]
    height: String,

    /// Container width (default: "100%")
    #[props(default = "100%".to_string())]
    width: String,

    /// Additional CSS classes
    #[props(default)]
    class: String,
) -> Element {
    rsx! {
        div {
            class: format!("custom-scrollbar-wrapper-vdom {}", class),
            style: "position: relative; display: flex; width: {width}; height: {height}; overflow: hidden;",

            // Content area - will be wrapped by the script
            div {
                class: "custom-scrollbar-content-vdom",
                style: "flex: 1; overflow-y: auto; overflow-x: hidden; min-width: 0;",
                "data-custom-scrollbar": "content",

                { children }
            }
        }
    }
}
