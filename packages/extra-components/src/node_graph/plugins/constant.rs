// node_graph/plugins/constant.rs
// Constant node plugin - provides static values

use dioxus::prelude::*;
use serde_json::Value;

use crate::node_graph::node::{NodePlugin, NodePort, NodeState, NodeType, PortId, PortPosition};

/// Constant node plugin
pub struct ConstantNode {
    node_type: NodeType,
    value: Value,
    output_port_id: PortId,
}

impl ConstantNode {
    /// Create a new constant node
    pub fn new(name: &str, value: Value) -> Self {
        let output_port_id = format!("{}_output", name);
        Self {
            node_type: NodeType::new("constant", name),
            value,
            output_port_id,
        }
    }

    /// Create a numeric constant node
    pub fn numeric(name: &str, value: f64) -> Self {
        Self::new(
            name,
            Value::Number(serde_json::Number::from_f64(value).unwrap()),
        )
    }

    /// Create a string constant node
    pub fn string(name: &str, value: &str) -> Self {
        Self::new(name, Value::String(value.to_string()))
    }

    /// Create a boolean constant node
    pub fn boolean(name: &str, value: bool) -> Self {
        Self::new(name, Value::Bool(value))
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

impl NodePlugin for ConstantNode {
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
        let value_str = match &self.value {
            Value::Number(n) => n.to_string(),
            Value::String(s) => s.clone(),
            Value::Bool(b) => b.to_string(),
            Value::Null => "null".to_string(),
            Value::Array(_) => "[...]".to_string(),
            Value::Object(_) => "{...}".to_string(),
        };

        rsx! {
            div {
                class: "hi-node-constant hi-node-body",
                div {
                    class: "hi-node-constant-value",
                    "{value_str}"
                }
            }
        }
    }

    fn handle_input(&self, _port_id: PortId, _data: Value) {
        // Constant nodes don't accept input
    }

    fn get_output(&self, port_id: PortId) -> Option<Value> {
        if port_id == self.output_port_id {
            Some(self.value.clone())
        } else {
            None
        }
    }
}
