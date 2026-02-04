// node_graph/registry.rs
// Node registry for plugin-based node system

use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
};

use dioxus::prelude::*;

use crate::node_graph::node::{NodePlugin, NodeType};

/// Node registry entry
#[derive(Clone)]
pub struct RegistryEntry {
    pub node_type: NodeType,
    pub plugin: Arc<dyn NodePlugin>,
    pub category: String,
    pub icon: String,
}

/// Node registry for managing node plugins
pub struct NodeRegistry {
    entries: RwLock<HashMap<String, RegistryEntry>>,
}

impl Default for NodeRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl NodeRegistry {
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
        }
    }

    /// Register a node plugin
    pub fn register(&self, entry: RegistryEntry) -> Result<(), String> {
        let mut entries = self.entries.write().unwrap();
        let node_id = entry.node_type.id();

        if entries.contains_key(&node_id) {
            return Err(format!("Node type {} already registered", node_id));
        }

        entries.insert(node_id, entry);
        Ok(())
    }

    /// Get node plugin by type
    pub fn get(&self, node_type: &str) -> Option<RegistryEntry> {
        let entries = self.entries.read().unwrap();
        entries.get(node_type).cloned()
    }

    /// List all registered nodes
    pub fn list_all(&self) -> Vec<RegistryEntry> {
        let entries = self.entries.read().unwrap();
        entries.values().cloned().collect()
    }

    /// List nodes by category
    pub fn list_by_category(&self, category: &str) -> Vec<RegistryEntry> {
        let entries = self.entries.read().unwrap();
        entries
            .values()
            .filter(|e| e.category == category)
            .cloned()
            .collect()
    }
}

lazy_static::lazy_static! {
    /// Global node registry instance
    pub static ref GLOBAL_NODE_REGISTRY: NodeRegistry = NodeRegistry::new();
}

/// Register a node plugin globally
pub fn register_node_plugin(entry: RegistryEntry) -> Result<(), String> {
    GLOBAL_NODE_REGISTRY.register(entry)
}

/// Get a node plugin globally
pub fn get_node_plugin(node_type: &str) -> Option<RegistryEntry> {
    GLOBAL_NODE_REGISTRY.get(node_type)
}

/// List all registered node plugins
pub fn list_all_plugins() -> Vec<RegistryEntry> {
    GLOBAL_NODE_REGISTRY.list_all()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::node_graph::plugins::{ConstantNode, InputNode, ProcessorNode};

    #[test]
    fn test_registry_initialization() {
        let registry = NodeRegistry::new();
        assert_eq!(registry.list_all().len(), 0);
    }

    #[test]
    fn test_registry_default() {
        let registry = NodeRegistry::default();
        assert_eq!(registry.list_all().len(), 0);
    }

    #[test]
    fn test_register_single_plugin() {
        let registry = NodeRegistry::new();
        let plugin = ConstantNode::numeric("number", 0.0);

        let entry = RegistryEntry {
            node_type: plugin.node_type(),
            plugin: std::sync::Arc::new(plugin),
            category: "constant".to_string(),
            icon: "number".to_string(),
        };

        let result = registry.register(entry.clone());
        assert!(result.is_ok());
        assert_eq!(registry.list_all().len(), 1);
    }

    #[test]
    fn test_register_duplicate_plugin() {
        let registry = NodeRegistry::new();
        let plugin = ConstantNode::numeric("number", 0.0);

        let entry = RegistryEntry {
            node_type: plugin.node_type(),
            plugin: std::sync::Arc::new(plugin),
            category: "constant".to_string(),
            icon: "number".to_string(),
        };

        let result1 = registry.register(entry.clone());
        assert!(result1.is_ok());

        let result2 = registry.register(entry);
        assert!(result2.is_err());
        assert!(result2.unwrap_err().contains("already registered"));
        assert_eq!(registry.list_all().len(), 1);
    }

    #[test]
    fn test_get_plugin() {
        let registry = NodeRegistry::new();
        let plugin = ConstantNode::numeric("number", 0.0);

        let entry = RegistryEntry {
            node_type: plugin.node_type(),
            plugin: std::sync::Arc::new(plugin),
            category: "constant".to_string(),
            icon: "number".to_string(),
        };

        registry.register(entry.clone()).unwrap();

        let retrieved = registry.get("constant/number");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().category, "constant");
    }

    #[test]
    fn test_get_nonexistent_plugin() {
        let registry = NodeRegistry::new();
        let retrieved = registry.get("nonexistent");
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_list_all_plugins() {
        let registry = NodeRegistry::new();

        let const_plugin = ConstantNode::numeric("number", 0.0);
        let const_entry = RegistryEntry {
            node_type: const_plugin.node_type(),
            plugin: std::sync::Arc::new(const_plugin),
            category: "constant".to_string(),
            icon: "number".to_string(),
        };

        let input_plugin = InputNode::numeric("number");
        let input_entry = RegistryEntry {
            node_type: input_plugin.node_type(),
            plugin: std::sync::Arc::new(input_plugin),
            category: "input".to_string(),
            icon: "number".to_string(),
        };

        registry.register(const_entry).unwrap();
        registry.register(input_entry).unwrap();

        let all = registry.list_all();
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn test_list_by_category() {
        let registry = NodeRegistry::new();

        let const_plugin = ConstantNode::numeric("number", 0.0);
        let const_entry = RegistryEntry {
            node_type: const_plugin.node_type(),
            plugin: std::sync::Arc::new(const_plugin),
            category: "constant".to_string(),
            icon: "number".to_string(),
        };

        let input_plugin = InputNode::numeric("number");
        let input_entry = RegistryEntry {
            node_type: input_plugin.node_type(),
            plugin: std::sync::Arc::new(input_plugin),
            category: "input".to_string(),
            icon: "number".to_string(),
        };

        registry.register(const_entry).unwrap();
        registry.register(input_entry).unwrap();

        let constants = registry.list_by_category("constant");
        assert_eq!(constants.len(), 1);
        assert_eq!(constants[0].category, "constant");

        let inputs = registry.list_by_category("input");
        assert_eq!(inputs.len(), 1);
        assert_eq!(inputs[0].category, "input");

        let nonexistent = registry.list_by_category("nonexistent");
        assert_eq!(nonexistent.len(), 0);
    }

    #[test]
    fn test_global_registry_register() {
        let plugin = ProcessorNode::add();

        let entry = RegistryEntry {
            node_type: plugin.node_type(),
            plugin: std::sync::Arc::new(plugin),
            category: "processor".to_string(),
            icon: "plus".to_string(),
        };

        let result = register_node_plugin(entry);
        assert!(result.is_ok() || result.unwrap_err().contains("already registered"));
    }

    #[test]
    fn test_global_registry_get() {
        crate::node_graph::plugins::register_default_plugins();
        let plugin = get_node_plugin("constant/number");
        assert!(plugin.is_some());
    }

    #[test]
    fn test_global_registry_list_all() {
        crate::node_graph::plugins::register_default_plugins();
        let plugins = list_all_plugins();
        assert!(!plugins.is_empty());
    }
}
