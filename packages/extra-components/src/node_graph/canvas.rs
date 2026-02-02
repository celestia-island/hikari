// node_graph/canvas.rs
// Main canvas component for node graph rendering

use std::collections::HashMap;

use dioxus::prelude::*;

use crate::node_graph::{
    connection::{Connection, ConnectionId, ConnectionLine},
    minimap::NodeGraphMinimap,
    node::{Node, NodeState, NodeType, PortPosition},
};

/// Node graph state
#[derive(Clone, Debug, PartialEq)]
pub struct NodeGraphState {
    pub nodes: HashMap<String, NodeState>,
    pub connections: Vec<Connection>,
    pub selected_node: Option<String>,
    pub selected_connection: Option<ConnectionId>,
    pub zoom: f64,
    pub pan: (f64, f64),
}

impl NodeGraphState {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            connections: Vec::new(),
            selected_node: None,
            selected_connection: None,
            zoom: 1.0,
            pan: (0.0, 0.0),
        }
    }

    /// Calculate port position based on node position and port placement
    pub fn calculate_port_position(
        &self,
        node_id: &str,
        _port_id: &str,
        port_position: PortPosition,
    ) -> Option<(f64, f64)> {
        let node_state = self.nodes.get(node_id)?;
        let (node_x, node_y) = node_state.position;
        let (node_width, node_height) = node_state.size;

        let (port_x, port_y) = match port_position {
            PortPosition::Top => (node_x + node_width / 2.0, node_y),
            PortPosition::Bottom => (node_x + node_width / 2.0, node_y + node_height),
            PortPosition::Left => (node_x, node_y + node_height / 2.0),
            PortPosition::Right => (node_x + node_width, node_y + node_height / 2.0),
        };

        Some((port_x, port_y))
    }
}

