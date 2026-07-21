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
/// Previously a component. Now a pure state model.
#[derive(Clone, Debug, PartialEq)]
pub struct Port {
    pub port_id: PortId,
    pub port_type: PortType,
    pub label: String,
    pub position: (f64, f64),
    pub disabled: bool,
    pub connected: bool,
    pub data_type: String,
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

    /// Get the CSS class string
    pub fn class_string(&self) -> String {
        format!(
            "hk-node-graph-port hi-node-port-{} {} {}",
            self.port_type.as_str(),
            if self.disabled { "hk-port-disabled" } else { "" },
            if self.connected { "hk-port-connected" } else { "" }
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
        assert!(class.contains("hk-node-port-input"));
        assert!(class.contains("hk-port-disabled"));
        assert!(class.contains("hk-port-connected"));
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
