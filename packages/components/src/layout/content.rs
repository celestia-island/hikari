// hikari-components/src/layout/content.rs
//! Content component - Main content area wrapper

use crate::prelude::*;

/// Main content area wrapper with configurable background, padding, and scroll behavior.
#[component]
pub fn Content(
    children: Element,

    #[props(default = "var(--hi-background, #f5f5f5)".to_string())] background_color: String,

    #[props(default = "p-6 lg:p-10".to_string())] padding: String,

    #[props(default = true)] scrollable: bool,

    #[props(default)] class: String,
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