/// Main node graph canvas component with integrated features
#[component]
pub fn NodeGraphCanvas(
    #[props(default)] width: f64,
    #[props(default)] height: f64,
    #[props(default)] children: Element,
    #[props(default)] on_node_add: EventHandler<NodeType>,
    #[props(default)] on_node_select: EventHandler<String>,
    #[props(default)] on_node_move: EventHandler<(String, f64, f64)>,
    #[props(default)] on_node_delete: EventHandler<String>,
    #[props(default)] on_connection_create: EventHandler<(String, String, String, String)>,
    #[props(default)] on_connection_delete: EventHandler<ConnectionId>,
) -> Element {
    let state = use_signal(NodeGraphState::new);
    let show_minimap = use_signal(|| true);
    let show_controls = use_signal(|| true);

    // Pre-calculate connection positions
    let connections_data = use_memo(move || {
        let state_ref = state.read();
        let mut conn_data: Vec<(Connection, (f64, f64), (f64, f64))> = Vec::new();
        for connection in state_ref.connections.iter() {
            let from_port_pos = state_ref
                .calculate_port_position(
                    &connection.from_node,
                    &connection.from_port,
                    PortPosition::Right,
                )
                .unwrap_or((0.0, 0.0));

            let to_port_pos = state_ref
                .calculate_port_position(
                    &connection.to_node,
                    &connection.to_port,
                    PortPosition::Left,
                )
                .unwrap_or((0.0, 0.0));

            conn_data.push((connection.clone(), from_port_pos, to_port_pos));
        }
        conn_data
    });

    // Pre-calculate node data
    let nodes_data = use_memo(move || {
        let state_ref = state.read();
        let mut node_data: Vec<(String, NodeState)> = Vec::new();
        for (node_id, node_state) in state_ref.nodes.iter() {
            node_data.push((node_id.clone(), node_state.clone()));
        }
        node_data
    });

    // Canvas transformation
    let transform = format!(
        "transform: scale({}) translate({}px, {}px);",
        state.read().zoom,
        state.read().pan.0,
        state.read().pan.1
    );

    // Viewport zoom handlers
    let mut zoom_state = state.clone();
    let handle_zoom_in = move |_| {
        let mut state = zoom_state.write();
        state.zoom = (state.zoom * 1.2).min(3.0);
    };

    let mut zoom_state = state.clone();
    let handle_zoom_out = move |_| {
        let mut state = zoom_state.write();
        state.zoom = (state.zoom / 1.2).max(0.1);
    };

    let mut pan_state = state.clone();
    let handle_zoom_reset = move |_| {
        let mut state = pan_state.write();
        state.zoom = 1.0;
        state.pan = (0.0, 0.0);
    };

    // Viewport pan handlers (keyboard)
    let mut pan_state = state.clone();
    let handle_keydown = move |e: KeyboardEvent| {
        let mut state = pan_state.write();
        match e.key() {
            Key::Character(c) if c == "+" || c == "=" => {
                state.zoom = (state.zoom * 1.2).min(3.0);
            }
            Key::Character(c) if c == "-" || c == "_" => {
                state.zoom = (state.zoom / 1.2).max(0.1);
            }
            Key::Character(c) if c == "0" => {
                state.zoom = 1.0;
                state.pan = (0.0, 0.0);
            }
            Key::ArrowUp => {
                state.pan.1 -= 20.0 / state.zoom;
            }
            Key::ArrowDown => {
                state.pan.1 += 20.0 / state.zoom;
            }
            Key::ArrowLeft => {
                state.pan.0 -= 20.0 / state.zoom;
            }
            Key::ArrowRight => {
                state.pan.0 += 20.0 / state.zoom;
            }
            _ => {}
        }
    };

    // Minimap click handler
    let mut state_for_minimap = state.clone();
    let handle_minimap_click: EventHandler<(f64, f64)> =
        EventHandler::new(move |(x, y): (f64, f64)| {
            let mut state = state_for_minimap.write();
            let total_width = width * state.zoom;
            let total_height = height * state.zoom;
            let new_pan_x = (x / 200.0) * total_width - total_width / 2.0;
            let new_pan_y = (y / 150.0) * total_height - total_height / 2.0;
            state.pan = (new_pan_x, new_pan_y);
        });

    rsx! {
        div {
            class: "hi-node-graph-wrapper",
            style: format!("width: {}px; height: {}px;", width, height),
            onkeydown: handle_keydown,
            tabindex: "0",

            // Canvas layer
            svg {
                class: "hi-node-graph-canvas",
                width: "100%",
                height: "100%",
                style: "{transform}",

                // Background grid
                defs {
                    pattern {
                        id: "grid",
                        width: "20",
                        height: "20",
                        pattern_units: "userSpaceOnUse",

                        path {
                            d: "M 20 0 L 0 0 20",
                            fill: "none",
                            stroke: "var(--hi-color-border)",
                            "stroke-width": "0.5",
                            "stroke-opacity": "0.3",
                        }
                    }
                }

                rect {
                    width: "100%",
                    height: "100%",
                    fill: "url(#grid)",
                }

                // Connections layer
                g { class: "hi-node-graph-connections-layer",
                    for (connection, from_pos, to_pos) in connections_data.read().iter() {
                        ConnectionLine {
                            id: connection.id.clone(),
                            from_pos: *from_pos,
                            to_pos: *to_pos,
                            from_side: "right".to_string(),
                            to_side: "left".to_string(),
                            selected: state.read().selected_connection.as_ref() == Some(&connection.id),
                            on_click: move |id| on_connection_delete.call(id),
                        }
                    }
                }

                // Nodes layer
                g { class: "hi-node-graph-nodes-layer",
                    for (node_id, node_state) in nodes_data.read().iter() {
                        Node {
                            id: node_id.clone(),
                            title: node_id.clone(),
                            position: node_state.position,
                            selected: state.read().selected_node.as_ref() == Some(node_id),
                            minimized: node_state.minimized,
                            node_type: "custom".to_string(),
                            ports: vec![],
                            div { "Node Content" },
                        }
                    }
                }

                // Children overlay
                g { class: "hi-node-graph-overlay-layer",
                    {children}
                }
            }

            // Minimap (bottom-right)
            if show_minimap() {
                NodeGraphMinimap {
                    width: 200.0,
                    height: 150.0,
                    _zoom: state.read().zoom,
                    _pan: state.read().pan,
                    _nodes: state.read().nodes.iter()
                        .map(|(id, st)| (id.clone(), st.position, st.size))
                        .collect(),
                    _connections: state.read().connections.iter()
                        .map(|conn| {
                            let from_pos = state.read()
                                .calculate_port_position(
                                    &conn.from_node,
                                    &conn.from_port,
                                    PortPosition::Right,
                                )
                                .unwrap_or((0.0, 0.0));
                            let to_pos = state.read()
                                .calculate_port_position(
                                    &conn.to_node,
                                    &conn.to_port,
                                    PortPosition::Left,
                                )
                                .unwrap_or((0.0, 0.0));
                            (conn.id.clone(), from_pos, to_pos)
                        })
                        .collect(),
                    on_minimap_click: handle_minimap_click,
                }
            }

            // Controls (top-right)
            if show_controls() {
                div {
                    class: "hi-node-graph-controls",
                    style: "position: absolute; top: 10px; right: 10px;",

                    button {
                        class: "hi-control-btn",
                        onclick: handle_zoom_out,
                        title: "Zoom Out (-)",
                        "-"
                    }

                    span { class: "hi-zoom-level", "{state.read().zoom}" }

                    button {
                        class: "hi-control-btn",
                        onclick: handle_zoom_in,
                        title: "Zoom In (+)",
                        "+"
                    }

                    button {
                        class: "hi-control-btn",
                        onclick: handle_zoom_reset,
                        title: "Reset (0)",
                        "100%"
                    }
                }
            }
        }
    }
}
