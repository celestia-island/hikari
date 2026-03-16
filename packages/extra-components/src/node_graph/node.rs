// node_graph/node.rs
// Node definition and plugin-based node system - Framework Agnostic

use std::collections::HashMap;

pub type NodeId = String;
pub type PortId = String;

/// Node type identifier for plugins
#[derive(Clone, Debug, PartialEq, Eq, Hash, Default)]
pub struct NodeType {
    pub category: String,
    pub name: String,
}

impl NodeType {
    pub fn new(category: &str, name: &str) -> Self {
        Self {
            category: category.to_string(),
            name: name.to_string(),
        }
    }

    pub fn id(&self) -> String {
        if self.category.is_empty() && self.name.is_empty() {
            String::new()
        } else {
            format!("{}/{}", self.category, self.name)
        }
    }
}

/// Node state
#[derive(Clone, Debug, PartialEq)]
pub struct NodeState {
    pub id: NodeId,
    pub position: (f64, f64),
    pub size: (f64, f64),
    pub selected: bool,
    pub minimized: bool,
}

impl NodeState {
    pub fn new(id: NodeId) -> Self {
        Self {
            id,
            position: (0.0, 0.0),
            size: (200.0, 150.0),
            selected: false,
            minimized: false,
        }
    }

    pub fn with_position(mut self, x: f64, y: f64) -> Self {
        self.position = (x, y);
        self
    }

    pub fn with_size(mut self, width: f64, height: f64) -> Self {
        self.size = (width, height);
        self
    }

    pub fn with_selected(mut self, selected: bool) -> Self {
        self.selected = selected;
        self
    }

    pub fn with_minimized(mut self, minimized: bool) -> Self {
        self.minimized = minimized;
        self
    }
}

/// Node port
#[derive(Clone, Debug, PartialEq)]
pub struct NodePort {
    pub port_id: PortId,
    pub port_type: String,
    pub label: String,
    pub position: PortPosition,
}

impl NodePort {
    pub fn new(port_id: PortId, port_type: String, label: String, position: PortPosition) -> Self {
        Self {
            port_id,
            port_type,
            label,
            position,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Copy)]
pub enum PortPosition {
    Top,
    Bottom,
    Left,
    Right,
}

impl PortPosition {
    pub fn name(&self) -> &'static str {
        match self {
            PortPosition::Top => "top",
            PortPosition::Bottom => "bottom",
            PortPosition::Left => "left",
            PortPosition::Right => "right",
        }
    }
}

/// Node plugin trait for custom node types
///
/// This trait defines the interface for creating custom node types.
/// Implementations should handle node logic. Rendering is now
/// framework-agnostic - use the data provided by this trait to
/// render with your preferred framework (Tairitsu, Dioxus, etc.).
pub trait NodePlugin: Send + Sync {
    /// Get node type
    fn node_type(&self) -> NodeType;

    /// Get display label for the node
    fn label(&self) -> String {
        self.node_type().name.clone()
    }

    /// Get display value (for constant nodes, etc.)
    fn display_value(&self) -> Option<String> {
        None
    }

    /// Handle input port data
    fn handle_input(&self, port_id: PortId, data: crate::node_graph::value::NodeValue);

    /// Get output port data
    fn get_output(&self, port_id: PortId) -> Option<crate::node_graph::value::NodeValue>;

    /// Get default ports for this node type
    fn default_ports(&self) -> Vec<NodePort> {
        Vec::new()
    }
}

/// Simple node data structure for rendering
///
/// This is the data model that frameworks can use to render nodes.
/// Previously a Dioxus component, now framework-agnostic.
#[derive(Clone, Debug, PartialEq)]
pub struct Node {
    pub id: NodeId,
    pub title: String,
    pub position: (f64, f64),
    pub size: (f64, f64),
    pub selected: bool,
    pub minimized: bool,
    pub node_type: String,
    pub ports: Vec<NodePort>,
    pub custom_data: HashMap<String, String>,
}

impl Node {
    pub fn new(id: NodeId, title: String) -> Self {
        Self {
            id,
            title,
            position: (0.0, 0.0),
            size: (200.0, 150.0),
            selected: false,
            minimized: false,
            node_type: "default".to_string(),
            ports: Vec::new(),
            custom_data: HashMap::new(),
        }
    }

    pub fn with_position(mut self, x: f64, y: f64) -> Self {
        self.position = (x, y);
        self
    }

    pub fn with_size(mut self, width: f64, height: f64) -> Self {
        self.size = (width, height);
        self
    }

    pub fn with_type(mut self, node_type: String) -> Self {
        self.node_type = node_type;
        self
    }

    pub fn add_port(mut self, port: NodePort) -> Self {
        self.ports.push(port);
        self
    }

