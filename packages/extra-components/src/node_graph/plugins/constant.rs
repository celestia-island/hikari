// node_graph/plugins/constant.rs
// Constant node plugin - provides static values

use crate::node_graph::node::{NodePlugin, NodePort, NodeType, PortId, PortPosition};
use crate::node_graph::value::NodeValue;

/// Constant node plugin
///
/// Provides static/output values that don't change.
pub struct ConstantNode {
    node_type: NodeType,
    value: NodeValue,
    output_port_id: PortId,
}

impl ConstantNode {
    /// Create a new constant node
    pub fn new(name: &str, value: NodeValue) -> Self {
        let output_port_id = format!("{}_output", name);
        Self {
            node_type: NodeType::new("constant", name),
            value,
            output_port_id,
        }
    }

    /// Create a numeric constant node
    pub fn numeric(name: &str, value: f64) -> Self {
        Self::new(name, NodeValue::from(value))
    }

    /// Create a string constant node
    pub fn string(name: &str, value: &str) -> Self {
        Self::new(name, NodeValue::from(value))
    }

    /// Create a boolean constant node
    pub fn boolean(name: &str, value: bool) -> Self {
        Self::new(name, NodeValue::from(value))
    }

    /// Get the current value
    pub fn value(&self) -> &NodeValue {
        &self.value
    }

    /// Set a new value
    pub fn set_value(&mut self, value: NodeValue) {
        self.value = value;
    }
}

impl NodePlugin for ConstantNode {
    fn node_type(&self) -> NodeType {
        self.node_type.clone()
    }

    fn display_value(&self) -> Option<String> {
        Some(self.value.to_display_string())
    }

    fn default_ports(&self) -> Vec<NodePort> {
        vec![NodePort {
            port_id: self.output_port_id.clone(),
            port_type: "output".to_string(),
            label: "Value".to_string(),
            position: PortPosition::Right,
        }]
    }

    fn handle_input(&self, _port_id: PortId, _data: NodeValue) {
        // Constant nodes don't accept input
    }

    fn get_output(&self, port_id: PortId) -> Option<NodeValue> {
        if port_id == self.output_port_id {
            Some(self.value.clone())
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constant_numeric() {
        let node = ConstantNode::numeric("number", 42.0);
        assert_eq!(node.node_type().name, "number");
        assert_eq!(node.display_value(), Some("42".to_string()));
        assert_eq!(
            node.get_output("number_output".to_string()),
            Some(NodeValue::Number(42.0))
        );
    }

    #[test]
    fn test_constant_string() {
        let node = ConstantNode::string("text", "hello");
        assert_eq!(node.node_type().name, "text");
        assert_eq!(node.display_value(), Some("hello".to_string()));
        assert_eq!(
            node.get_output("text_output".to_string()),
            Some(NodeValue::Text("hello".to_string()))
        );
    }

    #[test]
    fn test_constant_boolean() {
        let node = ConstantNode::boolean("flag", true);
        assert_eq!(node.node_type().name, "flag");
        assert_eq!(node.display_value(), Some("true".to_string()));
        assert_eq!(
            node.get_output("flag_output".to_string()),
            Some(NodeValue::Boolean(true))
        );
    }

    #[test]
    fn test_set_value() {
        let mut node = ConstantNode::numeric("number", 42.0);
        node.set_value(NodeValue::Number(100.0));
        assert_eq!(
            node.get_output("number_output".to_string()),
            Some(NodeValue::Number(100.0))
        );
    }

    #[test]
    fn test_default_ports() {
        let node = ConstantNode::numeric("number", 42.0);
        let ports = node.default_ports();
        assert_eq!(ports.len(), 1);
        assert_eq!(ports[0].port_id, "number_output");
        assert_eq!(ports[0].port_type, "output");
    }
}
