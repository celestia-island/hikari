// node_graph/plugins/input_node.rs
// Input node plugin - accepts user input or external data

use dioxus::prelude::*;
use serde_json::Value;

use crate::node_graph::node::{NodePlugin, NodePort, NodeState, NodeType, PortId, PortPosition};

/// Input node plugin
pub struct InputNode {
    node_type: NodeType,
    output_port_id: PortId,
    input_type: String,
}

impl InputNode {
    /// Create a new input node
    pub fn new(name: &str, input_type: &str) -> Self {
        let output_port_id = format!("{}_output", name);
        Self {
            node_type: NodeType::new("input", name),
            output_port_id,
            input_type: input_type.to_string(),
        }
    }

    /// Create a numeric input node
    pub fn numeric(name: &str) -> Self {
        Self::new(name, "number")
    }

    /// Create a string input node
    pub fn string(name: &str) -> Self {
        Self::new(name, "text")
    }

    /// Create a boolean input node
    pub fn boolean(name: &str) -> Self {
        Self::new(name, "checkbox")
    }

    /// Get default ports for this node type
    pub fn default_ports(&self) -> Vec<NodePort> {
        vec![NodePort {
            port_id: self.output_port_id.clone(),
            port_type: "output".to_string(),
            label: "Value".to_string(),
            position: PortPosition::Right,
        }]
    }
}

impl NodePlugin for InputNode {
    fn node_type(&self) -> NodeType {
        self.node_type.clone()
    }

    fn render_node(
        &self,
        _id: String,
        _title: String,
        _state: NodeState,
        _ports: Vec<NodePort>,
    ) -> Element {
        let input_type_str = self.input_type.as_str();

        rsx! {
            div {
                class: "hi-node-input hi-node-body",
                input {
                    r#type: input_type_str,
                    class: "hi-node-input-field",
                    placeholder: "Enter value...",
                }
            }
        }
    }

    fn handle_input(&self, _port_id: PortId, _data: Value) {
        // Input nodes don't accept external input (they provide input to graph)
    }

    fn get_output(&self, _port_id: PortId) -> Option<Value> {
        // Input nodes don't have static output; their output is provided by user input
        // This would need to be connected to actual DOM input in a real implementation
        None
    }
}
