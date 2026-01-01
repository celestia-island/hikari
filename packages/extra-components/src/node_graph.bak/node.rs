// hikari-extra-components/src/node_graph/node.rs
// Node component for node graph

use dioxus::prelude::*;
use super::Port;

/// Position in 2D space
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

impl Position {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
}

/// Size dimensions
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct Size {
    pub width: f64,
    pub height: f64,
}

impl Size {
    pub fn new(width: f64, height: f64) -> Self {
        Self { width, height }
    }
}

/// Port definition for node configuration
#[derive(Clone, PartialEq, Debug, Default)]
pub struct PortDefinition {
    pub id: String,
    pub label: String,
    pub data_type: crate::node_graph::port::PortDataType,
    pub connected: bool,
}

impl PortDefinition {
    pub fn new(id: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            data_type: Default::default(),
            connected: false,
        }
    }

    pub fn with_data_type(mut self, data_type: crate::node_graph::port::PortDataType) -> Self {
        self.data_type = data_type;
        self
    }

    pub fn with_connected(mut self, connected: bool) -> Self {
        self.connected = connected;
        self
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct NodeProps {
    /// Unique identifier for the node
    pub id: String,

    /// Node position in the graph
    pub position: Position,

    /// Node title
    #[props(default)]
    pub title: String,

    /// Custom data associated with the node
    #[props(default)]
    pub data: String,

    /// Input ports (left side)
    #[props(default)]
    pub inputs: Vec<PortDefinition>,

    /// Output ports (right side)
    #[props(default)]
    pub outputs: Vec<PortDefinition>,

    /// Whether the node is selected
    #[props(default)]
    pub selected: bool,

    /// Whether the node is being dragged
    #[props(default)]
    pub dragging: bool,

    /// Node size (optional, will auto-size if not specified)
    #[props(default)]
    pub size: Option<Size>,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Node content (custom body content)
    #[props(default)]
    pub children: Element,

    /// Click handler
    #[props(default)]
    pub onclick: Option<EventHandler<MouseEvent>>,

    /// Double click handler
    #[props(default)]
    pub ondblclick: Option<EventHandler<MouseEvent>>,

    /// Drag start handler
    #[props(default)]
    pub ondragstart: Option<EventHandler<MouseEvent>>,

    /// Drag move handler
    #[props(default)]
    pub ondrag: Option<EventHandler<MouseEvent>>,

    /// Drag end handler
    #[props(default)]
    pub ondragend: Option<EventHandler<MouseEvent>>,

    /// Port click handler
    #[props(default)]
    pub onportclick: Option<EventHandler<(String, String, crate::node_graph::port::PortType)>>,
}

impl Default for NodeProps {
    fn default() -> Self {
        Self {
            id: String::default(),
            position: Default::default(),
            title: String::default(),
            data: String::default(),
            inputs: Vec::default(),
            outputs: Vec::default(),
            selected: false,
            dragging: false,
            size: None,
            class: String::default(),
            children: VNode::empty(),
            onclick: None,
            ondblclick: None,
            ondragstart: None,
            ondrag: None,
            ondragend: None,
            onportclick: None,
        }
    }
}

/// Node component for node graph
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_extra_components::node_graph::{Node, Position, PortDefinition};
///
/// fn app() -> Element {
///     rsx! {
///         Node {
///             id: "node-1",
///             position: Position { x: 100.0, y: 100.0 },
///             title: "Process Node",
///             inputs: vec![
///                 PortDefinition::new("in-1", "Input")
///             ],
///             outputs: vec![
///                 PortDefinition::new("out-1", "Output")
///             ],
///         }
///     }
/// }
/// ```
#[component]
pub fn Node(props: NodeProps) -> Element {
    let selected_class = if props.selected {
        "hikari-node-selected"
    } else {
        ""
    };

    let dragging_class = if props.dragging {
        "hikari-node-dragging"
    } else {
        ""
    };

    let mut is_dragging = use_signal(|| false);
    let drag_start = use_signal(|| (0.0, 0.0));

    let style = if let Some(size) = props.size {
        format!(
            "left: {}px; top: {}px; width: {}px; height: {}px;",
            props.position.x,
            props.position.y,
            size.width,
            size.height
        )
    } else {
        format!(
            "left: {}px; top: {}px;",
            props.position.x,
            props.position.y
        )
    };

    rsx! {
        div {
            class: format!(
                "hikari-node {selected_class} {dragging_class} {}",
                props.class
            ),
            style: "{style}",
            "data-node-id": props.id.clone(),
            "data-selected": props.selected.to_string(),
            "data-dragging": props.dragging.to_string(),

            onclick: move |e| {
                e.stop_propagation();
                if let Some(handler) = props.onclick.as_ref() {
                    handler.call(e);
                }
            },

            ondblclick: move |e| {
                e.stop_propagation();
                if let Some(handler) = props.ondblclick.as_ref() {
                    handler.call(e);
                }
            },

            // Node header
            div {
                class: "hikari-node-header",

                onmousedown: move |e| {
                    // Only start drag on left click
                    if e.button() != 0 {
                        return;
                    }

                    is_dragging.set(true);
                    drag_start.set((e.client_x(), e.client_y()));

                    if let Some(handler) = props.ondragstart.as_ref() {
                        handler.call(e);
                    }

                    e.stop_propagation();
                },

                // Title
                div {
                    class: "hikari-node-title",
                    "{props.title}"
                }

                // Node data badge (if present)
                if !props.data.is_empty() {
                    div {
                        class: "hikari-node-data-badge",
                        title: props.data.clone(),
                        "{props.data}"
                    }
                }
            }

            // Node body with ports
            div {
                class: "hikari-node-body",

                // Input ports (left side)
                if !props.inputs.is_empty() {
                    div {
                        class: "hikari-node-inputs",

                        for input in &props.inputs {
                            Port {
                                id: input.id.clone(),
                                node_id: props.id.clone(),
                                label: input.label.clone(),
                                port_type: crate::node_graph::port::PortType::Input,
                                data_type: input.data_type.clone(),
                                connected: input.connected,
                                onclick: move |e| {
                                    e.stop_propagation();
                                    if let Some(handler) = props.onportclick.as_ref() {
                                        handler.call((
                                            input.id.clone(),
                                            props.id.clone(),
                                            crate::node_graph::port::PortType::Input
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }

                // Content area
                div {
                    class: "hikari-node-content",
                    { props.children }
                }

                // Output ports (right side)
                if !props.outputs.is_empty() {
                    div {
                        class: "hikari-node-outputs",

                        for output in &props.outputs {
                            Port {
                                id: output.id.clone(),
                                node_id: props.id.clone(),
                                label: output.label.clone(),
                                port_type: crate::node_graph::port::PortType::Output,
                                data_type: output.data_type.clone(),
                                connected: output.connected,
                                onclick: move |e| {
                                    e.stop_propagation();
                                    if let Some(handler) = props.onportclick.as_ref() {
                                        handler.call((
                                            output.id.clone(),
                                            props.id.clone(),
                                            crate::node_graph::port::PortType::Output
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Selection indicator
            if props.selected {
                div {
                    class: "hikari-node-selection-indicator"
                }
            }
        }
    }
}
