// node_graph/plugins/processor.rs
// Processor node plugin - performs data transformations

use crate::node_graph::{
    node::{NodePlugin, NodePort, NodeType, PortId, PortPosition},
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
///
/// Performs arithmetic operations on input values.
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

    /// Get the operation type
    pub fn operation(&self) -> ProcessorOperation {
        self.operation
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

    fn label(&self) -> String {
        self.operation.as_str().to_string()
    }

    fn default_ports(&self) -> Vec<NodePort> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_processor_add() {
        let node = ProcessorNode::add();
        assert_eq!(node.node_type().name, "add");
        assert_eq!(node.operation(), ProcessorOperation::Add);

        let result = node.compute(NodeValue::Number(5.0), NodeValue::Number(3.0));
        assert_eq!(result, Ok(NodeValue::Number(8.0)));
    }

    #[test]
    fn test_processor_subtract() {
        let node = ProcessorNode::subtract();
        let result = node.compute(NodeValue::Number(10.0), NodeValue::Number(3.0));
        assert_eq!(result, Ok(NodeValue::Number(7.0)));
    }

    #[test]
    fn test_processor_multiply() {
        let node = ProcessorNode::multiply();
        let result = node.compute(NodeValue::Number(4.0), NodeValue::Number(5.0));
        assert_eq!(result, Ok(NodeValue::Number(20.0)));
    }

    #[test]
    fn test_processor_divide() {
        let node = ProcessorNode::divide();
        let result = node.compute(NodeValue::Number(20.0), NodeValue::Number(4.0));
        assert_eq!(result, Ok(NodeValue::Number(5.0)));
    }

    #[test]
    fn test_processor_divide_by_zero() {
        let node = ProcessorNode::divide();
        let result = node.compute(NodeValue::Number(10.0), NodeValue::Number(0.0));
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Division by zero");
    }

    #[test]
    fn test_processor_invalid_input() {
        let node = ProcessorNode::add();
        let result = node.compute(NodeValue::Text("hello".to_string()), NodeValue::Number(3.0));
        assert!(result.is_err());
    }

    #[test]
    fn test_operation_as_str() {
        assert_eq!(ProcessorOperation::Add.as_str(), "+");
        assert_eq!(ProcessorOperation::Subtract.as_str(), "-");
        assert_eq!(ProcessorOperation::Multiply.as_str(), "×");
        assert_eq!(ProcessorOperation::Divide.as_str(), "÷");
    }

    #[test]
    fn test_default_ports() {
        let node = ProcessorNode::add();
        let ports = node.default_ports();
        assert_eq!(ports.len(), 3);

        // Should have 2 input ports and 1 output port
        let input_ports: Vec<_> = ports.iter().filter(|p| p.port_type == "input").collect();
        let output_ports: Vec<_> = ports.iter().filter(|p| p.port_type == "output").collect();

        assert_eq!(input_ports.len(), 2);
        assert_eq!(output_ports.len(), 1);
    }
}
