// node_graph/viewport.rs
// Viewport controls for pan and zoom

use dioxus::prelude::*;

/// Viewport controls
#[component]
pub fn Viewport(
    #[props(default)] zoom: f64,
    #[props(default)] pan: (f64, f64),
    #[props(default)] on_zoom_in: EventHandler<()>,
    #[props(default)] on_zoom_out: EventHandler<()>,
    #[props(default)] on_pan: EventHandler<(f64, f64)>,
    #[props(default)] on_reset: EventHandler<()>,
) -> Element {
    let zoom_text = format!("{:.0}x", zoom);

    rsx! {
        div { class: "hi-node-viewport-controls",

            // Zoom controls
            div { class: "hi-viewport-zoom",
                button {
                    class: "hi-viewport-button",
                    onclick: move |_| on_zoom_in.call(()),
                    span { class: "hi-viewport-icon", "+" }
                }

                span { class: "hi-viewport-zoom-level", "{zoom_text}" }

                button {
                    class: "hi-viewport-button",
                    onclick: move |_| on_zoom_out.call(()),
                    span { class: "hi-viewport-icon", "-" }
                }
            }

            // Reset button
            button {
                class: "hi-viewport-reset",
                onclick: move |_| on_reset.call(()),
                "Reset"
            }
        }
    }
}
