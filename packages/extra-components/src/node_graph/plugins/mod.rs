// node_graph/plugins/mod.rs
// Default node plugin implementations

pub mod constant;
pub mod input_node;
pub mod output_node;
pub mod processor;

use std::sync::Arc;

pub use constant::*;
pub use input_node::*;
pub use output_node::*;
pub use processor::*;

use crate::node_graph::{
    node::NodeType,
    registry::{RegistryEntry, register_node_plugin},
};

/// Register all default node plugins
pub fn register_default_plugins() {
    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("constant", "number"),
        plugin: Arc::new(crate::node_graph::constant::ConstantNode::numeric(
            "number", 0.0,
        )),
        category: "constant".to_string(),
        icon: "number".to_string(),
    });

    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("constant", "string"),
        plugin: Arc::new(crate::node_graph::constant::ConstantNode::string(
            "string", "",
        )),
        category: "constant".to_string(),
        icon: "text".to_string(),
    });

    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("constant", "boolean"),
        plugin: Arc::new(crate::node_graph::constant::ConstantNode::boolean(
            "boolean", false,
        )),
        category: "constant".to_string(),
        icon: "boolean".to_string(),
    });

    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("input", "number"),
        plugin: Arc::new(crate::node_graph::input_node::InputNode::numeric("number")),
        category: "input".to_string(),
        icon: "number".to_string(),
    });

    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("input", "string"),
        plugin: Arc::new(crate::node_graph::input_node::InputNode::string("string")),
        category: "input".to_string(),
        icon: "text".to_string(),
    });

    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("input", "boolean"),
        plugin: Arc::new(crate::node_graph::input_node::InputNode::boolean("boolean")),
        category: "input".to_string(),
        icon: "boolean".to_string(),
    });

    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("output", "number"),
        plugin: Arc::new(crate::node_graph::output_node::OutputNode::numeric(
            "number",
        )),
        category: "output".to_string(),
        icon: "number".to_string(),
    });

    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("output", "string"),
        plugin: Arc::new(crate::node_graph::output_node::OutputNode::string("string")),
        category: "output".to_string(),
        icon: "text".to_string(),
    });

    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("output", "boolean"),
        plugin: Arc::new(crate::node_graph::output_node::OutputNode::boolean(
            "boolean",
        )),
        category: "output".to_string(),
        icon: "boolean".to_string(),
    });

    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("processor", "add"),
        plugin: Arc::new(crate::node_graph::processor::ProcessorNode::add()),
        category: "processor".to_string(),
        icon: "plus".to_string(),
    });

    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("processor", "subtract"),
        plugin: Arc::new(crate::node_graph::processor::ProcessorNode::subtract()),
        category: "processor".to_string(),
        icon: "minus".to_string(),
    });

    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("processor", "multiply"),
        plugin: Arc::new(crate::node_graph::processor::ProcessorNode::multiply()),
        category: "processor".to_string(),
        icon: "x".to_string(),
    });

    let _ = register_node_plugin(RegistryEntry {
        node_type: NodeType::new("processor", "divide"),
        plugin: Arc::new(crate::node_graph::processor::ProcessorNode::divide()),
        category: "processor".to_string(),
        icon: "divide".to_string(),
    });
}

lazy_static::lazy_static! {
    static ref _PLUGIN_INIT: () = {
        register_default_plugins();
    };
}
