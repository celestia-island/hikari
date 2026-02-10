// node_graph/plugins/input_node.rs
// Input node plugin - accepts user input or external data

use serde_json::Value;

use dioxus::prelude::*;

use crate::node_graph::node::{NodePlugin, NodePort, NodeState, NodeType, PortId, PortPosition};

/// Input node plugin
pub struct InputNode {
    node_type: NodeType,
    output_port_id: PortId,
    input_type: String,
    default_value: Value,
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
    pub fn with_default(name: &str, input_type: &str, default_value: Value) -> Self {
        let output_port_id = format!("{}_output", name);
        Self {
            node_type: NodeType::new("input", name),
            output_port_id,
            input_type: input_type.to_string(),
            default_value,
        }
    }

    fn default_value_for_type(input_type: &str) -> Value {
        match input_type {
            "number" => Value::Number(serde_json::Number::from(0)),
            "text" => Value::String(String::new()),
            "checkbox" => Value::Bool(false),
            _ => Value::Null,
        }
    }

    /// Create a numeric input node
    pub fn numeric(name: &str) -> Self {
        Self::new(name, "number")
    }

    /// Create a numeric input node with default value
    pub fn numeric_with_default(name: &str, default: f64) -> Self {
        Self::with_default(
            name,
            "number",
            Value::Number(serde_json::Number::from_f64(default).unwrap()),
        )
    }

    /// Create a string input node
    pub fn string(name: &str) -> Self {
        Self::new(name, "text")
    }

    /// Create a string input node with default value
    pub fn string_with_default(name: &str, default: &str) -> Self {
        Self::with_default(name, "text", Value::String(default.to_string()))
    }

    /// Create a boolean input node
    pub fn boolean(name: &str) -> Self {
        Self::new(name, "checkbox")
    }

    /// Create a boolean input node with default value
    pub fn boolean_with_default(name: &str, default: bool) -> Self {
        Self::with_default(name, "checkbox", Value::Bool(default))
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
            move |val: Value| {
                if let Err(e) = store_node_value(node_id.clone(), output_port_id.clone(), val) {
                    #[cfg(target_arch = "wasm32")]
                    web_sys::console::error_1(&format!("Failed to store node value: {}", e).into());
                    #[cfg(not(target_arch = "wasm32"))]
                    eprintln!("Failed to store node value: {}", e);
                }
            }
        };

        let initial_value = match &self.default_value {
            Value::Number(n) => n.to_string(),
            Value::String(s) => s.clone(),
            Value::Bool(b) => b.to_string(),
            Value::Null => String::new(),
            _ => String::new(),
        };

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
                                    Some(Value::Number(
                                        serde_json::Number::from_f64(num).unwrap()
                                    ))
                                } else {
                                    None
                                }
                            }
                            "text" => Some(Value::String(new_value)),
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

    fn handle_input(&self, _port_id: PortId, _data: Value) {
        // Input nodes don't accept external input (they provide input to graph)
    }

    fn get_output(&self, port_id: PortId) -> Option<Value> {
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
fn store_node_value(node_id: String, port_id: String, value: Value) -> Result<(), String> {
    use wasm_bindgen::JsCast;
    use web_sys::{window, Object};

    let win = window().map_err(|e| format!("Failed to get window: {:?}", e))?;

    // Get or create the global node values object
    let node_values = if let Some(obj) = win.get("hikariNodeValues") {
        obj.dyn_into::<Object>().map_err(|e| format!("Failed to cast to Object: {:?}", e))?
    } else {
        Object::new()
    };

    // Get or create the node's value object
    let node_obj = if js_sys::Reflect::has(&node_values, &node_id.into()).unwrap_or(false) {
        js_sys::Reflect::get(&node_values, &node_id.into())
            .map_err(|e| format!("Failed to get node object: {:?}", e))?
            .dyn_into::<Object>()
            .map_err(|e| format!("Failed to cast node object to Object: {:?}", e))?
    } else {
        Object::new()
    };

    // Convert serde_json::Value to JS value
    let value_js = match value {
        Value::Null => js_sys::JsValue::null(),
        Value::Bool(b) => js_sys::JsValue::from_bool(b),
        Value::Number(n) => {
            if let Some(u) = n.as_u64() {
                js_sys::JsValue::from_f64(u as f64)
            } else if let Some(i) = n.as_i64() {
                js_sys::JsValue::from_f64(i as f64)
            } else {
                js_sys::JsValue::from_f64(n.as_f64().unwrap_or(0.0))
            }
        }
        Value::String(s) => js_sys::JsValue::from_str(&s),
        Value::Array(_) | Value::Object(_) => {
            // For complex types, serialize to JSON string then parse
            let json_str = serde_json::to_string(&value)
                .map_err(|e| format!("Failed to serialize value: {:?}", e))?;
            js_sys::JsValue::from_str(&json_str)
        }
    };

    js_sys::Reflect::set(&node_obj, &port_id.into(), &value_js)
        .map_err(|e| format!("Failed to set value: {:?}", e))?;

    js_sys::Reflect::set(&node_values, &node_id.into(), &node_obj.into())
        .map_err(|e| format!("Failed to set node object: {:?}", e))?;

    // Store the updated object back to global scope
    js_sys::Reflect::set(&win.into(), &"hikariNodeValues".into(), &node_values.into())
        .map_err(|e| format!("Failed to store global object: {:?}", e))?;

    Ok(())
}

/// Store a node's output value in the global registry (SSR version)
#[cfg(not(target_arch = "wasm32"))]
fn store_node_value(_node_id: String, _port_id: String, _value: Value) -> Result<(), String> {
    // On SSR, we can't store values globally
    // Return an error to indicate this isn't supported
    Err("Node value storage not supported on non-WASM targets".to_string())
}
