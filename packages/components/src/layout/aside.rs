// hikari-components/src/layout/aside.rs
//! Aside component - Sidebar navigation panel

use dioxus::prelude::*;

/// Aside component - Sidebar navigation panel
///
/// # Example
///
/// ```rust
/// use hikari_components::layout::Aside;
/// use dioxus::prelude::*;
///
/// rsx! {
///     Aside {
///         nav {
///             a { "Link 1" }
///             a { "Link 2" }
///         }
///     }
/// }
/// ```
#[component]
pub fn Aside(
    /// Sidebar content
    children: Element,

    /// Background color (default: #1a1a2e)
    #[props(default = "#1a1a2e".to_string())]
    background_color: String,

    /// Text color (default: white)
    #[props(default = "text-white".to_string())]
    text_color: String,

    /// Sidebar width (default: 250px)
    #[props(default = "w-64".to_string())]
    width: String,

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
    let mut is_open = use_signal(|| initial_open);

    rsx! {
        aside {
            // Responsive drawer classes:
            // - Desktop (lg): static positioning, always visible
            // - Mobile: fixed positioning, slide in/out based on is_open
            class: format!(
                "fixed lg:static inset-y-0 left-0 z-50 {width} \
                 {text_color} p-5 flex flex-col gap-2 \
                 transition-transform duration-300 ease-in-out \
                 {} {class}",
                if *is_open.read() { "translate-x-0" } else { "-translate-x-full lg:translate-x-0" }
            ),
            style: "background-color: {background_color}",

            // Close button (mobile only)
            if collapsible {
                button {
                    class: "lg:hidden self-end p-2 hover:bg-white/10 rounded transition-colors",
                    onclick: move |_| {
                        is_open.set(false);
                        on_close.call(());
                    },
                    // Close icon
                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        fill: "none",
                        view_box: "0 0 24 24",
                        stroke: "currentColor",
                        class: "w-5 h-5",
                        stroke_width: "2",
                        path { d: "M6 18L18 6M6 6l12 12" }
                    }
                }
            }

            // Sidebar content
            { children }
        }
    }
}
