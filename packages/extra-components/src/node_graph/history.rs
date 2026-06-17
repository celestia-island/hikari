// node_graph/history.rs
// History management for undo/redo operations

use std::collections::VecDeque;

use serde::{Deserialize, Serialize};

pub type HistoryId = usize;

/// Serialized node state for history
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SerializedNodeState {
    pub id: String,
    pub position: (f64, f64),
    pub size: (f64, f64),
    pub minimized: bool,
}

impl From<crate::node_graph::NodePlacement> for SerializedNodeState {
    fn from(state: crate::node_graph::NodePlacement) -> Self {
        Self {
            id: state.id,
            position: state.position,
            size: state.size,
            minimized: state.minimized,
        }
    }
}

impl From<SerializedNodeState> for crate::node_graph::NodePlacement {
    fn from(state: SerializedNodeState) -> Self {
        Self {
            id: state.id,
            position: state.position,
            size: state.size,
            selected: false,
            minimized: state.minimized,
        }
    }
}

/// Serialized connection state for history
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct SerializedConnectionState {
    pub id: String,
    pub from_node: String,
    pub from_port: String,
    pub to_node: String,
    pub to_port: String,
}

/// History action type
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum HistoryAction {
    NodeAdd {
        id: String,
        node_type: String,
        position: (f64, f64),
    },
    NodeDelete {
        id: String,
        state: SerializedNodeState,
    },
    NodeMove {
        id: String,
        from: (f64, f64),
        to: (f64, f64),
    },
    ConnectionAdd {
        id: String,
        from_node: String,
        from_port: String,
        to_node: String,
        to_port: String,
    },
    ConnectionDelete {
        id: String,
        state: SerializedConnectionState,
    },
}

impl HistoryAction {
    /// Create the inverse action for undo
    #[must_use]
    pub fn inverse(&self) -> Option<Self> {
        match self {
            Self::NodeAdd {
                id,
                node_type: _,
                position,
            } => Some(Self::NodeDelete {
                id: id.clone(),
                state: SerializedNodeState {
                    id: id.clone(),
                    position: *position,
                    size: (200.0, 150.0),
                    minimized: false,
                },
            }),
            Self::NodeDelete { id, state } => Some(Self::NodeAdd {
                id: id.clone(),
                node_type: "custom".to_string(),
                position: state.position,
            }),
            Self::NodeMove { id, from, to } => Some(Self::NodeMove {
                id: id.clone(),
                from: *to,
                to: *from,
            }),
            Self::ConnectionAdd {
                id,
                from_node,
                from_port,
                to_node,
                to_port,
            } => Some(Self::ConnectionDelete {
                id: id.clone(),
                state: SerializedConnectionState {
                    id: id.clone(),
                    from_node: from_node.clone(),
                    from_port: from_port.clone(),
                    to_node: to_node.clone(),
                    to_port: to_port.clone(),
                },
            }),
            Self::ConnectionDelete { id, state } => Some(Self::ConnectionAdd {
                id: id.clone(),
                from_node: state.from_node.clone(),
                from_port: state.from_port.clone(),
                to_node: state.to_node.clone(),
                to_port: state.to_port.clone(),
            }),
        }
    }
}

/// History state for undo/redo
#[derive(Clone, Debug)]
pub struct HistoryState {
    undo_stack: VecDeque<HistoryAction>,
    redo_stack: VecDeque<HistoryAction>,
    max_size: usize,
    current_id: HistoryId,
}

impl HistoryState {
    #[must_use]
    pub fn new() -> Self {
        Self {
            undo_stack: VecDeque::with_capacity(100),
            redo_stack: VecDeque::with_capacity(100),
            max_size: 100,
            current_id: 0,
        }
    }

    #[must_use]
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            undo_stack: VecDeque::with_capacity(capacity),
            redo_stack: VecDeque::with_capacity(capacity),
            max_size: capacity,
            current_id: 0,
        }
    }

    /// Push a new action to the history
    pub fn push(&mut self, action: HistoryAction) -> HistoryId {
        // Clear redo stack when new action is pushed
        self.redo_stack.clear();

        // Add to undo stack
        if self.undo_stack.len() >= self.max_size {
            self.undo_stack.pop_front();
        }
        self.undo_stack.push_back(action);

        // Increment ID
        self.current_id += 1;
        self.current_id
    }

    /// Get the next action to undo
    #[must_use]
    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    /// Pop and return the next action to undo, automatically pushing inverse to redo stack
    pub fn undo(&mut self) -> Option<HistoryAction> {
        let action = self.undo_stack.pop_back()?;
        if let Some(inverse) = action.inverse() {
            self.push_redo(inverse);
        }
        Some(action)
    }

    /// Get the next action to redo
    #[must_use]
    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    /// Pop and return the next action to redo, automatically pushing inverse to undo stack
    pub fn redo(&mut self) -> Option<HistoryAction> {
        let action = self.redo_stack.pop_back()?;
        if let Some(inverse) = action.inverse() {
            self.undo_stack.push_back(inverse);
        }
        Some(action)
    }

    /// Add an action to the redo stack
    pub fn push_redo(&mut self, action: HistoryAction) {
        if self.redo_stack.len() >= self.max_size {
            self.redo_stack.pop_front();
        }
        self.redo_stack.push_back(action);
    }

    /// Get current history ID
    #[must_use]
    pub const fn current_id(&self) -> HistoryId {
        self.current_id
    }

    /// Get undo stack size
    #[must_use]
    pub fn undo_size(&self) -> usize {
        self.undo_stack.len()
    }

    /// Get redo stack size
    #[must_use]
    pub fn redo_size(&self) -> usize {
        self.redo_stack.len()
    }

    /// Clear all history
    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
        self.current_id = 0;
    }
}

