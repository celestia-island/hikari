// node_graph/plugins/input_node.rs
// Input node plugin - accepts user input or external data

use crate::node_graph::{
    node::{NodePlugin, NodePort, NodeType, PortId, PortPosition},
    value::NodeValue,
};

use tairitsu_vdom::{VElement, VNode};

/// Input node plugin
///
/// Provides input values from user interaction or external sources.
pub struct InputNode {
    node_type: NodeType,
    output_port_id: PortId,
    input_type: String,
    default_value: NodeValue,
}

impl InputNode {
    /// Create a new input node
    pub fn new(name: &str, input_type: &str) -> Self {
        let output_port_id = format!("{}_output", name);
        Self {
            node_type: NodeType::new("input", name),
            output_port_id,
            input_type: input_type.to_string(),
            default_value: Self::default_value_for_type(input_type),
        }
    }

    /// Create a new input node with default value
    pub fn with_default(name: &str, input_type: &str, default_value: NodeValue) -> Self {
        let output_port_id = format!("{}_output", name);
        Self {
            node_type: NodeType::new("input", name),
            output_port_id,
            input_type: input_type.to_string(),
            default_value,
        }
    }

    fn default_value_for_type(input_type: &str) -> NodeValue {
        match input_type {
            "number" => NodeValue::Number(0.0),
            "text" => NodeValue::Text(String::new()),
            "checkbox" => NodeValue::Boolean(false),
            _ => NodeValue::Null,
        }
    }

    /// Create a numeric input node
    pub fn numeric(name: &str) -> Self {
        Self::new(name, "number")
    }

    /// Create a numeric input node with default value
    pub fn numeric_with_default(name: &str, default: f64) -> Self {
        Self::with_default(name, "number", NodeValue::from(default))
    }

    /// Create a string input node
    pub fn string(name: &str) -> Self {
        Self::new(name, "text")
    }

    /// Create a string input node with default value
    pub fn string_with_default(name: &str, default: &str) -> Self {
        Self::with_default(name, "text", NodeValue::from(default))
    }

    /// Create a boolean input node
    pub fn boolean(name: &str) -> Self {
        Self::new(name, "checkbox")
    }

    /// Create a boolean input node with default value
    pub fn boolean_with_default(name: &str, default: bool) -> Self {
        Self::with_default(name, "checkbox", NodeValue::from(default))
    }

    /// Get the input type (e.g., "number", "text", "checkbox")
    pub fn input_type(&self) -> &str {
        &self.input_type
    }

    /// Get the default value
    pub fn default_value(&self) -> &NodeValue {
        &self.default_value
    }
}

impl NodePlugin for InputNode {
    fn node_type(&self) -> NodeType {
        self.node_type.clone()
    }

    fn label(&self) -> String {
        format!("Input: {}", self.input_type)
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
        // Input nodes don't have input ports (only output)
    }

    fn get_output(&self, port_id: PortId) -> Option<NodeValue> {
        if port_id == self.output_port_id {
            Some(self.default_value.clone())
        } else {
            None
        }
    }

    fn render_body(&self) -> VNode {
        let value_str = self.default_value.to_display_string();
        VNode::Element(
            VElement::new("div")
                .class("hi-node-input hi-node-body")
                .attr("data-node-type", "input")
                .child(VNode::Element(
                    VElement::new("input")
                        .attr("data-node-input", "true")
                        .attr("type", &self.input_type)
                        .attr("placeholder", "Enter value...")
                        .attr("value", &value_str),
                )),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_input_numeric() {
        let node = InputNode::numeric("number");
        assert_eq!(node.node_type().name, "number");
        assert_eq!(node.input_type(), "number");
        assert_eq!(
            node.get_output("number_output".to_string()),
            Some(NodeValue::Number(0.0))
        );
    }

    #[test]
    fn test_input_numeric_with_default() {
        let node = InputNode::numeric_with_default("number", 42.0);
        assert_eq!(
            node.get_output("number_output".to_string()),
            Some(NodeValue::Number(42.0))
        );
    }

    #[test]
    fn test_input_string() {
        let node = InputNode::string("text");
        assert_eq!(node.input_type(), "text");
        assert_eq!(
            node.get_output("text_output".to_string()),
            Some(NodeValue::Text(String::new()))
        );
    }

    #[test]
    fn test_input_boolean() {
        let node = InputNode::boolean("flag");
        assert_eq!(node.input_type(), "checkbox");
        assert_eq!(
            node.get_output("flag_output".to_string()),
            Some(NodeValue::Boolean(false))
        );
    }

    #[test]
    fn test_default_ports() {
        let node = InputNode::numeric("number");
        let ports = node.default_ports();
        assert_eq!(ports.len(), 1);
        assert_eq!(ports[0].port_type, "output");
    }
}
