// node_graph/node.rs
// Node definition and plugin-based node system

use dioxus::prelude::*;

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
}

/// Node plugin trait for custom node types
pub trait NodePlugin: Send + Sync {
    /// Get node type
    fn node_type(&self) -> NodeType;

    /// Render node content
    fn render_node(
        &self,
        id: NodeId,
        title: String,
        state: NodeState,
        ports: Vec<NodePort>,
    ) -> Element;

    /// Handle input port data
    fn handle_input(&self, port_id: PortId, data: serde_json::Value);

    /// Get output port data
    fn get_output(&self, port_id: PortId) -> Option<serde_json::Value>;
}

/// Node component
#[component]
pub fn Node(
    #[props(into)] id: NodeId,
    #[props(into)] title: String,
    position: (f64, f64),
    #[props(default)] selected: bool,
    #[props(default)] minimized: bool,
    #[props(into)] node_type: String,
    #[props(default)] ports: Vec<NodePort>,
    children: Element,
) -> Element {
    let style = format!(
        "position: absolute; left: {}px; top: {}px; width: {}px; height: {}px;",
        position.0,
        position.1,
        200.0,
        if minimized {
            40.0
        } else {
            150.0 + ports.len() as f64 * 30.0
        }
    );

    rsx! {
        div {
            class: format!(
                "hi-node-graph-node hi-node-{} {} {}",
                node_type,
                if selected { "hi-node-selected" } else { "" },
                if minimized { "hi-node-minimized" } else { "" }
            ),
            style: "{style}",

            // Node header
            div { class: "hi-node-header",
                span { class: "hi-node-title", "{title}" }
                if minimized {
                    span { class: "hi-node-minimized-icon", "⋯" }
                }
            }

            // Node body
            if !minimized {
                div { class: "hi-node-body",
                    {children}
                }

                // Ports
                div { class: "hi-node-ports",
                    for port in ports.iter() {
                        NodePortComponent {
                            port_id: port.port_id.clone(),
                            port_type: port.port_type.clone(),
                            label: port.label.clone(),
                            position: port.position,
                        }
                    }
                }
            }
        }
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

#[derive(Clone, Debug, PartialEq, Copy)]
pub enum PortPosition {
    Top,
    Bottom,
    Left,
    Right,
}

/// Node port component
#[component]
pub fn NodePortComponent(
    #[props(into)] port_id: PortId,
    #[props(into)] port_type: String,
    #[props(into)] label: String,
    position: PortPosition,
) -> Element {
    rsx! {
        div {
            class: format!("hi-node-port hi-node-port-{} hi-node-port-{}", port_type, port_position_name(position)),
            "data-port-id": "{port_id}",
            "data-port-type": "{port_type}",

            div { class: "hi-node-port-dot" },
            span { class: "hi-node-port-label", "{label}" },
        }
    }
}

fn port_position_name(position: PortPosition) -> &'static str {
    match position {
        PortPosition::Top => "top",
        PortPosition::Bottom => "bottom",
        PortPosition::Left => "left",
        PortPosition::Right => "right",
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
        assert_eq!(state.selected, false);
        assert_eq!(state.minimized, false);
    }

    #[test]
    fn test_node_state_clone() {
        let state = NodeState::new("node1".to_string());
        let cloned = state.clone();
        assert_eq!(state, cloned);
    }

    #[test]
    fn test_node_state_equality() {
        let state1 = NodeState::new("node1".to_string());
        let state2 = NodeState::new("node1".to_string());
        let state3 = NodeState::new("node2".to_string());

        assert_eq!(state1, state2);
        assert_ne!(state1, state3);
    }

    #[test]
    fn test_node_port_new() {
        let port = NodePort {
            port_id: "port1".to_string(),
            port_type: "output".to_string(),
            label: "Value".to_string(),
            position: PortPosition::Right,
        };

        assert_eq!(port.port_id, "port1");
        assert_eq!(port.port_type, "output");
        assert_eq!(port.label, "Value");
        assert_eq!(port.position, PortPosition::Right);
    }

    #[test]
    fn test_node_port_equality() {
        let port1 = NodePort {
            port_id: "port1".to_string(),
            port_type: "output".to_string(),
            label: "Value".to_string(),
            position: PortPosition::Right,
        };

        let port2 = NodePort {
            port_id: "port1".to_string(),
            port_type: "output".to_string(),
            label: "Value".to_string(),
            position: PortPosition::Right,
        };

        let port3 = NodePort {
            port_id: "port2".to_string(),
            port_type: "output".to_string(),
            label: "Value".to_string(),
            position: PortPosition::Right,
        };

        assert_eq!(port1, port2);
        assert_ne!(port1, port3);
    }

    #[test]
    fn test_port_position_copy() {
        let pos1 = PortPosition::Top;
        let pos2 = pos1;
        assert_eq!(pos1, pos2);
    }

    #[test]
    fn test_port_position_values() {
        assert_eq!(port_position_name(PortPosition::Top), "top");
        assert_eq!(port_position_name(PortPosition::Bottom), "bottom");
        assert_eq!(port_position_name(PortPosition::Left), "left");
        assert_eq!(port_position_name(PortPosition::Right), "right");
    }

    #[test]
    fn test_port_position_equality() {
        assert_eq!(PortPosition::Top, PortPosition::Top);
        assert_ne!(PortPosition::Top, PortPosition::Bottom);
        assert_ne!(PortPosition::Left, PortPosition::Right);
    }
}
