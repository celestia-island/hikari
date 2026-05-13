// Node Graph Integration Tests
// Tests for history, serialization, and plugin systems

#[cfg(test)]
mod tests {

    use std::collections::HashMap;

    use hikari_extra_components::{
        connection::Connection,
        history::{HistoryAction, HistoryState, SerializedNodeState},
        node::NodeState,
        registry::list_all_plugins,
        serialization::SerializedNodeGraph,
    };

    #[test]
    fn test_history_state_initialization() {
        let history = HistoryState::new();

        assert!(!history.can_undo());
        assert!(!history.can_redo());
        assert_eq!(history.undo_size(), 0);
        assert_eq!(history.redo_size(), 0);
    }

    #[test]
    fn test_history_state_push_and_undo() {
        let mut history = HistoryState::new();

        let action = HistoryAction::NodeAdd {
            id: "node1".to_string(),
            node_type: "constant".to_string(),
            position: (100.0, 100.0),
        };

        history.push(action);

        assert!(history.can_undo());
        assert!(!history.can_redo());
        assert_eq!(history.undo_size(), 1);

        let undone = history.undo();
        assert!(undone.is_some());
        assert!(!history.can_undo());
        assert!(history.can_redo());
    }

    #[test]
    fn test_history_state_clear() {
        let mut history = HistoryState::new();

        let action = HistoryAction::NodeAdd {
            id: "node1".to_string(),
            node_type: "constant".to_string(),
            position: (100.0, 100.0),
        };

        history.push(action);
        assert!(history.can_undo());

        history.clear();
        assert!(!history.can_undo());
        assert!(!history.can_redo());
        assert_eq!(history.undo_size(), 0);
        assert_eq!(history.redo_size(), 0);
    }

    #[test]
    fn test_history_state_capacity() {
        let mut history = HistoryState::with_capacity(3);

        for i in 0..5 {
            let action = HistoryAction::NodeAdd {
                id: format!("node{}", i),
                node_type: "constant".to_string(),
                position: (100.0 * i as f64, 100.0 * i as f64),
            };
            history.push(action);
        }

        assert_eq!(history.undo_size(), 3);
        assert_eq!(history.redo_size(), 0);
    }

    #[test]
    fn test_history_action_inverse_node_add() {
        let action = HistoryAction::NodeAdd {
            id: "node1".to_string(),
            node_type: "constant".to_string(),
            position: (100.0, 100.0),
        };

        let inverse = action.inverse().unwrap();

        match inverse {
            HistoryAction::NodeDelete { id, state } => {
                assert_eq!(id, "node1");
                assert_eq!(state.position, (100.0, 100.0));
                assert_eq!(state.size, (200.0, 150.0));
                assert!(!state.minimized);
            }
            _ => panic!("Expected NodeDelete inverse"),
        }
    }

    #[test]
    fn test_history_action_inverse_node_delete() {
        let node_state = SerializedNodeState {
            id: "node1".to_string(),
            position: (150.0, 200.0),
            size: (250.0, 180.0),
            minimized: true,
        };

        let action = HistoryAction::NodeDelete {
            id: "node1".to_string(),
            state: node_state.clone(),
        };

        let inverse = action.inverse().unwrap();

        match inverse {
            HistoryAction::NodeAdd { id, position, .. } => {
                assert_eq!(id, "node1");
                assert_eq!(position, (150.0, 200.0));
            }
            _ => panic!("Expected NodeAdd inverse"),
        }
    }

    #[test]
    fn test_history_action_inverse_node_move() {
        let action = HistoryAction::NodeMove {
            id: "node1".to_string(),
            from: (100.0, 100.0),
            to: (200.0, 200.0),
        };

        let inverse = action.inverse().unwrap();

        match inverse {
            HistoryAction::NodeMove { id, from, to } => {
                assert_eq!(id, "node1");
                assert_eq!(from, (200.0, 200.0));
                assert_eq!(to, (100.0, 100.0));
            }
            _ => panic!("Expected NodeMove inverse"),
        }
    }

