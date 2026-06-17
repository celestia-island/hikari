// node_graph/canvas.rs
// Main canvas state for node graph rendering - Framework Agnostic

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

use anyhow::{Context, Result};
use tairitsu_vdom::svg::SafeSvg;
use tairitsu_vdom::{VElement, VNode, VText};

use crate::node_graph::connection::{Connection, ConnectionId};
use crate::node_graph::history::{HistoryAction, HistoryState};
use crate::node_graph::minimap::{MinimapConnection, MinimapNode, NodeGraphMinimap};
use crate::node_graph::node::{NodePlacement, NodeType, NodeView, PortPosition};
use crate::node_graph::serialization::SerializedNodeGraph;

/// Node graph state
///
/// Previously a Dioxus component with complex rendering logic.
/// Now a pure state model that can be used with any framework.
#[derive(Clone, Debug, PartialEq)]
pub struct NodeGraphState {
    pub nodes: HashMap<String, NodePlacement>,
    pub connections: Vec<Connection>,
    pub selected_node: Option<String>,
    pub selected_connection: Option<ConnectionId>,
    pub zoom: f64,
    pub pan: (f64, f64),
}

impl Default for NodeGraphState {
    fn default() -> Self {
        Self::new()
    }
}

impl NodeGraphState {
    #[must_use]
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

    /// Add a node to the graph
    pub fn add_node(&mut self, state: NodePlacement) {
        self.nodes.insert(state.id.clone(), state);
    }

    /// Remove a node from the graph
    pub fn remove_node(&mut self, id: &str) -> Option<NodePlacement> {
        self.nodes.remove(id)
    }

    /// Get a node by ID
    #[must_use]
    pub fn get_node(&self, id: &str) -> Option<&NodePlacement> {
        self.nodes.get(id)
    }

    /// Get a mutable node by ID
    pub fn get_node_mut(&mut self, id: &str) -> Option<&mut NodePlacement> {
        self.nodes.get_mut(id)
    }

    /// Update node position
    pub fn update_node_position(&mut self, id: &str, x: f64, y: f64) -> bool {
        if let Some(node) = self.nodes.get_mut(id) {
            node.position = (x, y);
            true
        } else {
            false
        }
    }

    /// Add a connection
    pub fn add_connection(&mut self, connection: Connection) {
        self.connections.push(connection);
    }

    /// Remove a connection by ID
    pub fn remove_connection(&mut self, id: &ConnectionId) -> Option<Connection> {
        let pos = self.connections.iter().position(|c| &c.id == id)?;
        Some(self.connections.remove(pos))
    }

    /// Select a node
    pub fn select_node(&mut self, id: Option<String>) {
        if let Some(current_id) = &self.selected_node
            && let Some(node) = self.nodes.get_mut(current_id)
        {
            node.selected = false;
        }

        self.selected_node = id.clone();

        if let Some(new_id) = &id
            && let Some(node) = self.nodes.get_mut(new_id)
        {
            node.selected = true;
        }
    }

    /// Select a connection
    pub fn select_connection(&mut self, id: Option<ConnectionId>) {
        self.selected_connection = id;
    }

    /// Set zoom level (clamped)
    pub const fn set_zoom(&mut self, zoom: f64, min: f64, max: f64) {
        self.zoom = zoom.clamp(min, max);
    }

    /// Zoom in by a factor
    pub fn zoom_in(&mut self, factor: f64, min: f64, max: f64) {
        self.set_zoom(self.zoom * factor, min, max);
    }

    /// Zoom out by a factor
    pub fn zoom_out(&mut self, factor: f64, min: f64, max: f64) {
        self.set_zoom(self.zoom / factor, min, max);
    }

    /// Reset zoom and pan
    pub const fn reset_view(&mut self) {
        self.zoom = 1.0;
        self.pan = (0.0, 0.0);
    }

    /// Pan the view
    pub fn pan(&mut self, dx: f64, dy: f64) {
        self.pan.0 += dx;
        self.pan.1 += dy;
    }

    /// Calculate port position based on node position and port placement
    #[must_use]
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