impl Default for HistoryState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- SerializedNodeState ---

    #[test]
    fn serialized_node_state_roundtrip() {
        use crate::node_graph::NodePlacement;
        let placement = NodePlacement {
            id: "n1".to_string(),
            position: (100.0, 200.0),
            size: (250.0, 150.0),
            selected: true,
            minimized: false,
        };
        let ser: SerializedNodeState = placement.clone().into();
        let back: NodePlacement = ser.into();
        assert_eq!(back.id, placement.id);
        assert_eq!(back.position, placement.position);
        assert_eq!(back.size, placement.size);
        assert_eq!(back.minimized, placement.minimized);
    }

    #[test]
    fn serialized_node_state_roundtrip_minimized() {
        use crate::node_graph::NodePlacement;
        let placement = NodePlacement {
            id: "min".to_string(),
            position: (0.0, 0.0),
            size: (100.0, 100.0),
            selected: false,
            minimized: true,
        };
        let ser: SerializedNodeState = placement.into();
        let back: NodePlacement = ser.into();
        assert!(back.minimized);
    }

    #[test]
    fn serialized_node_state_serde() {
        let state = SerializedNodeState {
            id: "s1".to_string(),
            position: (10.0, 20.0),
            size: (30.0, 40.0),
            minimized: true,
        };
        let json = serde_json::to_string(&state).unwrap();
        let restored: SerializedNodeState = serde_json::from_str(&json).unwrap();
        assert_eq!(restored, state);
    }

    // --- HistoryAction inverse ---

    #[test]
    fn node_add_inverse_is_node_delete() {
        let action = HistoryAction::NodeAdd {
            id: "n1".to_string(),
            node_type: "custom".to_string(),
            position: (50.0, 60.0),
        };
        let inverse = action.inverse().unwrap();
        match inverse {
            HistoryAction::NodeDelete { id, state } => {
                assert_eq!(id, "n1");
                assert_eq!(state.position, (50.0, 60.0));
            }
            _ => panic!("Expected NodeDelete"),
        }
    }

    #[test]
    fn node_delete_inverse_is_node_add() {
        let delete = HistoryAction::NodeDelete {
            id: "n2".to_string(),
            state: SerializedNodeState {
                id: "n2".to_string(),
                position: (100.0, 200.0),
                size: (150.0, 100.0),
                minimized: false,
            },
        };
        let inverse = delete.inverse().unwrap();
        match inverse {
            HistoryAction::NodeAdd { id, position, .. } => {
                assert_eq!(id, "n2");
                assert_eq!(position, (100.0, 200.0));
            }
            _ => panic!("Expected NodeAdd"),
        }
    }

    #[test]
    fn node_move_inverse_swaps_from_and_to() {
        let action = HistoryAction::NodeMove {
            id: "n3".to_string(),
            from: (0.0, 0.0),
            to: (100.0, 100.0),
        };
        let inverse = action.inverse().unwrap();
        match inverse {
            HistoryAction::NodeMove { id, from, to } => {
                assert_eq!(id, "n3");
                assert_eq!(from, (100.0, 100.0));
                assert_eq!(to, (0.0, 0.0));
            }
            _ => panic!("Expected NodeMove"),
        }
    }

    #[test]
    fn connection_add_inverse_is_connection_delete() {
        let action = HistoryAction::ConnectionAdd {
            id: "c1".to_string(),
            from_node: "A".to_string(),
            from_port: "out".to_string(),
            to_node: "B".to_string(),
            to_port: "in".to_string(),
        };
        let inverse = action.inverse().unwrap();
        match inverse {
            HistoryAction::ConnectionDelete { id, state } => {
                assert_eq!(id, "c1");
                assert_eq!(state.from_node, "A");
                assert_eq!(state.from_port, "out");
                assert_eq!(state.to_node, "B");
                assert_eq!(state.to_port, "in");
            }
            _ => panic!("Expected ConnectionDelete"),
        }
    }

    #[test]
    fn connection_delete_inverse_is_connection_add() {
        let action = HistoryAction::ConnectionDelete {
            id: "c2".to_string(),
            state: SerializedConnectionState {
                id: "c2".to_string(),
                from_node: "X".to_string(),
                from_port: "a".to_string(),
                to_node: "Y".to_string(),
                to_port: "b".to_string(),
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
                assert_eq!(id, "c2");
                assert_eq!(from_node, "X");
                assert_eq!(from_port, "a");
                assert_eq!(to_node, "Y");
                assert_eq!(to_port, "b");
            }
            _ => panic!("Expected ConnectionAdd"),
        }
    }

    #[test]
    fn inverse_is_involutive_for_move_and_connection() {
        let actions = [
            HistoryAction::NodeMove {
                id: "n".into(),
                from: (1.0, 2.0),
                to: (3.0, 4.0),
            },
            HistoryAction::ConnectionAdd {
                id: "c".into(),
                from_node: "A".into(),
                from_port: "x".into(),
                to_node: "B".into(),
                to_port: "y".into(),
            },
        ];
        for action in &actions {
            let inverse = action.inverse().unwrap();
            let double = inverse.inverse().unwrap();
            assert_eq!(action, &double);
        }
    }

    #[test]
    fn node_add_delete_roundtrip_loses_node_type() {
        // NodeAdd.inverse() → NodeDelete loses node_type by design (_ match)
        // inverse is NOT involutive for NodeAdd/NodeDelete
        let add = HistoryAction::NodeAdd {
            id: "n".into(),
            node_type: "special".into(),
            position: (1.0, 2.0),
        };
        let delete = add.inverse().unwrap();
        let restored = delete.inverse().unwrap();
        match restored {
            HistoryAction::NodeAdd { node_type, .. } => {
                assert_eq!(node_type, "custom"); // not "special"
            }
            _ => panic!("Expected NodeAdd"),
        }
    }

    // --- HistoryState ---

    #[test]
    fn history_state_new_empty() {
        let h = HistoryState::new();
        assert!(!h.can_undo());
        assert!(!h.can_redo());
        assert_eq!(h.undo_size(), 0);
        assert_eq!(h.redo_size(), 0);
    }

    #[test]
    fn history_state_default_empty() {
        let h = HistoryState::default();
        assert!(!h.can_undo());
        assert!(!h.can_redo());
    }

    #[test]
    fn history_with_capacity() {
        let h = HistoryState::with_capacity(50);
        assert_eq!(h.undo_size(), 0);
    }

    #[test]
    fn push_increments_undo_size() {
        let mut h = HistoryState::new();
        h.push(HistoryAction::NodeMove {
            id: "n".into(),
            from: (0.0, 0.0),
            to: (10.0, 10.0),
        });
        assert!(h.can_undo());
        assert_eq!(h.undo_size(), 1);
    }

    #[test]
    fn push_clears_redo_stack() {
        let mut h = HistoryState::new();
        h.push(HistoryAction::NodeMove {
            id: "a".into(),
            from: (0.0, 0.0),
            to: (1.0, 1.0),
        });
        h.undo();
        assert!(h.can_redo());
        h.push(HistoryAction::NodeMove {
            id: "b".into(),
            from: (2.0, 2.0),
            to: (3.0, 3.0),
        });
        assert!(!h.can_redo());
        assert_eq!(h.undo_size(), 1);
    }

    #[test]
    fn push_returns_incrementing_id() {
        let mut h = HistoryState::new();
        let id1 = h.push(HistoryAction::NodeMove {
            id: "n1".into(),
            from: (0.0, 0.0),
            to: (1.0, 1.0),
        });
        let id2 = h.push(HistoryAction::NodeMove {
            id: "n2".into(),
            from: (2.0, 2.0),
            to: (3.0, 3.0),
        });
        assert!(id2 > id1);
    }

    #[test]
    fn current_id_returns_latest() {
        let mut h = HistoryState::new();
        let id = h.push(HistoryAction::NodeMove {
            id: "n".into(),
            from: (0.0, 0.0),
            to: (10.0, 10.0),
        });
        assert_eq!(h.current_id(), id);
    }

    #[test]
    fn undo_returns_action() {
        let mut h = HistoryState::new();
        let action = HistoryAction::NodeMove {
            id: "n".into(),
            from: (0.0, 0.0),
            to: (100.0, 100.0),
        };
        h.push(action.clone());
        let undone = h.undo().unwrap();
        match undone {
            HistoryAction::NodeMove { id, from, to } => {
                assert_eq!(id, "n");
                assert_eq!(from, (0.0, 0.0));
                assert_eq!(to, (100.0, 100.0));
            }
            _ => panic!("Expected NodeMove"),
        }
    }

    #[test]
    fn undo_enables_redo() {
        let mut h = HistoryState::new();
        h.push(HistoryAction::NodeMove {
            id: "n".into(),
            from: (0.0, 0.0),
            to: (1.0, 1.0),
        });
        h.undo();
        assert!(h.can_redo());
        assert!(!h.can_undo());
    }

    #[test]
    fn redo_returns_inverse_of_original_action() {
        let mut h = HistoryState::new();
        let action = HistoryAction::NodeMove {
            id: "n".into(),
            from: (0.0, 0.0),
            to: (10.0, 10.0),
        };
        h.push(action);
        h.undo();
        // redo() returns the inverse action that was on the redo stack
        let redone = h.redo().unwrap();
        match redone {
            HistoryAction::NodeMove { id, from, to } => {
                assert_eq!(id, "n");
                assert_eq!(from, (10.0, 10.0));
                assert_eq!(to, (0.0, 0.0));
            }
            _ => panic!("Expected NodeMove"),
        }
    }

    #[test]
    fn redo_reenables_undo() {
        let mut h = HistoryState::new();
        h.push(HistoryAction::NodeMove {
            id: "n".into(),
            from: (0.0, 0.0),
            to: (1.0, 1.0),
        });
        h.undo();
        h.redo();
        assert!(h.can_undo());
        assert!(!h.can_redo());
    }

    #[test]
    fn undo_on_empty_returns_none() {
        let mut h = HistoryState::new();
        assert!(h.undo().is_none());
    }

    #[test]
    fn redo_on_empty_returns_none() {
        let mut h = HistoryState::new();
        assert!(h.redo().is_none());
    }

    #[test]
    fn can_undo_false_on_empty() {
        assert!(!HistoryState::new().can_undo());
    }

    #[test]
    fn can_redo_false_on_empty() {
        assert!(!HistoryState::new().can_redo());
    }

    #[test]
    fn multiple_undo_redo_cycle() {
        let mut h = HistoryState::new();
        h.push(HistoryAction::NodeMove {
            id: "1".into(),
            from: (0.0, 0.0),
            to: (1.0, 1.0),
        });
        h.push(HistoryAction::NodeMove {
            id: "2".into(),
            from: (1.0, 1.0),
            to: (2.0, 2.0),
        });
        assert_eq!(h.undo_size(), 2);

        let first = h.undo().unwrap();
        match &first {
            HistoryAction::NodeMove { id, .. } => assert_eq!(id, "2"),
            _ => panic!(),
        }
        let second = h.undo().unwrap();
        match &second {
            HistoryAction::NodeMove { id, .. } => assert_eq!(id, "1"),
            _ => panic!(),
        }
        assert!(h.undo().is_none());

        let r1 = h.redo().unwrap();
        match &r1 {
            HistoryAction::NodeMove { id, .. } => assert_eq!(id, "1"),
            _ => panic!(),
        }
        let r2 = h.redo().unwrap();
        match &r2 {
            HistoryAction::NodeMove { id, .. } => assert_eq!(id, "2"),
            _ => panic!(),
        }
    }

    #[test]
    fn clear_resets_everything() {
        let mut h = HistoryState::new();
        h.push(HistoryAction::NodeMove {
            id: "n".into(),
            from: (0.0, 0.0),
            to: (1.0, 1.0),
        });
        h.undo();
        h.clear();
        assert!(!h.can_undo());
        assert!(!h.can_redo());
        assert_eq!(h.undo_size(), 0);
        assert_eq!(h.redo_size(), 0);
        assert_eq!(h.current_id(), 0);
    }

    #[test]
    fn max_capacity_evicts_oldest() {
        let mut h = HistoryState::with_capacity(3);
        for i in 0..5 {
            h.push(HistoryAction::NodeMove {
                id: format!("n{i}"),
                from: (0.0, 0.0),
                to: (f64::from(i), f64::from(i)),
            });
        }
        assert_eq!(h.undo_size(), 3);
        let first = h.undo().unwrap();
        match &first {
            HistoryAction::NodeMove { id, .. } => assert_eq!(id, "n4"),
            _ => panic!(),
        }
    }

    #[test]
    fn undo_size_and_redo_size_tracked() {
        let mut h = HistoryState::new();
        assert_eq!(h.undo_size(), 0);
        assert_eq!(h.redo_size(), 0);

        h.push(HistoryAction::NodeMove {
            id: "n".into(),
            from: (0.0, 0.0),
            to: (1.0, 1.0),
        });
        assert_eq!(h.undo_size(), 1);
        assert_eq!(h.redo_size(), 0);

        h.undo();
        assert_eq!(h.undo_size(), 0);
        assert_eq!(h.redo_size(), 1);
    }
}
