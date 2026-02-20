// node_graph/plugins/processor.rs
// Processor node plugin - performs data transformations

use dioxus::prelude::*;

use crate::node_graph::{
    node::{NodePlugin, NodePort, NodeState, NodeType, PortId, PortPosition},
    value::NodeValue,
};

/// Processor operation types
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProcessorOperation {
    Add,
    Subtract,
    Multiply,
    Divide,
}

impl ProcessorOperation {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProcessorOperation::Add => "+",
            ProcessorOperation::Subtract => "-",
            ProcessorOperation::Multiply => "×",
            ProcessorOperation::Divide => "÷",
        }
    }
}

/// Processor node plugin
pub struct ProcessorNode {
    node_type: NodeType,
    operation: ProcessorOperation,
    input_port_a: PortId,
    input_port_b: PortId,
    output_port: PortId,
}

impl ProcessorNode {
    /// Create a new processor node
    pub fn new(name: &str, operation: ProcessorOperation) -> Self {
        let node_id = format!("processor_{}", name);
        Self {
            node_type: NodeType::new("processor", name),
            operation,
            input_port_a: format!("{}_a", node_id),
            input_port_b: format!("{}_b", node_id),
            output_port: format!("{}_output", node_id),
        }
    }

    /// Create an add node
    pub fn add() -> Self {
        Self::new("add", ProcessorOperation::Add)
    }

    /// Create a subtract node
    pub fn subtract() -> Self {
        Self::new("subtract", ProcessorOperation::Subtract)
    }

    /// Create a multiply node
    pub fn multiply() -> Self {
        Self::new("multiply", ProcessorOperation::Multiply)
    }

    /// Create a divide node
    pub fn divide() -> Self {
        Self::new("divide", ProcessorOperation::Divide)
    }

    /// Get default ports for this node type
    pub fn default_ports(&self) -> Vec<NodePort> {
        vec![
            NodePort {
                port_id: self.input_port_a.clone(),
                port_type: "input".to_string(),
                label: "A".to_string(),
                position: PortPosition::Left,
            },
            NodePort {
                port_id: self.input_port_b.clone(),
                port_type: "input".to_string(),
                label: "B".to_string(),
                position: PortPosition::Left,
            },
            NodePort {
                port_id: self.output_port.clone(),
                port_type: "output".to_string(),
                label: "Result".to_string(),
                position: PortPosition::Right,
            },
        ]
    }

    /// Perform operation
    pub fn compute(&self, a: NodeValue, b: NodeValue) -> Result<NodeValue, String> {
        let a_num = a
            .as_f64()
            .ok_or_else(|| "First input is not a number".to_string())?;
        let b_num = b
            .as_f64()
            .ok_or_else(|| "Second input is not a number".to_string())?;

        let result = match self.operation {
            ProcessorOperation::Add => a_num + b_num,
            ProcessorOperation::Subtract => a_num - b_num,
            ProcessorOperation::Multiply => a_num * b_num,
            ProcessorOperation::Divide => {
                if b_num == 0.0 {
                    return Err("Division by zero".to_string());
                }
                a_num / b_num
            }
        };

        Ok(NodeValue::from(result))
    }
}

impl NodePlugin for ProcessorNode {
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
        let operation_symbol = self.operation.as_str();

        rsx! {
            div {
                class: "hi-node-processor hi-node-body",
                div {
                    class: "hi-node-processor-operation",
                    "{operation_symbol}"
                }
            }
        }
    }

    fn handle_input(&self, _port_id: PortId, _data: NodeValue) {
        // Processor nodes need to store input values and compute output
        // This is a simplified implementation
        // In a real implementation, we would:
        // 1. Store input values in node state
        // 2. Wait for all inputs to be received
        // 3. Compute operation
        // 4. Store output
    }

    fn get_output(&self, _port_id: PortId) -> Option<NodeValue> {
        // In a real implementation, this would return computed output
        // For now, return None to indicate no output is available
        None
    }
}