    /// Get the transform CSS string for the canvas
    #[must_use]
    pub fn transform_style(&self) -> String {
        format!(
            "transform: scale({}) translate({}px, {}px);",
            self.zoom, self.pan.0, self.pan.1
        )
    }

    /// Clear all nodes and connections
    pub fn clear(&mut self) {
        self.nodes.clear();
        self.connections.clear();
        self.selected_node = None;
        self.selected_connection = None;
    }

    pub fn undo(&mut self, history: &mut HistoryState) -> Option<NodeGraphEvent> {
        let action = history.undo()?;
        match action {
            HistoryAction::NodeAdd { id, .. } => {
                let removed = self.remove_node(&id);
                if removed.is_some() {
                    Some(NodeGraphEvent::NodeDeleted(id))
                } else {
                    None
                }
            }
            HistoryAction::NodeDelete {
                id,
                state: node_state,
            } => {
                let mut ns = NodePlacement::new(id.clone());
                ns.position = node_state.position;
                ns.size = node_state.size;
                ns.minimized = node_state.minimized;
                ns.selected = false;
                self.nodes.insert(id.clone(), ns);
                Some(NodeGraphEvent::NodeAdded {
                    id,
                    node_type: NodeType::new("custom", ""),
                    position: node_state.position,
                })
            }
            HistoryAction::NodeMove { id, from, to: _ } => {
                self.update_node_position(&id, from.0, from.1);
                Some(NodeGraphEvent::NodeMoved { id, to: from })
            }
            HistoryAction::ConnectionAdd {
                id,
                from_node: _,
                from_port: _,
                to_node: _,
                to_port: _,
            } => {
                self.remove_connection(&id);
                Some(NodeGraphEvent::ConnectionDeleted(id))
            }
            HistoryAction::ConnectionDelete {
                id,
                state: conn_state,
            } => {
                let conn = Connection::new(
                    &conn_state.from_node,
                    &conn_state.from_port,
                    &conn_state.to_node,
                    &conn_state.to_port,
                );
                self.connections.push(conn);
                Some(NodeGraphEvent::ConnectionCreated {
                    id,
                    from_node: conn_state.from_node,
                    from_port: conn_state.from_port,
                    to_node: conn_state.to_node,
                    to_port: conn_state.to_port,
                })
            }
        }
    }

    pub fn redo(&mut self, history: &mut HistoryState) -> Option<NodeGraphEvent> {
        let action = history.redo()?;
        match action {
            HistoryAction::NodeAdd {
                id,
                node_type,
                position,
            } => {
                let ns = NodePlacement::new(id.clone()).with_position(position.0, position.1);
                self.nodes.insert(id.clone(), ns);
                Some(NodeGraphEvent::NodeAdded {
                    id,
                    node_type: NodeType::new("custom", &node_type),
                    position,
                })
            }
            HistoryAction::NodeDelete { id, state: _ } => {
                self.remove_node(&id);
                Some(NodeGraphEvent::NodeDeleted(id))
            }
            HistoryAction::NodeMove { id, from: _, to } => {
                self.update_node_position(&id, to.0, to.1);
                Some(NodeGraphEvent::NodeMoved { id, to })
            }
            HistoryAction::ConnectionAdd {
                id,
                from_node,
                from_port,
                to_node,
                to_port,
            } => {
                let conn = Connection::new(&from_node, &from_port, &to_node, &to_port);
                self.connections.push(conn);
                Some(NodeGraphEvent::ConnectionCreated {
                    id,
                    from_node,
                    from_port,
                    to_node,
                    to_port,
                })
            }
            HistoryAction::ConnectionDelete { id, state: _ } => {
                self.remove_connection(&id);
                Some(NodeGraphEvent::ConnectionDeleted(id))
            }
        }
    }

    pub fn save(&self) -> Result<String> {
        let serialized = SerializedNodeGraph::from_state(&self.nodes, &self.connections);
        serialized.to_json()
    }

