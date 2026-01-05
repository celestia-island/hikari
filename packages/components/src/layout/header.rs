// hikari-components/src/layout/header.rs
//! Header component - Top application header bar

use dioxus::prelude::*;

/// Header component - Top application header bar
///
/// # Example
///
/// ```rust
/// use hikari_components::layout::Header;
/// use dioxus::prelude::*;
///
/// rsx! {
///     Header {
///         h1 { "My Application" }
///     }
/// }
/// ```
#[component]
pub fn Header(
    /// Header content
    children: Element,

    /// Background color (default: #1a1a2e)
    #[props(default = "#1a1a2e".to_string())]
    background_color: String,

    /// Text color (default: white)
    #[props(default = "text-white".to_string())]
    text_color: String,

    /// Whether to show mobile menu toggle button
    #[props(default = false)]
    show_menu_toggle: bool,

    /// Callback when menu toggle is clicked
    on_menu_toggle: EventHandler,

    /// Custom CSS classes
    #[props(default)]
    class: String,
) -> Element {
    rsx! {
        header {
            class: format!(
                "flex items-center justify-between p-4 {} {class}",
                match text_color.as_str() {
                    "text-white" => "text-white",
                    _ => &text_color
                }
            ),
            style: "background-color: {background_color}",

            // Menu toggle button (mobile)
            if show_menu_toggle {
                button {
                    class: "lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors",
                    onclick: move |_| on_menu_toggle.call(()),
                    // Menu icon (hamburger)
                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        fill: "none",
                        view_box: "0 0 24 24",
                        stroke: "currentColor",
                        class: "w-6 h-6",
                        stroke_width: "2",
                        path { d: "M4 6h16M4 12h16M4 18h16" }
                    }
                }
            }

            // Header content
            div { class: "flex-1", { children } }
        }
    }
}
