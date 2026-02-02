// node_graph/port.rs
// Port definition for node connections

use dioxus::prelude::*;

pub type PortId = String;

/// Port type
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum PortType {
    Input,
    Output,
}

impl std::fmt::Display for PortType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PortType::Input => write!(f, "input"),
            PortType::Output => write!(f, "output"),
        }
    }
}

impl PortType {
    pub fn as_str(&self) -> &'static str {
        match self {
            PortType::Input => "input",
            PortType::Output => "output",
        }
    }
}

/// Port component
#[component]
pub fn Port(
    #[props(into)] port_id: PortId,
    #[props(into)] port_type: PortType,
    #[props(into)] label: String,
    position: (f64, f64),
    #[props(default)] disabled: bool,
    #[props(default)] connected: bool,
    #[props(default)] on_connect: EventHandler<(PortId, PortId)>,
    #[props(default)] on_disconnect: EventHandler<PortId>,
) -> Element {
    rsx! {
        div {
            class: format!(
                "hi-node-graph-port hi-node-port-{} {} {}",
                port_type.as_str(),
                if disabled { "hi-port-disabled" } else { "" },
                if connected { "hi-port-connected" } else { "" }
            ),
            style: format!("left: {}px; top: {}px;", position.0, position.1),

            div { class: "hi-node-port-dot" },
            span { class: "hi-node-port-label", "{label}" },

            // Connection area
            if !disabled {
                div {
                    class: format!(
                        "hi-node-port-connector {} {}",
                        if port_type == PortType::Output { "hi-port-output" } else { "" },
                        if port_type == PortType::Input { "hi-port-input" } else { "" }
                    ),
                    "data-port-id": "{port_id}",
                    "data-port-type": "{port_type}",
                    onmousedown: move |_: dioxus::prelude::MouseEvent| {
                        let id = port_id.clone();
                        on_connect.call((id.clone(), id));
                    },
                }
            }
        }
    }
}