    pub fn load(&mut self, json: &str) -> Result<()> {
        let serialized = SerializedNodeGraph::from_json(json).context("Failed to parse JSON")?;
        let (nodes, connections) = serialized.to_state();
        self.nodes = nodes;
        self.connections = connections;
        self.selected_node = None;
        self.selected_connection = None;
        Ok(())
    }
}

/// Node graph canvas configuration
///
/// Configuration for the canvas, separate from state.
#[derive(Clone, Debug, PartialEq)]
pub struct NodeGraphCanvasConfig {
    /// Canvas width in pixels
    pub width: f64,

    /// Canvas height in pixels
    pub height: f64,

    /// Minimum zoom level
    pub min_zoom: f64,

    /// Maximum zoom level
    pub max_zoom: f64,

    /// Whether to show minimap
    pub show_minimap: bool,

    /// Whether to show controls
    pub show_controls: bool,

    /// Grid size in pixels
    pub grid_size: f64,
}

impl Default for NodeGraphCanvasConfig {
    fn default() -> Self {
        Self {
            width: 1200.0,
            height: 800.0,
            min_zoom: 0.1,
            max_zoom: 3.0,
            show_minimap: true,
            show_controls: true,
            grid_size: 20.0,
        }
    }
}

impl NodeGraphCanvasConfig {
    #[must_use]
    pub const fn with_size(mut self, width: f64, height: f64) -> Self {
        self.width = width;
        self.height = height;
        self
    }

    #[must_use]
    pub const fn with_zoom_bounds(mut self, min: f64, max: f64) -> Self {
        self.min_zoom = min;
        self.max_zoom = max;
        self
    }

    #[must_use]
    pub const fn with_minimap(mut self, show: bool) -> Self {
        self.show_minimap = show;
        self
    }

    #[must_use]
    pub const fn with_controls(mut self, show: bool) -> Self {
        self.show_controls = show;
        self
    }

    /// Get the container style string
    #[must_use]
    pub fn container_style(&self) -> String {
        format!("width: {}px; height: {}px;", self.width, self.height)
    }
}

/// Events that can be emitted by the node graph canvas
#[derive(Clone, PartialEq, Debug)]
pub enum NodeGraphEvent {
    /// A node was added
    NodeAdded {
        id: String,
        node_type: NodeType,
        position: (f64, f64),
    },

    /// A node was selected
    NodeSelected(String),

    /// A node was moved
    NodeMoved { id: String, to: (f64, f64) },

    /// A node was deleted
    NodeDeleted(String),

    /// A connection was created
    ConnectionCreated {
        id: ConnectionId,
        from_node: String,
        from_port: String,
        to_node: String,
        to_port: String,
    },

    /// A connection was deleted
    ConnectionDeleted(ConnectionId),

    /// Zoom changed
    ZoomChanged(f64),

    /// View was panned
    Panned { dx: f64, dy: f64 },

    /// Undo requested
    Undo,

    /// Redo requested
    Redo,

    /// Save requested
    Save,

    /// Load requested
    Load,
}

pub type SharedHistory = Rc<RefCell<HistoryState>>;

#[must_use]
pub fn create_shared_history() -> SharedHistory {
    Rc::new(RefCell::new(HistoryState::new()))
}

#[must_use]
pub fn render_node_graph_canvas(state: &NodeGraphState, config: &NodeGraphCanvasConfig) -> VNode {
    thread_local! {
        static HISTORY: RefCell<SharedHistory> = RefCell::new(create_shared_history());
    }
    HISTORY.with(|h| {
        let history = h.borrow().clone();
        render_node_graph_canvas_with_history(state, config, &history)
    })
}

