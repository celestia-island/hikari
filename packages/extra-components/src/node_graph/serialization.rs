// node_graph/serialization.rs
// Serialization and deserialization for node graph

use std::collections::HashMap;

use anyhow::Result;
use serde::{Deserialize, Serialize};

use super::connection::Connection;
use super::node::NodePlacement;
use super::value::NodeValue;

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
    #[must_use]
    pub fn new() -> Self {
        Self {
            version: "1.0".to_string(),
            nodes: Vec::new(),
            connections: Vec::new(),
            metadata: GraphMetadata::default(),
        }
    }

    /// Create from node graph state
    #[must_use]
    pub fn from_state(nodes: &HashMap<String, NodePlacement>, connections: &[Connection]) -> Self {
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
    pub fn to_json(&self) -> Result<String> {
        Ok(serde_json::to_string_pretty(self)?)
    }

    /// Convert from JSON string
    pub fn from_json(json: &str) -> Result<Self> {
        Ok(serde_json::from_str(json)?)
    }

    /// Convert to node graph state
    #[must_use]
    pub fn to_state(&self) -> (HashMap<String, NodePlacement>, Vec<Connection>) {
        let mut nodes = HashMap::new();
        let mut connections = Vec::new();

        // Deserialize nodes
        for serialized_node in &self.nodes {
            let node_state = NodePlacement {
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
                selected: false,
            };
            connections.push(connection);
        }

        (nodes, connections)
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
        nodes.insert("node1".to_string(), NodePlacement::new("node1".to_string()));

        let connections = vec![Connection::new("node1", "out", "node2", "in")];

        let serialized = SerializedNodeGraph::from_state(&nodes, &connections);
        assert_eq!(serialized.nodes.len(), 1);
        assert_eq!(serialized.connections.len(), 1);

        let (deserialized_nodes, deserialized_conns) = serialized.to_state();
        assert_eq!(deserialized_nodes.len(), 1);
        assert_eq!(deserialized_conns.len(), 1);
    }

    #[test]
    fn test_empty_graph_round_trip() {
        let original = SerializedNodeGraph::new();
        let json = original.to_json().unwrap();
        assert!(!json.is_empty());

        let restored = SerializedNodeGraph::from_json(&json).unwrap();
        assert!(restored.nodes.is_empty());
        assert!(restored.connections.is_empty());
        assert_eq!(restored.version, "1.0");
    }

    #[test]
    fn test_graph_with_nodes_no_connections() {
        let mut nodes = HashMap::new();
        nodes.insert(
            "n1".to_string(),
            NodePlacement::new("n1".to_string()).with_position(10.0, 20.0),
        );
        nodes.insert(
            "n2".to_string(),
            NodePlacement::new("n2".to_string()).with_position(300.0, 400.0),
        );

        let serialized = SerializedNodeGraph::from_state(&nodes, &[]);
        assert_eq!(serialized.nodes.len(), 2);
        assert!(serialized.connections.is_empty());

        let json = serialized.to_json().unwrap();
        let restored = SerializedNodeGraph::from_json(&json).unwrap();
        assert_eq!(restored.nodes.len(), 2);
        assert!(restored.connections.is_empty());

        let (nodes_back, conns_back) = restored.to_state();
        assert!(conns_back.is_empty());
        assert_eq!(nodes_back.get("n1").unwrap().position, (10.0, 20.0));
        assert_eq!(nodes_back.get("n2").unwrap().position, (300.0, 400.0));
    }

    #[test]
    fn test_graph_with_connections() {
        let mut nodes = HashMap::new();
        nodes.insert("a".to_string(), NodePlacement::new("a".to_string()));
        nodes.insert("b".to_string(), NodePlacement::new("b".to_string()));
        nodes.insert("c".to_string(), NodePlacement::new("c".to_string()));

        let conns = vec![
            Connection::new("a", "out", "b", "in"),
            Connection::new("b", "out", "c", "in"),
        ];

        let serialized = SerializedNodeGraph::from_state(&nodes, &conns);
        assert_eq!(serialized.connections.len(), 2);

        let json = serialized.to_json().unwrap();
        let restored = SerializedNodeGraph::from_json(&json).unwrap();
        let (_, conns_back) = restored.to_state();
        assert_eq!(conns_back.len(), 2);
        assert_eq!(conns_back[0].from_node, "a");
        assert_eq!(conns_back[0].to_node, "b");
        assert_eq!(conns_back[1].from_node, "b");
        assert_eq!(conns_back[1].to_node, "c");
    }

    #[test]
    fn test_invalid_json_returns_err() {
        let result = SerializedNodeGraph::from_json("{{{invalid");
        assert!(result.is_err());

        let result = SerializedNodeGraph::from_json("");
        assert!(result.is_err());

        let result = SerializedNodeGraph::from_json("null");
        assert!(result.is_err());

        let result = SerializedNodeGraph::from_json("42");
        assert!(result.is_err());
    }

    #[test]
    fn test_round_trip_preserves_positions() {
        let mut nodes = HashMap::new();
        nodes.insert(
            "node1".to_string(),
            NodePlacement::new("node1".to_string())
                .with_position(-500.5, 999.9)
                .with_size(100.0, 200.0),
        );

        let serialized = SerializedNodeGraph::from_state(&nodes, &[]);
        let json = serialized.to_json().unwrap();
        let restored = SerializedNodeGraph::from_json(&json).unwrap();
        let (nodes_back, _) = restored.to_state();

        let n = nodes_back.get("node1").unwrap();
        assert_eq!(n.position, (-500.5, 999.9));
        assert_eq!(n.size, (100.0, 200.0));
    }

    #[test]
    fn test_round_trip_preserves_minimized() {
        let mut nodes = HashMap::new();
        nodes.insert(
            "n1".to_string(),
            NodePlacement::new("n1".to_string()).with_minimized(true),
        );

        let serialized = SerializedNodeGraph::from_state(&nodes, &[]);
        let json = serialized.to_json().unwrap();
        let restored = SerializedNodeGraph::from_json(&json).unwrap();
        let (nodes_back, _) = restored.to_state();

        assert!(nodes_back.get("n1").unwrap().minimized);
    }

    #[test]
    fn test_metadata_default() {
        let meta = GraphMetadata::default();
        assert!(meta.author.is_none());
        assert!(meta.description.is_none());
        assert!(meta.tags.is_empty());
        assert!(meta.extra.is_empty());
    }

    #[test]
    fn test_metadata_serialization() {
        let meta = GraphMetadata {
            author: Some("test".to_string()),
            tags: vec!["tag1".to_string()],
            ..Default::default()
        };

        let json = serde_json::to_string(&meta).unwrap();
        let restored: GraphMetadata = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.author, Some("test".to_string()));
        assert_eq!(restored.tags, vec!["tag1"]);
    }

    #[test]
    fn test_to_state_preserves_connection_fields() {
        let conns = vec![Connection::new("nodeA", "portX", "nodeB", "portY")];
        let serialized = SerializedNodeGraph::from_state(&HashMap::new(), &conns);
        let (_, conns_back) = serialized.to_state();

        assert_eq!(conns_back[0].from_node, "nodeA");
        assert_eq!(conns_back[0].from_port, "portX");
        assert_eq!(conns_back[0].to_node, "nodeB");
        assert_eq!(conns_back[0].to_port, "portY");
    }

    #[test]
    fn test_serialized_node_graph_default() {
        let g = SerializedNodeGraph::default();
        assert_eq!(g.version, "1.0");
        assert!(g.nodes.is_empty());
        assert!(g.connections.is_empty());
    }

    #[test]
    fn test_json_with_missing_connections_field_is_err() {
        let json = r#"{"version":"1.0","nodes":[]}"#;
        let result = SerializedNodeGraph::from_json(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_json_with_connections_array_works() {
        let json = r#"{"version":"1.0","nodes":[],"connections":[]}"#;
        let result = SerializedNodeGraph::from_json(json);
        assert!(result.is_ok());
        assert!(result.unwrap().connections.is_empty());
    }
}