    #[test]
    fn test_history_action_inverse_connection_add() {
        let action = HistoryAction::ConnectionAdd {
            id: "conn1".to_string(),
            from_node: "node1".to_string(),
            from_port: "out1".to_string(),
            to_node: "node2".to_string(),
            to_port: "in1".to_string(),
        };

        let inverse = action.inverse().unwrap();

        match inverse {
            HistoryAction::ConnectionDelete { id, state } => {
                assert_eq!(id, "conn1");
                assert_eq!(state.from_node, "node1");
                assert_eq!(state.from_port, "out1");
                assert_eq!(state.to_node, "node2");
                assert_eq!(state.to_port, "in1");
            }
            _ => panic!("Expected ConnectionDelete inverse"),
        }
    }

    #[test]
    fn test_history_action_inverse_connection_delete() {
        let action = HistoryAction::ConnectionDelete {
            id: "conn1".to_string(),
            state: hikari_extra_components::history::SerializedConnectionState {
                id: "conn1".to_string(),
                from_node: "node1".to_string(),
                from_port: "out1".to_string(),
                to_node: "node2".to_string(),
                to_port: "in1".to_string(),
            },
        };

        let inverse = action.inverse().unwrap();

        match inverse {
            HistoryAction::ConnectionAdd {
                id,
                from_node,
                from_port,
                to_node,
                to_port,
            } => {
                assert_eq!(id, "conn1");
                assert_eq!(from_node, "node1");
                assert_eq!(from_port, "out1");
                assert_eq!(to_node, "node2");
                assert_eq!(to_port, "in1");
            }
            _ => panic!("Expected ConnectionAdd inverse"),
        }
    }

    #[test]
    fn test_serialized_node_state_conversion() {
        let node_state = NodeState {
            id: "node1".to_string(),
            position: (100.0, 200.0),
            size: (250.0, 180.0),
            selected: false,
            minimized: true,
        };

        let serialized = SerializedNodeState::from(node_state.clone());
        assert_eq!(serialized.id, "node1");
        assert_eq!(serialized.position, (100.0, 200.0));
        assert_eq!(serialized.size, (250.0, 180.0));
        assert!(serialized.minimized);

        let converted: NodeState = serialized.into();
        assert_eq!(converted.id, "node1");
        assert_eq!(converted.position, (100.0, 200.0));
        assert_eq!(converted.size, (250.0, 180.0));
        assert!(!converted.selected);
        assert!(converted.minimized);
    }

    #[test]
    fn test_serialized_node_graph_initialization() {
        let graph = SerializedNodeGraph::new();

        assert_eq!(graph.version, "1.0");
        assert!(graph.nodes.is_empty());
        assert!(graph.connections.is_empty());
        assert!(graph.metadata.extra.is_empty());
    }

    #[test]
    fn test_serialized_node_graph_from_state() {
        let mut nodes = HashMap::new();
        nodes.insert(
            "node1".to_string(),
            NodeState {
                id: "node1".to_string(),
                position: (100.0, 100.0),
                size: (200.0, 150.0),
                selected: false,
                minimized: false,
            },
        );

        let connections = vec![];

        let serialized = SerializedNodeGraph::from_state(&nodes, &connections);

        assert_eq!(serialized.nodes.len(), 1);
        assert_eq!(serialized.connections.len(), 0);
        assert_eq!(serialized.nodes[0].id, "node1");
    }

    #[test]
    fn test_serialized_node_graph_to_json() {
        let graph = SerializedNodeGraph::new();

        let json = graph.to_json().unwrap();

        assert!(json.contains("\"version\": \"1.0\""));
        assert!(json.contains("\"nodes\": []"));
        assert!(json.contains("\"connections\": []"));
    }

