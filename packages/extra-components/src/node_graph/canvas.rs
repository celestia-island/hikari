// node_graph/canvas.rs
// Main canvas component for node graph rendering

use std::collections::HashMap;

use dioxus::prelude::*;

use crate::node_graph::{
    connection::{Connection, ConnectionId, ConnectionLine},
    history::{HistoryAction, HistoryState},
    minimap::NodeGraphMinimap,
    node::{Node, NodeState, NodeType, PortPosition},
    serialization::SerializedNodeGraph,
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

/// Undo/Redo callback handler type
pub type UndoRedoCallback = EventHandler<()>;

/// Save/Load callback handler type
pub type SaveLoadCallback = EventHandler<Option<String>>;

/// Type alias for connection position data
type ConnectionPositionData = (Connection, (f64, f64), (f64, f64));

impl Default for NodeGraphState {
    fn default() -> Self {
        Self::new()
    }
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
    #[props(default)] on_undo: UndoRedoCallback,
    #[props(default)] on_redo: UndoRedoCallback,
    #[props(default)] on_save: SaveLoadCallback,
    #[props(default)] on_load: SaveLoadCallback,
) -> Element {
    let state = use_signal(NodeGraphState::new);
    let mut history = use_signal(HistoryState::new);
    let show_minimap = use_signal(|| true);
    let show_controls = use_signal(|| true);

    // Pre-calculate connection positions
    let connections_data = use_memo(move || {
        let state_ref = state.read();
        let mut conn_data: Vec<ConnectionPositionData> = Vec::new();
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
    let mut zoom_state = state;
    let handle_zoom_in = move |_| {
        let mut state = zoom_state.write();
        state.zoom = (state.zoom * 1.2).min(3.0);
    };

    let mut zoom_state = state;
    let handle_zoom_out = move |_| {
        let mut state = zoom_state.write();
        state.zoom = (state.zoom / 1.2).max(0.1);
    };

    let mut pan_state = state;
    let handle_zoom_reset = move |_| {
        let mut state = pan_state.write();
        state.zoom = 1.0;
        state.pan = (0.0, 0.0);
    };

    // Viewport pan handlers (keyboard)
    let mut pan_state = state;
    let on_undo_clone = on_undo;
    let on_redo_clone = on_redo;

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
            Key::Character(c)
                if (c == "z" || c == "Z") && e.modifiers().contains(Modifiers::CONTROL) =>
            {
                // Ctrl+Z for undo
                let action = {
                    let mut hist = history.write();
                    if hist.can_undo() { hist.undo() } else { None }
                };

                if let Some(action) = action {
                    match action {
                        HistoryAction::NodeAdd { id, .. } => {
                            state.nodes.remove(&id);
                        }
                        HistoryAction::NodeDelete {
                            id,
                            state: node_state,
                        } => {
                            let new_node_state: NodeState = node_state.into();
                            state.nodes.insert(id, new_node_state);
                        }
                        HistoryAction::NodeMove { id, from, .. } => {
                            if let Some(node) = state.nodes.get_mut(&id) {
                                node.position = from;
                            }
                        }
                        HistoryAction::ConnectionAdd { id, .. } => {
                            state.connections.retain(|c| c.id != id);
                        }
                        HistoryAction::ConnectionDelete {
                            id: _,
                            state: conn_state,
                        } => {
                            let connection = Connection::new(
                                &conn_state.from_node,
                                &conn_state.from_port,
                                &conn_state.to_node,
                                &conn_state.to_port,
                            );
                            state.connections.push(connection);
                        }
                    }

                    on_undo_clone.call(());
                }
            }
            Key::Character(c)
                if (c == "y" || c == "Y") && e.modifiers().contains(Modifiers::CONTROL) =>
            {
                // Ctrl+Y for redo
                let action = {
                    let mut hist = history.write();
                    if hist.can_redo() { hist.redo() } else { None }
                };

                if let Some(action) = action {
                    match action {
                        HistoryAction::NodeAdd {
                            id,
                            position,
                            node_type: _,
                        } => {
                            let node_state = NodeState {
                                id: id.clone(),
                                position,
                                size: (200.0, 150.0),
                                selected: false,
                                minimized: false,
                            };
                            state.nodes.insert(id, node_state);
                        }
                        HistoryAction::NodeDelete { id, .. } => {
                            state.nodes.remove(&id);
                        }
                        HistoryAction::NodeMove { id, to, .. } => {
                            if let Some(node) = state.nodes.get_mut(&id) {
                                node.position = to;
                            }
                        }
                        HistoryAction::ConnectionAdd {
                            id: _,
                            from_node,
                            from_port,
                            to_node,
                            to_port,
                        } => {
                            let connection =
                                Connection::new(&from_node, &from_port, &to_node, &to_port);
                            state.connections.push(connection);
                        }
                        HistoryAction::ConnectionDelete { id, .. } => {
                            state.connections.retain(|c| c.id != id);
                        }
                    }

                    on_redo_clone.call(());
                }
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

    // Undo handler (Ctrl+Z)
    let mut history_undo = history;
    let mut state_for_undo = state;
    let handle_undo = move |_| {
        let action = {
            let mut hist = history_undo.write();
            if hist.can_undo() { hist.undo() } else { None }
        };

        if let Some(action) = action {
            match action {
                HistoryAction::NodeAdd { id, .. } => {
                    let mut state = state_for_undo.write();
                    state.nodes.remove(&id);
                }
                HistoryAction::NodeDelete {
                    id,
                    state: node_state,
                } => {
                    let mut state = state_for_undo.write();
                    let new_node_state: NodeState = node_state.into();
                    state.nodes.insert(id, new_node_state);
                }
                HistoryAction::NodeMove { id, from, .. } => {
                    if let Some(node) = state_for_undo.write().nodes.get_mut(&id) {
                        node.position = from;
                    }
                }
                HistoryAction::ConnectionAdd { id, .. } => {
                    let mut state = state_for_undo.write();
                    state.connections.retain(|c| c.id != id);
                }
                HistoryAction::ConnectionDelete {
                    id: _,
                    state: conn_state,
                } => {
                    let mut state = state_for_undo.write();
                    let connection = Connection::new(
                        &conn_state.from_node,
                        &conn_state.from_port,
                        &conn_state.to_node,
                        &conn_state.to_port,
                    );
                    state.connections.push(connection);
                }
            }

            on_undo_clone.call(());
        }
    };

    // Redo handler (Ctrl+Y)
    let mut history_redo = history;
    let mut state_for_redo = state;
    let handle_redo = move |_| {
        let action = {
            let mut hist = history_redo.write();
            if hist.can_redo() { hist.redo() } else { None }
        };

        if let Some(action) = action {
            match action {
                HistoryAction::NodeAdd {
                    id,
                    position,
                    node_type: _,
                } => {
                    let mut state = state_for_redo.write();
                    let node_state = NodeState {
                        id: id.clone(),
                        position,
                        size: (200.0, 150.0),
                        selected: false,
                        minimized: false,
                    };
                    state.nodes.insert(id, node_state);
                }
                HistoryAction::NodeDelete { id, .. } => {
                    let mut state = state_for_redo.write();
                    state.nodes.remove(&id);
                }
                HistoryAction::NodeMove { id, to, .. } => {
                    if let Some(node) = state_for_redo.write().nodes.get_mut(&id) {
                        node.position = to;
                    }
                }
                HistoryAction::ConnectionAdd {
                    id: _,
                    from_node,
                    from_port,
                    to_node,
                    to_port,
                } => {
                    let mut state = state_for_redo.write();
                    let connection = Connection::new(&from_node, &from_port, &to_node, &to_port);
                    state.connections.push(connection);
                }
                HistoryAction::ConnectionDelete { id, .. } => {
                    let mut state = state_for_redo.write();
                    state.connections.retain(|c| c.id != id);
                }
            }

            on_redo_clone.call(());
        }
    };

    // Save handler
    let state_save = state;
    let handle_save = move |_| {
        let state_ref = state_save.read();
        let serialized = SerializedNodeGraph::from_state(&state_ref.nodes, &state_ref.connections);
        if let Ok(json) = serialized.to_json() {
            on_save.call(Some(json));
        }
    };

    // Minimap click handler
    let mut state_for_minimap = state;
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
                    style: "position: absolute; top: 10px; right: 10px; display: flex; gap: 8px;",

                    // Undo/Redo group
                    div {
                        style: "display: flex; gap: 4px;",

                        button {
                            class: "hi-control-btn",
                            onclick: handle_undo,
                            disabled: !history.read().can_undo(),
                            title: "Undo (Ctrl+Z)",
                            "↩"
                        }

                        button {
                            class: "hi-control-btn",
                            onclick: handle_redo,
                            disabled: !history.read().can_redo(),
                            title: "Redo (Ctrl+Y)",
                            "↪"
                        }
                    }

                    // Save/Load group
                    div {
                        style: "display: flex; gap: 4px;",

                        button {
                            class: "hi-control-btn",
                            onclick: handle_save,
                            title: "Save",
                            "💾"
                        }

                        button {
                            class: "hi-control-btn",
                            onclick: move |_| on_load.call(None),
                            title: "Load",
                            "📂"
                        }
                    }

                    // Zoom group
                    div {
                        style: "display: flex; gap: 4px;",

                        button {
                            class: "hi-control-btn",
                            onclick: handle_zoom_out,
                            title: "Zoom Out (-)",
                            "-"
                        }

                        span {
                            class: "hi-zoom-level",
                            style: "display: flex; align-items: center; padding: 0 8px;",
                            "{state.read().zoom}"
                        }

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
}