    pub fn with_custom_data(mut self, key: String, value: String) -> Self {
        self.custom_data.insert(key, value);
        self
    }

    /// Calculate height based on minimization state
    pub fn effective_height(&self) -> f64 {
        if self.minimized {
            40.0
        } else {
            150.0 + self.ports.len() as f64 * 30.0
        }
    }

    /// Get the CSS position style string
    pub fn position_style(&self) -> String {
        format!(
            "position: absolute; left: {}px; top: {}px; width: {}px; height: {}px;",
            self.position.0,
            self.position.1,
            self.size.0,
            self.effective_height()
        )
    }

    /// Get CSS classes for the node
    pub fn class_string(&self) -> String {
        format!(
            "hi-node-graph-node hi-node-{} {} {}",
            self.node_type,
            if self.selected { "hi-node-selected" } else { "" },
            if self.minimized { "hi-node-minimized" } else { "" }
        )
    }
}

impl From<NodeState> for Node {
    fn from(state: NodeState) -> Self {
        let id = state.id.clone();
        Self {
            id,
            title: state.id,
            position: state.position,
            size: state.size,
            selected: state.selected,
            minimized: state.minimized,
            node_type: "default".to_string(),
            ports: Vec::new(),
            custom_data: HashMap::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_type_new() {
        let node_type = NodeType::new("constant", "number");
        assert_eq!(node_type.category, "constant");
        assert_eq!(node_type.name, "number");
    }

    #[test]
    fn test_node_type_id() {
        let node_type = NodeType::new("constant", "number");
        assert_eq!(node_type.id(), "constant/number");
    }

    #[test]
    fn test_node_type_id_empty() {
        let node_type = NodeType::default();
        assert_eq!(node_type.id(), "");
    }

    #[test]
    fn test_node_type_equality() {
        let type1 = NodeType::new("constant", "number");
        let type2 = NodeType::new("constant", "number");
        let type3 = NodeType::new("input", "number");

        assert_eq!(type1, type2);
        assert_ne!(type1, type3);
    }

    #[test]
    fn test_node_state_new() {
        let state = NodeState::new("node1".to_string());
        assert_eq!(state.id, "node1");
        assert_eq!(state.position, (0.0, 0.0));
        assert_eq!(state.size, (200.0, 150.0));
        assert!(!state.selected);
        assert!(!state.minimized);
    }

    #[test]
    fn test_node_state_builder() {
        let state = NodeState::new("node1".to_string())
            .with_position(100.0, 200.0)
            .with_size(300.0, 400.0)
            .with_selected(true)
            .with_minimized(true);

        assert_eq!(state.position, (100.0, 200.0));
        assert_eq!(state.size, (300.0, 400.0));
        assert!(state.selected);
        assert!(state.minimized);
    }

    #[test]
    fn test_node_new() {
        let node = Node::new("node1".to_string(), "My Node".to_string());
        assert_eq!(node.id, "node1");
        assert_eq!(node.title, "My Node");
        assert_eq!(node.position, (0.0, 0.0));
        assert!(!node.selected);
    }

    #[test]
    fn test_node_builder() {
        let node = Node::new("node1".to_string(), "My Node".to_string())
            .with_position(50.0, 50.0)
            .with_type("custom".to_string())
            .add_port(NodePort::new(
                "out1".to_string(),
                "output".to_string(),
                "Value".to_string(),
                PortPosition::Right,
            ));

        assert_eq!(node.position, (50.0, 50.0));
        assert_eq!(node.node_type, "custom");
        assert_eq!(node.ports.len(), 1);
        assert_eq!(node.ports[0].port_id, "out1");
    }

    #[test]
    fn test_effective_height() {
        let mut node = Node::new("node1".to_string(), "Node".to_string());
        node.ports = vec![
            NodePort::new("p1".to_string(), "input".to_string(), "P1".to_string(), PortPosition::Left),
            NodePort::new("p2".to_string(), "input".to_string(), "P2".to_string(), PortPosition::Left),
        ];

        assert!(!node.minimized);
        assert!(node.effective_height() > 150.0);

        node.minimized = true;
        assert_eq!(node.effective_height(), 40.0);
    }

    #[test]
    fn test_port_position_name() {
        assert_eq!(PortPosition::Top.name(), "top");
        assert_eq!(PortPosition::Bottom.name(), "bottom");
        assert_eq!(PortPosition::Left.name(), "left");
        assert_eq!(PortPosition::Right.name(), "right");
    }

    #[test]
    fn test_from_node_state() {
        let state = NodeState::new("node1".to_string())
            .with_position(10.0, 20.0)
            .with_selected(true);

        let node: Node = state.into();
        assert_eq!(node.id, "node1");
        assert_eq!(node.position, (10.0, 20.0));
        assert!(node.selected);
    }
}
