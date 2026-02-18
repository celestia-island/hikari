// node_graph/serialization.rs
// Serialization and deserialization for node graph

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::{connection::Connection, node::NodeState, value::NodeValue};

/// Graph metadata - extensible key-value storage
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GraphMetadata {
    pub author: Option<String>,
    pub description: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Serialized node graph format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedNodeGraph {
    pub version: String,
    pub nodes: Vec<SerializedNode>,
    pub connections: Vec<SerializedConnection>,
    #[serde(default)]
    pub metadata: GraphMetadata,
}

/// Serialized node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedNode {
    pub id: String,
    pub node_type: String,
    pub position: (f64, f64),
    pub size: (f64, f64),
    pub selected: bool,
    pub minimized: bool,
    pub data: Option<NodeValue>,
}

/// Serialized connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SerializedConnection {
    pub id: String,
    pub from_node: String,
    pub from_port: String,
    pub to_node: String,
    pub to_port: String,
}

impl SerializedNodeGraph {
    pub fn new() -> Self {
        Self {
            version: "1.0".to_string(),
            nodes: Vec::new(),
            connections: Vec::new(),
            metadata: GraphMetadata::default(),
        }
    }

    /// Create from node graph state
    pub fn from_state(nodes: &HashMap<String, NodeState>, connections: &[Connection]) -> Self {
        let mut serialized = Self::new();

        // Serialize nodes
        for (node_id, node_state) in nodes.iter() {
            serialized.nodes.push(SerializedNode {
                id: node_id.clone(),
                node_type: "custom".to_string(),
                position: node_state.position,
                size: node_state.size,
                selected: node_state.selected,
                minimized: node_state.minimized,
                data: None,
            });
        }

        // Serialize connections
        for connection in connections.iter() {
            serialized.connections.push(SerializedConnection {
                id: connection.id.clone(),
                from_node: connection.from_node.clone(),
                from_port: connection.from_port.clone(),
                to_node: connection.to_node.clone(),
                to_port: connection.to_port.clone(),
            });
        }

        serialized
    }

    /// Convert to JSON string
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    /// Convert from JSON string
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Convert to node graph state
    pub fn to_state(&self) -> Result<(HashMap<String, NodeState>, Vec<Connection>), String> {
        let mut nodes = HashMap::new();
        let mut connections = Vec::new();

        // Deserialize nodes
        for serialized_node in &self.nodes {
            let node_state = NodeState {
                id: serialized_node.id.clone(),
                position: serialized_node.position,
                size: serialized_node.size,
                selected: serialized_node.selected,
                minimized: serialized_node.minimized,
            };
            nodes.insert(serialized_node.id.clone(), node_state);
        }

        // Deserialize connections
        for serialized_conn in &self.connections {
            let connection = Connection {
                id: serialized_conn.id.clone(),
                from_node: serialized_conn.from_node.clone(),
                from_port: serialized_conn.from_port.clone(),
                to_node: serialized_conn.to_node.clone(),
                to_port: serialized_conn.to_port.clone(),
                path: Vec::new(),
            };
            connections.push(connection);
        }

        Ok((nodes, connections))
    }
}

impl Default for SerializedNodeGraph {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialization_round_trip() {
        let original = SerializedNodeGraph::new();
        let json = original.to_json().unwrap();
        let deserialized = SerializedNodeGraph::from_json(&json).unwrap();
        assert_eq!(original.version, deserialized.version);
    }

    #[test]
    fn test_from_and_to_state() {
        let mut nodes = HashMap::new();
        nodes.insert("node1".to_string(), NodeState::new("node1".to_string()));

        let connections = vec![Connection::new("node1", "out", "node2", "in")];

        let serialized = SerializedNodeGraph::from_state(&nodes, &connections);
        assert_eq!(serialized.nodes.len(), 1);
        assert_eq!(serialized.connections.len(), 1);

        let (deserialized_nodes, deserialized_conns) = serialized.to_state().unwrap();
        assert_eq!(deserialized_nodes.len(), 1);
        assert_eq!(deserialized_conns.len(), 1);
    }
}
