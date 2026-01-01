// hikari-extra-components/src/node_graph/port.rs
// Port component for node graph connections

use dioxus::prelude::*;

/// Port type determining input or output
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PortType {
    #[default]
    Input,
    Output,
}

/// Data type for port connections
#[derive(Clone, PartialEq, Debug, Default)]
pub enum PortDataType {
    #[default]
    Any,
    String,
    Number,
    Boolean,
    Object,
    Array,
    Custom(String),
}

impl PortDataType {
    pub fn as_str(&self) -> &str {
        match self {
            PortDataType::Any => "any",
            PortDataType::String => "string",
            PortDataType::Number => "number",
            PortDataType::Boolean => "boolean",
            PortDataType::Object => "object",
            PortDataType::Array => "array",
            PortDataType::Custom(name) => name,
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct PortProps {
    /// Unique identifier for the port
    pub id: String,

    /// ID of the parent node
    pub node_id: String,

    /// Display label for the port
    #[props(default)]
    pub label: String,

    /// Port type (input or output)
    #[props(default)]
    pub port_type: PortType,

    /// Data type this port accepts/produces
    #[props(default)]
    pub data_type: PortDataType,

    /// Whether the port has a connection
    #[props(default)]
    pub connected: bool,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Click handler for connection creation
    #[props(default)]
    pub onclick: Option<EventHandler<MouseEvent>>,

    /// Hover state change handler
    #[props(default)]
    pub onhover: Option<EventHandler<bool>>,
}

impl Default for PortProps {
    fn default() -> Self {
        Self {
            id: String::default(),
            node_id: String::default(),
            label: String::default(),
            port_type: Default::default(),
            data_type: Default::default(),
            connected: false,
            class: String::default(),
            onclick: None,
            onhover: None,
        }
    }
}

/// Port component for node graph connections
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_extra_components::node_graph::{Port, PortType, PortDataType};
///
/// fn app() -> Element {
///     rsx! {
///         Port {
///             id: "input-1",
///             node_id: "node-1",
///             label: "Input",
///             port_type: PortType::Input,
///             data_type: PortDataType::String,
///         }
///     }
/// }
/// ```
#[component]
pub fn Port(props: PortProps) -> Element {
    let port_type_class = match props.port_type {
        PortType::Input => "hikari-port-input",
        PortType::Output => "hikari-port-output",
    };

    let connected_class = if props.connected {
        "hikari-port-connected"
    } else {
        ""
    };

    let mut is_hovered = use_signal(|| false);

    rsx! {
        div {
            class: format!(
                "hikari-port {port_type_class} {connected_class} {}",
                props.class
            ),
            "data-port-id": props.id.clone(),
            "data-node-id": props.node_id.clone(),
            "data-port-type": props.port_type.as_str(),
            "data-data-type": props.data_type.as_str(),

            onmouseenter: move |_| {
                is_hovered.set(true);
                if let Some(handler) = props.onhover.as_ref() {
                    handler.call(true);
                }
            },

            onmouseleave: move |_| {
                is_hovered.set(false);
                if let Some(handler) = props.onhover.as_ref() {
                    handler.call(false);
                }
            },

            onclick: move |e| {
                if let Some(handler) = props.onclick.as_ref() {
                    handler.call(e);
                }
            },

            // Connection point (circular indicator)
            div {
                class: "hikari-port-indicator",
            }

            // Port label
            if !props.label.is_empty() {
                span {
                    class: "hikari-port-label",
                    "{props.label}"
                }
            }

            // Data type badge (shown on hover)
            if *is_hovered.read() {
                span {
                    class: "hikari-port-type-badge",
                    "{props.data_type.as_str()}"
                }
            }
        }
    }
}
