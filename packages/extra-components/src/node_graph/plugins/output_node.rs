// node_graph/plugins/output_node.rs
// Output node plugin - displays output data

use crate::node_graph::{
    node::{NodePlugin, NodePort, NodeType, PortId, PortPosition},
    value::NodeValue,
};

/// Output node plugin
///
/// Receives and displays output data.
pub struct OutputNode {
    node_type: NodeType,
    input_port_id: PortId,
    output_type: String,
    current_value: NodeValue,
}

impl OutputNode {
    /// Create a new output node
    pub fn new(name: &str, output_type: &str) -> Self {
        let input_port_id = format!("{}_input", name);
        Self {
            node_type: NodeType::new("output", name),
            input_port_id,
            output_type: output_type.to_string(),
            current_value: NodeValue::Null,
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

    /// Get the current value
    pub fn current_value(&self) -> &NodeValue {
        &self.current_value
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
        Some(self.current_value.to_display_string())
    }

    fn default_ports(&self) -> Vec<NodePort> {
        vec![NodePort {
            port_id: self.input_port_id.clone(),
            port_type: "input".to_string(),
            label: "Value".to_string(),
            position: PortPosition::Left,
        }]
    }

    fn handle_input(&self, _port_id: PortId, _data: NodeValue) {
        // In a real implementation, this would store the value
        // for display. For now, we just note that the value is received.
        // The framework-agnostic approach means the framework
        // will handle the actual display update.
    }

    fn get_output(&self, _port_id: PortId) -> Option<NodeValue> {
        // Output nodes don't have output ports
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
        assert_eq!(node.current_value(), &NodeValue::Null);
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
}
