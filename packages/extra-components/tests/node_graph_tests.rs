// Node Graph Integration Tests
// Tests for history, serialization, and plugin systems

#[cfg(test)]
mod tests {

    use std::collections::HashMap;

    use hikari_extra_components::{
        connection::Connection,
        history::{HistoryAction, HistoryState, SerializedNodeState},
        node::NodeState,
        node_graph::NodePlugin,
        plugins::{ConstantNode, InputNode, OutputNode, ProcessorNode},
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
    fn test_history_state_push() {
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
    }

    #[test]
    fn test_history_state_undo() {
        let mut history = HistoryState::new();

        let action = HistoryAction::NodeAdd {
            id: "node1".to_string(),
            node_type: "constant".to_string(),
            position: (100.0, 100.0),
        };

        history.push(action.clone());

        let undone = history.undo();

        assert!(undone.is_some());
        assert_eq!(undone.unwrap(), action);
        assert!(!history.can_undo());
        assert!(history.can_redo());
    }

    #[test]
    fn test_history_state_redo() {
        let mut history = HistoryState::new();

        let action = HistoryAction::NodeAdd {
            id: "node1".to_string(),
            node_type: "constant".to_string(),
            position: (100.0, 100.0),
        };

        history.push(action.clone());

        let _undone = history.undo();
        let redone = history.redo();

        assert!(redone.is_some());
        let expected_inverse = action.inverse().unwrap();
        assert_eq!(redone.unwrap(), expected_inverse);
        assert!(history.can_undo());
        assert!(!history.can_redo());
    }

    #[test]
    fn test_history_state_clear() {
        let mut history = HistoryState::new();

        history.push(HistoryAction::NodeAdd {
            id: "node1".to_string(),
            node_type: "constant".to_string(),
            position: (100.0, 100.0),
        });

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
            history.push(HistoryAction::NodeAdd {
                id: format!("node{}", i),
                node_type: "constant".to_string(),
                position: (100.0 * i as f64, 100.0 * i as f64),
            });
        }

        assert_eq!(history.undo_size(), 3);
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
    fn test_serialized_node_state_conversion() {
        let node_state = NodeState::new("node1".to_string());

        let serialized = SerializedNodeState::from(node_state.clone());
        assert_eq!(serialized.id, "node1");
        assert_eq!(serialized.position, (0.0, 0.0));
        assert_eq!(serialized.size, (200.0, 150.0));
        assert!(!serialized.minimized);

        let converted: NodeState = serialized.into();
        assert_eq!(converted.id, "node1");
        assert_eq!(converted.position, (0.0, 0.0));
        assert_eq!(converted.size, (200.0, 150.0));
        assert!(!converted.minimized);
    }

    #[test]
    fn test_serialized_node_graph_initialization() {
        let graph = SerializedNodeGraph::new();

        assert_eq!(graph.version, "1.0");
        assert!(graph.nodes.is_empty());
        assert!(graph.connections.is_empty());
        assert!(graph.metadata.is_empty());
    }

    #[test]
    fn test_serialized_node_graph_from_state() {
        let mut nodes = HashMap::new();
        nodes.insert("node1".to_string(), NodeState::new("node1".to_string()));

        let connections = vec![Connection::new("node1", "out", "node2", "in")];

        let serialized = SerializedNodeGraph::from_state(&nodes, &connections);

        assert_eq!(serialized.nodes.len(), 1);
        assert_eq!(serialized.connections.len(), 1);
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
    }

    #[test]
    fn test_node_registry_global() {
        hikari_extra_components::node_graph::plugins::register_default_plugins();

        let plugins = list_all_plugins();

        assert!(!plugins.is_empty());
    }

    #[test]
    fn test_node_registry_contains_default_plugins() {
        hikari_extra_components::node_graph::plugins::register_default_plugins();

        let plugins = list_all_plugins();
        let plugin_names: Vec<_> = plugins
            .iter()
            .map(|p| p.node_type.id().to_string())
            .collect();

        assert!(plugin_names.contains(&"constant/number".to_string()));
        assert!(plugin_names.contains(&"input/number".to_string()));
        assert!(plugin_names.contains(&"output/number".to_string()));
        assert!(plugin_names.contains(&"processor/add".to_string()));
    }

    #[test]
    fn test_constant_node_plugin() {
        let plugin = ConstantNode::numeric("number", 0.0);

        let node_type = plugin.node_type();
        assert_eq!(node_type.id(), "constant/number");

        let _ = plugin.render_node(
            "const1".to_string(),
            "Constant".to_string(),
            NodeState::new("const1".to_string()),
            vec![],
        );
    }

    #[test]
    fn test_input_node_plugin() {
        let plugin = InputNode::numeric("number");

        let node_type = plugin.node_type();
        assert_eq!(node_type.id(), "input/number");

        let _ = plugin.render_node(
            "input1".to_string(),
            "Input".to_string(),
            NodeState::new("input1".to_string()),
            vec![],
        );
    }

    #[test]
    fn test_output_node_plugin() {
        let plugin = OutputNode::numeric("number");

        let node_type = plugin.node_type();
        assert_eq!(node_type.id(), "output/number");
        assert_eq!(plugin.output_type(), "number");

        let _ = plugin.render_node(
            "output1".to_string(),
            "Output".to_string(),
            NodeState::new("output1".to_string()),
            vec![],
        );
    }

    #[test]
    fn test_processor_node_plugin() {
        let plugin = ProcessorNode::add();

        let node_type = plugin.node_type();
        assert_eq!(node_type.id(), "processor/add");

        let _ = plugin.render_node(
            "proc1".to_string(),
            "Add".to_string(),
            NodeState::new("proc1".to_string()),
            vec![],
        );
    }

    #[test]
    fn test_node_state_new() {
        let state = NodeState::new("node1".to_string());

        assert_eq!(state.id, "node1");
        assert_eq!(state.position, (0.0, 0.0));
        assert_eq!(state.size, (200.0, 150.0));
        assert!(!state.selected);
        assert!(!state.minimized);
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
}
