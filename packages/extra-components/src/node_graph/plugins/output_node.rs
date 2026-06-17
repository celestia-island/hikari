// node_graph/plugins/output_node.rs
// Output node plugin - displays output data

use std::sync::Mutex;

use crate::node_graph::node::{NodePlugin, NodePort, NodeType, PortId, PortPosition};
use crate::node_graph::value::NodeValue;

pub struct OutputNode {
    node_type: NodeType,
    input_port_id: PortId,
    output_type: String,
    current_value: Mutex<NodeValue>,
}

impl OutputNode {
    #[must_use]
    pub fn new(name: &str, output_type: &str) -> Self {
        let input_port_id = format!("{name}_input");
        Self {
            node_type: NodeType::new("output", name),
            input_port_id,
            output_type: output_type.to_string(),
            current_value: Mutex::new(NodeValue::Null),
        }
    }

    #[must_use]
    pub fn numeric(name: &str) -> Self {
        Self::new(name, "number")
    }

    #[must_use]
    pub fn string(name: &str) -> Self {
        Self::new(name, "text")
    }

    #[must_use]
    pub fn boolean(name: &str) -> Self {
        Self::new(name, "boolean")
    }

    pub fn output_type(&self) -> &str {
        &self.output_type
    }

    pub fn current_value(&self) -> NodeValue {
        self.current_value
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }
}

impl NodePlugin for OutputNode {
    fn node_type(&self) -> NodeType {
        self.node_type.clone()
    }

    fn label(&self) -> String {
        format!("Output: {}", self.output_type)
    }

    fn display_value(&self) -> Option<String> {
        Some(
            self.current_value
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .to_display_string(),
        )
    }

    fn default_ports(&self) -> Vec<NodePort> {
        vec![NodePort {
            port_id: self.input_port_id.clone(),
            port_type: "input".to_string(),
            label: "Value".to_string(),
            position: PortPosition::Left,
        }]
    }

    fn handle_input(&self, _port_id: PortId, data: NodeValue) {
        *self.current_value.lock().unwrap_or_else(|e| e.into_inner()) = data;
    }

    fn get_output(&self, _port_id: PortId) -> Option<NodeValue> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_output_numeric() {
        let node = OutputNode::numeric("number");
        assert_eq!(node.node_type().name, "number");
        assert_eq!(node.output_type(), "number");
        assert_eq!(node.current_value(), NodeValue::Null);
    }

    #[test]
    fn test_output_string() {
        let node = OutputNode::string("text");
        assert_eq!(node.output_type(), "text");
    }

    #[test]
    fn test_output_boolean() {
        let node = OutputNode::boolean("flag");
        assert_eq!(node.output_type(), "boolean");
    }

    #[test]
    fn test_default_ports() {
        let node = OutputNode::numeric("number");
        let ports = node.default_ports();
        assert_eq!(ports.len(), 1);
        assert_eq!(ports[0].port_type, "input");
        assert_eq!(ports[0].position, PortPosition::Left);
    }

    #[test]
    fn test_handle_input_stores_value() {
        let node = OutputNode::numeric("result");
        assert_eq!(node.current_value(), NodeValue::Null);

        node.handle_input("result_input".to_string(), NodeValue::Number(42.0));
        assert_eq!(node.current_value(), NodeValue::Number(42.0));

        node.handle_input("result_input".to_string(), NodeValue::Number(99.5));
        assert_eq!(node.current_value(), NodeValue::Number(99.5));
    }

    #[test]
    fn test_display_value() {
        let node = OutputNode::numeric("out");
        assert_eq!(node.display_value(), Some("null".to_string()));

        node.handle_input("out_input".to_string(), NodeValue::Number(42.0));
        assert_eq!(node.display_value(), Some("42".to_string()));

        node.handle_input(
            "out_input".to_string(),
            NodeValue::Text("hello".to_string()),
        );
        assert_eq!(node.display_value(), Some("hello".to_string()));
    }
}