pub fn render_node_graph_canvas_with_history(
    state: &NodeGraphState,
    config: &NodeGraphCanvasConfig,
    history: &SharedHistory,
) -> VNode {
    let mut children: Vec<VNode> = Vec::new();

    let mut svg_parts = String::new();
    svg_parts.push_str(&format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" class="hi-node-graph-svg" width="{}" height="{}" style="position:absolute;top:0;left:0;">"#,
        config.width, config.height,
    ));

    svg_parts.push_str(&format!(
        r#"<defs><pattern id="hi-node-grid" width="{}" height="{}" patternUnits="userSpaceOnUse"><path d="M {} 0 L 0 0 0 {}" fill="none" stroke="var(--hi-color-grid, #e2e8f0)" stroke-width="0.5"/></pattern></defs>"#,
        config.grid_size, config.grid_size, config.grid_size, config.grid_size,
    ));
    svg_parts.push_str(r#"<rect width="100%" height="100%" fill="url(#hi-node-grid)"/>"#);

    svg_parts.push_str(r#"<g class="hi-node-graph-connections">"#);
    for connection in &state.connections {
        let from_pos = state
            .calculate_port_position(
                &connection.from_node,
                &connection.from_port,
                PortPosition::Right,
            )
            .unwrap_or((0.0, 0.0));
        let to_pos = state
            .calculate_port_position(&connection.to_node, &connection.to_port, PortPosition::Left)
            .unwrap_or((0.0, 0.0));

        let path_data = connection.svg_path_data(from_pos, to_pos);
        let stroke_color = if connection.selected {
            "var(--hi-color-primary, #EEA2A4)"
        } else {
            "var(--hi-color-connection, #94a3b8)"
        };

        svg_parts.push_str(&format!(
            r#"<path class="{}" d="{}" stroke="{}" stroke-width="2" fill="none" pointer-events="stroke" data-connection-id="{}"/>"#,
            connection.class_string(),
            path_data,
            stroke_color,
            connection.id,
        ));
    }
    svg_parts.push_str("</g>");

    svg_parts.push_str("</svg>");

    children.push(VNode::Element(
        VElement::new("div")
            .class("hi-node-graph-svg-layer")
            .safe_svg(SafeSvg::new(&svg_parts)),
    ));

    let mut nodes_children: Vec<VNode> = Vec::new();
    for node_state in state.nodes.values() {
        let node = NodeView::from(node_state.clone());
        nodes_children.push(crate::node_graph::node::render_node(&node));
    }

    children.push(VNode::Element(
        VElement::new("div")
            .class("hi-node-graph-nodes")
            .style(state.transform_style())
            .children(nodes_children),
    ));

    children.push(VNode::Element(
        VElement::new("div").class("hi-node-graph-overlay-layer"),
    ));

    if config.show_minimap {
        let minimap = build_minimap_state(state, config);
        children.push(crate::node_graph::minimap::render_minimap(&minimap));
    }

    if config.show_controls {
        children.push(render_controls(
            &crate::node_graph::viewport::Viewport::new(),
            history,
        ));
    }

    VNode::Element(
        VElement::new("div")
            .class("hi-node-graph-canvas")
            .attr("tabindex", "0")
            .attr("data-action", "node-graph-canvas")
            .style(config.container_style())
            .children(children),
    )
}

fn build_minimap_state(state: &NodeGraphState, config: &NodeGraphCanvasConfig) -> NodeGraphMinimap {
    let mut minimap = NodeGraphMinimap::new(200.0, 150.0);
    minimap.canvas_size = (config.width, config.height);
    minimap.update_view(state.zoom, state.pan);

    let minimap_nodes: Vec<MinimapNode> = state
        .nodes
        .values()
        .map(|ns| MinimapNode {
            id: ns.id.clone(),
            position: ns.position,
            size: ns.size,
        })
        .collect();

    let minimap_connections: Vec<MinimapConnection> = state
        .connections
        .iter()
        .map(|conn| {
            let from_pos = state
                .calculate_port_position(&conn.from_node, &conn.from_port, PortPosition::Right)
                .unwrap_or((0.0, 0.0));
            let to_pos = state
                .calculate_port_position(&conn.to_node, &conn.to_port, PortPosition::Left)
                .unwrap_or((0.0, 0.0));
            MinimapConnection {
                id: conn.id.clone(),
                from: from_pos,
                to: to_pos,
            }
        })
        .collect();

    minimap.set_nodes(minimap_nodes);
    minimap.set_connections(minimap_connections);
    minimap
}

fn render_controls(
    viewport: &crate::node_graph::viewport::Viewport,
    history: &SharedHistory,
) -> VNode {
    let history_ref = history.borrow();
    let mut children: Vec<VNode> = Vec::new();

    let mut undo_redo_children: Vec<VNode> = Vec::new();

    let undo_btn = {
        let mut btn = VElement::new("button")
            .class("hi-control-btn hi-undo-btn")
            .attr("title", "Undo (Ctrl+Z)")
            .attr("data-action", "undo");
        if !history_ref.can_undo() {
            btn = btn.attr("disabled", "disabled");
        }
        VNode::Element(btn.child(VNode::Text(VText::new("Undo"))))
    };
    undo_redo_children.push(undo_btn);

    let redo_btn = {
        let mut btn = VElement::new("button")
            .class("hi-control-btn hi-redo-btn")
            .attr("title", "Redo (Ctrl+Y)")
            .attr("data-action", "redo");
        if !history_ref.can_redo() {
            btn = btn.attr("disabled", "disabled");
        }
        VNode::Element(btn.child(VNode::Text(VText::new("Redo"))))
    };
    undo_redo_children.push(redo_btn);

    children.push(VNode::Element(
        VElement::new("div")
            .class("hi-controls-group hi-undo-redo-group")
            .children(undo_redo_children),
    ));

    let mut save_load_children: Vec<VNode> = Vec::new();

    let save_btn = VNode::Element(
        VElement::new("button")
            .class("hi-control-btn hi-save-btn")
            .attr("title", "Save")
            .attr("data-action", "save")
            .child(VNode::Text(VText::new("Save"))),
    );
    save_load_children.push(save_btn);

    let load_btn = VNode::Element(
        VElement::new("button")
            .class("hi-control-btn hi-load-btn")
            .attr("title", "Load")
            .attr("data-action", "load")
            .child(VNode::Text(VText::new("Load"))),
    );
    save_load_children.push(load_btn);

    children.push(VNode::Element(
        VElement::new("div")
            .class("hi-controls-group hi-save-load-group")
            .children(save_load_children),
    ));

    children.push(crate::node_graph::viewport::render_viewport(viewport));

    VNode::Element(
        VElement::new("div")
            .class("hi-node-graph-controls")
            .children(children),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_graph_state_new() {
        let state = NodeGraphState::new();
        assert!(state.nodes.is_empty());
        assert!(state.connections.is_empty());
        assert_eq!(state.zoom, 1.0);
        assert_eq!(state.pan, (0.0, 0.0));
    }

    #[test]
    fn test_add_remove_node() {
        let mut state = NodeGraphState::new();
        let node = NodePlacement::new("node1".to_string());

        state.add_node(node.clone());
        assert_eq!(state.nodes.len(), 1);
        assert!(state.get_node("node1").is_some());

        let removed = state.remove_node("node1");
        assert!(removed.is_some());
        assert!(state.nodes.is_empty());
    }

    #[test]
    fn test_update_node_position() {
        let mut state = NodeGraphState::new();
        state.add_node(NodePlacement::new("node1".to_string()));

        assert!(state.update_node_position("node1", 100.0, 200.0));
        assert_eq!(state.get_node("node1").unwrap().position, (100.0, 200.0));
    }

    #[test]
    fn test_select_node() {
        let mut state = NodeGraphState::new();
        state.add_node(NodePlacement::new("node1".to_string()));
        state.add_node(NodePlacement::new("node2".to_string()));

        state.select_node(Some("node1".to_string()));
        assert_eq!(state.selected_node, Some("node1".to_string()));
        assert!(state.get_node("node1").unwrap().selected);

        state.select_node(Some("node2".to_string()));
        assert_eq!(state.selected_node, Some("node2".to_string()));
        assert!(!state.get_node("node1").unwrap().selected);
        assert!(state.get_node("node2").unwrap().selected);
    }

    #[test]
    fn test_zoom() {
        let mut state = NodeGraphState::new();

        state.set_zoom(2.0, 0.1, 3.0);
        assert_eq!(state.zoom, 2.0);

        state.set_zoom(5.0, 0.1, 3.0);
        assert_eq!(state.zoom, 3.0); // Clamped to max

        state.zoom_in(1.5, 0.1, 3.0);
        assert_eq!(state.zoom, 3.0); // 3.0 * 1.5 = 4.5, clamped to 3.0

        state.zoom_out(2.0, 0.1, 3.0);
        assert_eq!(state.zoom, 1.5); // 3.0 / 2.0 = 1.5
    }

    #[test]
    fn test_pan() {
        let mut state = NodeGraphState::new();

        state.pan(10.0, 20.0);
        assert_eq!(state.pan, (10.0, 20.0));

        state.pan(-5.0, -10.0);
        assert_eq!(state.pan, (5.0, 10.0));
    }

    #[test]
    fn test_reset_view() {
        let mut state = NodeGraphState::new();
        state.zoom = 2.0;
        state.pan = (100.0, 200.0);

        state.reset_view();
        assert_eq!(state.zoom, 1.0);
        assert_eq!(state.pan, (0.0, 0.0));
    }

    #[test]
    fn test_calculate_port_position() {
        let mut state = NodeGraphState::new();
        let node = NodePlacement::new("node1".to_string())
            .with_position(100.0, 100.0)
            .with_size(200.0, 150.0);
        state.add_node(node);

        let pos = state.calculate_port_position("node1", "port1", PortPosition::Top);
        assert_eq!(pos, Some((200.0, 100.0)));

        let pos = state.calculate_port_position("node1", "port1", PortPosition::Right);
        assert_eq!(pos, Some((300.0, 175.0)));

        let pos = state.calculate_port_position("node1", "port1", PortPosition::Bottom);
        assert_eq!(pos, Some((200.0, 250.0)));

        let pos = state.calculate_port_position("node1", "port1", PortPosition::Left);
        assert_eq!(pos, Some((100.0, 175.0)));
    }

    #[test]
    fn test_transform_style() {
        let state = NodeGraphState {
            zoom: 1.5,
            pan: (10.0, 20.0),
            ..Default::default()
        };

        let style = state.transform_style();
        assert!(style.contains("scale(1.5)"));
        assert!(style.contains("translate(10px"));
        assert!(style.contains("20px"));
    }

    #[test]
    fn test_config_default() {
        let config = NodeGraphCanvasConfig::default();
        assert_eq!(config.width, 1200.0);
        assert_eq!(config.height, 800.0);
        assert_eq!(config.min_zoom, 0.1);
        assert_eq!(config.max_zoom, 3.0);
    }

    #[test]
    fn test_config_builder() {
        let config = NodeGraphCanvasConfig::default()
            .with_size(800.0, 600.0)
            .with_zoom_bounds(0.5, 2.0)
            .with_minimap(false)
            .with_controls(false);

        assert_eq!(config.width, 800.0);
        assert_eq!(config.height, 600.0);
        assert_eq!(config.min_zoom, 0.5);
        assert_eq!(config.max_zoom, 2.0);
        assert!(!config.show_minimap);
        assert!(!config.show_controls);
    }

    #[test]
    fn test_remove_nonexistent_node_no_panic() {
        let mut state = NodeGraphState::new();
        let result = state.remove_node("does_not_exist");
        assert!(result.is_none());
        assert!(state.nodes.is_empty());
    }

    #[test]
    fn test_remove_nonexistent_node_from_populated() {
        let mut state = NodeGraphState::new();
        state.add_node(NodePlacement::new("n1".to_string()));
        let result = state.remove_node("does_not_exist");
        assert!(result.is_none());
        assert_eq!(state.nodes.len(), 1);
    }

    #[test]
    fn test_move_node_negative_coordinates() {
        let mut state = NodeGraphState::new();
        state.add_node(NodePlacement::new("n1".to_string()));
        assert!(state.update_node_position("n1", -500.0, -999.9));
        assert_eq!(state.get_node("n1").unwrap().position, (-500.0, -999.9));
    }

    #[test]
    fn test_update_position_nonexistent_node() {
        let mut state = NodeGraphState::new();
        assert!(!state.update_node_position("ghost", 1.0, 2.0));
    }

    #[test]
    fn test_select_node_none_deselects() {
        let mut state = NodeGraphState::new();
        state.add_node(NodePlacement::new("n1".to_string()));
        state.select_node(Some("n1".to_string()));
        assert!(state.get_node("n1").unwrap().selected);

        state.select_node(None);
        assert!(state.selected_node.is_none());
        assert!(!state.get_node("n1").unwrap().selected);
    }

    #[test]
    fn test_select_nonexistent_node_no_panic() {
        let mut state = NodeGraphState::new();
        state.add_node(NodePlacement::new("n1".to_string()));
        state.select_node(Some("n1".to_string()));

        state.select_node(Some("ghost".to_string()));
        assert_eq!(state.selected_node, Some("ghost".to_string()));
        assert!(!state.get_node("n1").unwrap().selected);
    }

    #[test]
    fn test_select_node_replaces_previous() {
        let mut state = NodeGraphState::new();
        state.add_node(NodePlacement::new("a".to_string()));
        state.add_node(NodePlacement::new("b".to_string()));

        state.select_node(Some("a".to_string()));
        assert!(state.get_node("a").unwrap().selected);
        assert!(!state.get_node("b").unwrap().selected);

        state.select_node(Some("b".to_string()));
        assert!(!state.get_node("a").unwrap().selected);
        assert!(state.get_node("b").unwrap().selected);
    }

    #[test]
    fn test_select_connection() {
        let mut state = NodeGraphState::new();
        state.select_connection(Some("conn1".to_string()));
        assert_eq!(state.selected_connection, Some("conn1".to_string()));

        state.select_connection(None);
        assert!(state.selected_connection.is_none());
    }

    #[test]
    fn test_zoom_clamped_to_min() {
        let mut state = NodeGraphState::new();
        state.set_zoom(0.01, 0.1, 3.0);
        assert_eq!(state.zoom, 0.1);
    }

    #[test]
    fn test_zoom_clamped_to_max() {
        let mut state = NodeGraphState::new();
        state.set_zoom(100.0, 0.1, 3.0);
        assert_eq!(state.zoom, 3.0);
    }

    #[test]
    fn test_zoom_out_does_not_go_below_min() {
        let mut state = NodeGraphState::new();
        state.zoom = 0.1;
        state.zoom_out(10.0, 0.1, 3.0);
        assert_eq!(state.zoom, 0.1);
    }

    #[test]
    fn test_zoom_in_does_not_exceed_max() {
        let mut state = NodeGraphState::new();
        state.zoom = 3.0;
        state.zoom_in(2.0, 0.1, 3.0);
        assert_eq!(state.zoom, 3.0);
    }

    #[test]
    fn test_pan_accumulates() {
        let mut state = NodeGraphState::new();
        state.pan(100.0, 50.0);
        state.pan(-30.0, -20.0);
        assert_eq!(state.pan, (70.0, 30.0));
    }

    #[test]
    fn test_pan_negative() {
        let mut state = NodeGraphState::new();
        state.pan(-500.0, -500.0);
        assert_eq!(state.pan, (-500.0, -500.0));
    }

    #[test]
    fn test_reset_view_after_operations() {
        let mut state = NodeGraphState::new();
        state.set_zoom(2.5, 0.1, 3.0);
        state.pan(100.0, 200.0);
        state.reset_view();
        assert_eq!(state.zoom, 1.0);
        assert_eq!(state.pan, (0.0, 0.0));
    }

    #[test]
    fn test_clear_resets_everything() {
        let mut state = NodeGraphState::new();
        state.add_node(NodePlacement::new("n1".to_string()));
        state.add_connection(Connection::new("n1", "out", "n2", "in"));
        state.select_node(Some("n1".to_string()));
        state.select_connection(Some("c1".to_string()));

        state.clear();
        assert!(state.nodes.is_empty());
        assert!(state.connections.is_empty());
        assert!(state.selected_node.is_none());
        assert!(state.selected_connection.is_none());
    }

    #[test]
    fn test_get_node_mut() {
        let mut state = NodeGraphState::new();
        state.add_node(NodePlacement::new("n1".to_string()));

        if let Some(node) = state.get_node_mut("n1") {
            node.minimized = true;
        }
        assert!(state.get_node("n1").unwrap().minimized);

        assert!(state.get_node_mut("ghost").is_none());
    }

    #[test]
    fn test_add_connection() {
        let mut state = NodeGraphState::new();
        let conn = Connection::new("n1", "out", "n2", "in");
        state.add_connection(conn);
        assert_eq!(state.connections.len(), 1);
        assert_eq!(state.connections[0].id, "n1_out_n2_in");
    }

    #[test]
    fn test_remove_connection_by_id() {
        let mut state = NodeGraphState::new();
        let conn = Connection::new("n1", "out", "n2", "in");
        let conn_id = conn.id.clone();
        state.add_connection(conn);

        let removed = state.remove_connection(&conn_id);
        assert!(removed.is_some());
        assert!(state.connections.is_empty());
    }

    #[test]
    fn test_remove_nonexistent_connection() {
        let mut state = NodeGraphState::new();
        let result = state.remove_connection(&"nonexistent".to_string());
        assert!(result.is_none());
    }

    #[test]
    fn test_port_position_nonexistent_node() {
        let state = NodeGraphState::new();
        let result = state.calculate_port_position("ghost", "p1", PortPosition::Right);
        assert!(result.is_none());
    }

    #[test]
    fn test_port_position_zero_size_node() {
        let mut state = NodeGraphState::new();
        state.add_node(NodePlacement::new("n1".to_string()).with_size(0.0, 0.0));
        let pos = state.calculate_port_position("n1", "p1", PortPosition::Right);
        assert_eq!(pos, Some((0.0, 0.0)));
    }

    #[test]
    fn test_save_load_round_trip() {
        let mut state = NodeGraphState::new();
        state.add_node(NodePlacement::new("n1".to_string()).with_position(10.0, 20.0));
        state.add_node(NodePlacement::new("n2".to_string()).with_position(300.0, 400.0));
        state.add_connection(Connection::new("n1", "out", "n2", "in"));

        let json = state.save().unwrap();

        let mut loaded = NodeGraphState::new();
        loaded.load(&json).unwrap();

        assert_eq!(loaded.nodes.len(), 2);
        assert_eq!(loaded.connections.len(), 1);
        assert_eq!(loaded.nodes.get("n1").unwrap().position, (10.0, 20.0));
        assert_eq!(loaded.nodes.get("n2").unwrap().position, (300.0, 400.0));
        assert!(loaded.selected_node.is_none());
        assert!(loaded.selected_connection.is_none());
    }

    #[test]
    fn test_load_invalid_json_returns_err() {
        let mut state = NodeGraphState::new();
        let result = state.load("not json");
        assert!(result.is_err());
    }

    #[test]
    fn test_load_clears_selection() {
        let mut state = NodeGraphState::new();
        state.select_node(Some("n1".to_string()));
        state.select_connection(Some("c1".to_string()));

        let empty_graph = SerializedNodeGraph::new().to_json().unwrap();
        state.load(&empty_graph).unwrap();

        assert!(state.selected_node.is_none());
        assert!(state.selected_connection.is_none());
    }

    #[test]
    fn test_default() {
        let state = NodeGraphState::default();
        assert!(state.nodes.is_empty());
        assert!(state.connections.is_empty());
        assert_eq!(state.zoom, 1.0);
        assert_eq!(state.pan, (0.0, 0.0));
    }

    #[test]
    fn test_container_style() {
        let config = NodeGraphCanvasConfig::default().with_size(500.0, 400.0);
        let style = config.container_style();
        assert!(style.contains("500px"));
        assert!(style.contains("400px"));
    }

    #[test]
    fn test_add_duplicate_node_replaces() {
        let mut state = NodeGraphState::new();
        state.add_node(NodePlacement::new("n1".to_string()).with_position(10.0, 10.0));
        state.add_node(NodePlacement::new("n1".to_string()).with_position(20.0, 20.0));
        assert_eq!(state.nodes.len(), 1);
        assert_eq!(state.get_node("n1").unwrap().position, (20.0, 20.0));
    }
}