    #[test]
    fn test_serialized_node_graph_from_json() {
        let json = r#"{
            "version": "1.0",
            "nodes": [
                {
                    "id": "node1",
                    "node_type": "constant",
                    "position": [100.0, 100.0],
                    "size": [200.0, 150.0],
                    "selected": false,
                    "minimized": false,
                    "data": null
                }
            ],
            "connections": [],
            "metadata": {}
        }"#;

        let serialized = SerializedNodeGraph::from_json(json).unwrap();

        assert_eq!(serialized.version, "1.0");
        assert_eq!(serialized.nodes.len(), 1);
        assert_eq!(serialized.nodes[0].id, "node1");
        assert_eq!(serialized.nodes[0].position, (100.0, 100.0));
    }

    #[test]
    fn test_serialized_node_graph_to_state() {
        let mut nodes = HashMap::new();
        nodes.insert(
            "node1".to_string(),
            NodeState {
                id: "node1".to_string(),
                position: (100.0, 100.0),
                size: (200.0, 150.0),
                selected: false,
                minimized: false,
            },
        );

        let connections = vec![];
        let serialized = SerializedNodeGraph::from_state(&nodes, &connections);

        let (restored_nodes, restored_connections) = serialized.to_state().unwrap();

        assert_eq!(restored_nodes.len(), 1);
        assert_eq!(restored_connections.len(), 0);
        assert!(restored_nodes.contains_key("node1"));
        assert_eq!(restored_nodes["node1"].position, (100.0, 100.0));
    }

    #[test]
    fn test_serialized_node_graph_roundtrip() {
        let mut nodes = HashMap::new();
        nodes.insert(
            "node1".to_string(),
            NodeState {
                id: "node1".to_string(),
                position: (100.0, 100.0),
                size: (200.0, 150.0),
                selected: false,
                minimized: false,
            },
        );
        nodes.insert(
            "node2".to_string(),
            NodeState {
                id: "node2".to_string(),
                position: (300.0, 200.0),
                size: (150.0, 100.0),
                selected: true,
                minimized: true,
            },
        );

        let connections = vec![];

        let serialized = SerializedNodeGraph::from_state(&nodes, &connections);
        let json = serialized.to_json().unwrap();

        let deserialized_graph = SerializedNodeGraph::from_json(&json).unwrap();
        let (restored_nodes, _) = deserialized_graph.to_state().unwrap();

        assert_eq!(restored_nodes.len(), 2);
        let node1 = restored_nodes.get("node1").unwrap();
        assert_eq!(node1.position, (100.0, 100.0));
        assert_eq!(node1.size, (200.0, 150.0));
        assert!(!node1.selected);

        let node2 = restored_nodes.get("node2").unwrap();
        assert_eq!(node2.position, (300.0, 200.0));
        assert_eq!(node2.size, (150.0, 100.0));
        assert!(node2.selected);
        assert!(node2.minimized);
    }

    #[test]
    fn test_node_registry_global() {
        hikari_extra_components::node_graph::plugins::register_default_plugins();

        let plugins = list_all_plugins();

        assert!(!plugins.is_empty());
    }

    #[test]
    fn test_connection_creation() {
        let connection = Connection::new("node1", "out1", "node2", "in1");

        assert_eq!(connection.id, "node1_out1_node2_in1");
        assert_eq!(connection.from_node, "node1");
        assert_eq!(connection.from_port, "out1");
        assert_eq!(connection.to_node, "node2");
        assert_eq!(connection.to_port, "in1");
        assert!(connection.path.is_empty());
    }

    #[test]
    fn test_node_state_default() {
        let state = NodeState::new("".to_string());

        assert!(state.id.is_empty());
        assert_eq!(state.position, (0.0, 0.0));
        assert_eq!(state.size, (200.0, 150.0));
        assert!(!state.selected);
        assert!(!state.minimized);
    }

    #[test]
    fn test_node_type_default() {
        let node_type = hikari_extra_components::node::NodeType::default();

        assert!(node_type.id().is_empty());
    }
}
