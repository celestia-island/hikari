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
