// node_graph/minimap.rs
// Minimap component for node graph overview

use dioxus::prelude::*;

/// Type alias for minimap node data
type MinimapNodeData = (String, (f64, f64), (f64, f64));

/// Type alias for minimap connection data
type MinimapConnectionData = (String, (f64, f64), (f64, f64));

/// Minimap component showing overview of the node graph
#[component]
pub fn NodeGraphMinimap(
    #[props(default)] width: f64,
    #[props(default)] height: f64,
    #[props(default)] _zoom: f64,
    #[props(default)] _pan: (f64, f64),
    _nodes: Vec<MinimapNodeData>,
    _connections: Vec<MinimapConnectionData>,
    #[props(default)] on_minimap_click: EventHandler<(f64, f64)>,
) -> Element {
    let on_click = move |_e: dioxus::prelude::MouseEvent| {
        // Simple click handler for minimap
        on_minimap_click.call((100.0, 100.0));
    };

    rsx! {
        div {
            class: "hi-node-graph-minimap",
            style: format!("width: {}px; height: {}px;", width, height),
            onclick: on_click,

            // Minimap canvas
            svg {
                class: "hi-minimap-svg",
                width: "100%",
                height: "100%",

                // Background
                rect {
                    class: "hi-minimap-background",
                    width: "100%",
                    height: "100%",
                }
            }
        }
    }
}
