// node_graph/plugins/input_node.rs
// Input node plugin - accepts user input or external data

use dioxus::prelude::*;

use crate::node_graph::node::{NodePlugin, NodePort, NodeState, NodeType, PortId, PortPosition};
use crate::node_graph::value::NodeValue;

/// Input node plugin
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

    /// Get default ports for this node type
    pub fn default_ports(&self) -> Vec<NodePort> {
        vec![NodePort {
            port_id: self.output_port_id.clone(),
            port_type: "output".to_string(),
            label: "Value".to_string(),
            position: PortPosition::Right,
        }]
    }
}

impl NodePlugin for InputNode {
    fn node_type(&self) -> NodeType {
        self.node_type.clone()
    }

    fn render_node(
        &self,
        id: String,
        _title: String,
        _state: NodeState,
        _ports: Vec<NodePort>,
    ) -> Element {
        let input_type_str = self.input_type.clone();
        let node_id = id.clone();
        let output_port_id = self.output_port_id.clone();
        let default_value = self.default_value.clone();

        // Create a signal to store the input value
        let mut input_value = use_signal(|| default_value);

        // Create a callback to store value when changed
        let on_change = {
            let node_id = node_id.clone();
            let output_port_id = output_port_id.clone();
            move |val: NodeValue| {
                if let Err(e) = store_node_value(node_id.clone(), output_port_id.clone(), val) {
                    #[cfg(target_arch = "wasm32")]
                    web_sys::console::error_1(&format!("Failed to store node value: {}", e).into());
                    #[cfg(not(target_arch = "wasm32"))]
                    eprintln!("Failed to store node value: {}", e);
                }
            }
        };

        let initial_value = self.default_value.to_display_string();

        rsx! {
            div {
                class: "hi-node-input hi-node-body",
                input {
                    r#type: "{input_type_str}",
                    class: "hi-node-input-field",
                    placeholder: "Enter value...",
                    value: "{initial_value}",
                    oninput: move |e: Event<FormData>| {
                        let new_value = e.value();
                        let val = match input_type_str.as_str() {
                            "number" => {
                                if let Ok(num) = new_value.parse::<f64>() {
                                    Some(NodeValue::from(num))
                                } else {
                                    None
                                }
                            }
                            "text" => Some(NodeValue::from(new_value)),
                            "checkbox" => None, // Would use onchecked
                            _ => None,
                        };

                        if let Some(v) = val {
                            input_value.set(v.clone());
                            on_change(v);
                        }
                    }
                }
            }
        }
    }

    fn handle_input(&self, _port_id: PortId, _data: NodeValue) {
        // Input nodes don't accept external input (they provide input to graph)
    }

    fn get_output(&self, port_id: PortId) -> Option<NodeValue> {
        if port_id == self.output_port_id {
            // Return the stored value from the global registry
            // For now, return the default value
            // In a real implementation, this would query the node value registry
            Some(self.default_value.clone())
        } else {
            None
        }
    }
}

/// Store a node's output value in the global registry
///
/// This is a simple implementation that uses a global JavaScript object
/// to store node values. In a production system, this would use a proper
/// state management system.
#[cfg(target_arch = "wasm32")]
fn store_node_value(node_id: String, port_id: String, value: NodeValue) -> Result<(), String> {
    use js_sys::Object;
    use wasm_bindgen::JsValue;
    use web_sys::window;

    let win = window().ok_or_else(|| "Failed to get window".to_string())?;

    // Get or create the global node values object
    let storage_key = "hikariNodeValues";
    let node_values =
        if let Some(obj) = js_sys::Reflect::get(&win.clone().into(), &storage_key.into()).ok() {
            if obj.is_object() {
                obj.into()
            } else {
                Object::new()
            }
        } else {
            Object::new()
        };

    // Get or create the node's value object
    let node_obj = if js_sys::Reflect::has(&node_values, &node_id.clone().into()).unwrap_or(false) {
        js_sys::Reflect::get(&node_values, &node_id.clone().into())
            .map_err(|e| format!("Failed to get node object: {:?}", e))?
            .into()
    } else {
        Object::new()
    };

    // Convert NodeValue to JS value
    let value_js: JsValue = match value {
        NodeValue::Null => JsValue::null(),
        NodeValue::Boolean(b) => JsValue::from_bool(b),
        NodeValue::Number(n) => JsValue::from_f64(n),
        NodeValue::Text(s) => JsValue::from_str(&s),
    };

    js_sys::Reflect::set(&node_obj, &port_id.into(), &value_js)
        .map_err(|e| format!("Failed to set value: {:?}", e))?;

    js_sys::Reflect::set(&node_values, &node_id.into(), &node_obj.into())
        .map_err(|e| format!("Failed to set node object: {:?}", e))?;

    // Store the updated object back to global scope
    js_sys::Reflect::set(
        &win.clone().into(),
        &storage_key.into(),
        &node_values.into(),
    )
    .map_err(|e| format!("Failed to store global object: {:?}", e))?;

    Ok(())
}

/// Store a node's output value in the global registry (SSR version)
#[cfg(not(target_arch = "wasm32"))]
fn store_node_value(_node_id: String, _port_id: String, _value: NodeValue) -> Result<(), String> {
    // On SSR, we can't store values globally
    // Return an error to indicate this isn't supported
    Err("Node value storage not supported on non-WASM targets".to_string())
}
