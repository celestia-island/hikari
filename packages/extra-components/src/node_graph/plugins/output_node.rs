// node_graph/plugins/output_node.rs
// Output node plugin - displays output data

use serde_json::Value;

use dioxus::prelude::*;

use crate::node_graph::node::{NodePlugin, NodePort, NodeState, NodeType, PortId, PortPosition};

/// Output node plugin
pub struct OutputNode {
    node_type: NodeType,
    input_port_id: PortId,
    output_type: String,
}

impl OutputNode {
    /// Create a new output node
    pub fn new(name: &str, output_type: &str) -> Self {
        let input_port_id = format!("{}_input", name);
        Self {
            node_type: NodeType::new("output", name),
            input_port_id,
            output_type: output_type.to_string(),
        }
    }

    /// Create a numeric output node
    pub fn numeric(name: &str) -> Self {
        Self::new(name, "number")
    }

    /// Create a string output node
    pub fn string(name: &str) -> Self {
        Self::new(name, "text")
    }

    /// Create a boolean output node
    pub fn boolean(name: &str) -> Self {
        Self::new(name, "boolean")
    }

    /// Get the output type of this node
    pub fn output_type(&self) -> &str {
        &self.output_type
    }

    /// Get default ports for this node type
    pub fn default_ports(&self) -> Vec<NodePort> {
        vec![NodePort {
            port_id: self.input_port_id.clone(),
            port_type: "input".to_string(),
            label: "Value".to_string(),
            position: PortPosition::Left,
        }]
    }
}

impl NodePlugin for OutputNode {
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
        rsx! {
            div {
                class: "hi-node-output hi-node-body",
                div {
                    class: "hi-node-output-display",
                    "Waiting for input..."
                }
            }
        }
    }

    fn handle_input(&self, _port_id: PortId, data: Value) {
        // Output nodes receive data and display it
        // In a real implementation, this would update DOM
        // For now, we'll just log it
        eprintln!("Output node received: {:?}", data);
    }

    fn get_output(&self, _port_id: PortId) -> Option<Value> {
        // Output nodes don't have output ports
        None
    }
}
