// node_graph/port.rs
// Port definition for node connections - Framework Agnostic

pub type PortId = String;

/// Port type
#[derive(Clone, Debug, PartialEq, Eq, Hash, Copy)]
pub enum PortType {
    Input,
    Output,
}

impl PortType {
    pub fn as_str(&self) -> &'static str {
        match self {
            PortType::Input => "input",
            PortType::Output => "output",
        }
    }

    pub fn is_input(&self) -> bool {
        matches!(self, PortType::Input)
    }

    pub fn is_output(&self) -> bool {
        matches!(self, PortType::Output)
    }
}

impl std::fmt::Display for PortType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Port state model
///
/// Previously a Dioxus component. Now a pure state model.
#[derive(Clone, Debug, PartialEq)]
pub struct Port {
    pub port_id: PortId,
    pub port_type: PortType,
    pub label: String,
    pub position: (f64, f64),
    pub disabled: bool,
    pub connected: bool,
    pub data_type: String,
    pub port_position_name: Option<String>,
}

impl Port {
    /// Create a new port
    pub fn new(port_id: PortId, port_type: PortType, label: String) -> Self {
        Self {
            port_id,
            port_type,
            label,
            position: (0.0, 0.0),
            disabled: false,
            connected: false,
            data_type: "any".to_string(),
            port_position_name: None,
        }
    }

    /// Set the position
    pub fn with_position(mut self, x: f64, y: f64) -> Self {
        self.position = (x, y);
        self
    }

    /// Set disabled state
    pub fn with_disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Set connected state
    pub fn with_connected(mut self, connected: bool) -> Self {
        self.connected = connected;
        self
    }

    /// Set data type
    pub fn with_data_type(mut self, data_type: String) -> Self {
        self.data_type = data_type;
        self
    }

    pub fn with_port_position_name(mut self, name: &str) -> Self {
        self.port_position_name = Some(name.to_string());
        self
    }

    /// Get the CSS class string
    pub fn class_string(&self) -> String {
        let pos_class = match &self.port_position_name {
            Some(name) => format!("hi-node-port-{}", name),
            None => String::new(),
        };
        format!(
            "hi-node-port hi-node-port-{} {} {} {}",
            self.port_type.as_str(),
            pos_class,
            if self.disabled {
                "hi-port-disabled"
            } else {
                ""
            },
            if self.connected {
                "hi-port-connected"
            } else {
                ""
            }
        )
    }

    /// Get the CSS style string for positioning
    pub fn position_style(&self) -> String {
        format!("left: {}px; top: {}px;", self.position.0, self.position.1)
    }
}

/// Events related to ports
#[derive(Clone, PartialEq, Debug)]
pub enum PortEvent {
    /// Connection requested (from_port, to_port)
    ConnectRequested(PortId, PortId),
    /// Disconnect requested
    DisconnectRequested(PortId),
    /// Port hovered
    Hover(PortId),
}

use tairitsu_vdom::{VElement, VNode, VText};

pub fn render_port(port: &Port) -> VNode {
    let mut children: Vec<VNode> = Vec::new();

    children.push(VNode::Element(
        VElement::new("div").class("hi-node-port-dot"),
    ));

    children.push(VNode::Element(
        VElement::new("span")
            .class("hi-node-port-label")
            .child(VNode::Text(VText::new(&port.label))),
    ));

    if !port.disabled {
        children.push(VNode::Element(
            VElement::new("div")
                .class("hi-node-port-connector")
                .attr("data-port-id", &port.port_id)
                .attr("data-port-type", port.port_type.as_str())
                .attr("data-action", "port-connect"),
        ));
    }

    VNode::Element(
        VElement::new("div")
            .class(port.class_string())
            .attr("data-port-id", &port.port_id)
            .attr("data-port-type", port.port_type.as_str())
            .style(port.position_style())
            .children(children),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_port_type() {
        assert_eq!(PortType::Input.as_str(), "input");
        assert_eq!(PortType::Output.as_str(), "output");

        assert!(PortType::Input.is_input());
        assert!(!PortType::Input.is_output());
        assert!(PortType::Output.is_output());
    }

    #[test]
    fn test_port_new() {
        let port = Port::new("port1".to_string(), PortType::Input, "Data".to_string());
        assert_eq!(port.port_id, "port1");
        assert_eq!(port.port_type, PortType::Input);
        assert_eq!(port.label, "Data");
        assert!(!port.disabled);
        assert!(!port.connected);
    }

    #[test]
    fn test_port_builder() {
        let port = Port::new("port1".to_string(), PortType::Output, "Out".to_string())
            .with_position(10.0, 20.0)
            .with_disabled(true)
            .with_connected(true)
            .with_data_type("number".to_string());

        assert_eq!(port.position, (10.0, 20.0));
        assert!(port.disabled);
        assert!(port.connected);
        assert_eq!(port.data_type, "number");
    }

    #[test]
    fn test_port_class_string() {
        let port = Port::new("port1".to_string(), PortType::Input, "Data".to_string())
            .with_disabled(true)
            .with_connected(true);

        let class = port.class_string();
        assert!(class.contains("hi-node-port"));
        assert!(class.contains("hi-node-port-input"));
        assert!(class.contains("hi-port-disabled"));
        assert!(class.contains("hi-port-connected"));
    }

    #[test]
    fn test_port_class_string_with_position() {
        let port = Port::new("port1".to_string(), PortType::Input, "Data".to_string())
            .with_port_position_name("left");

        let class = port.class_string();
        assert!(class.contains("hi-node-port-input"));
        assert!(class.contains("hi-node-port-left"));
    }

    #[test]
    fn test_port_position_style() {
        let port = Port::new("port1".to_string(), PortType::Input, "Data".to_string())
            .with_position(123.0, 456.0);

        let style = port.position_style();
        assert!(style.contains("left: 123px"));
        assert!(style.contains("top: 456px"));
    }
}
