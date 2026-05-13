// node_graph/history.rs
// History management for undo/redo operations

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

pub type HistoryId = usize;

/// Serialized node state for history
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct SerializedNodeState {
    pub id: String,
    pub position: (f64, f64),
    pub size: (f64, f64),
    pub minimized: bool,
}

impl From<crate::node_graph::NodeState> for SerializedNodeState {
    fn from(state: crate::node_graph::NodeState) -> Self {
        Self {
            id: state.id,
            position: state.position,
            size: state.size,
            minimized: state.minimized,
        }
    }
}

impl From<SerializedNodeState> for crate::node_graph::NodeState {
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
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
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
    pub fn inverse(&self) -> Option<HistoryAction> {
        match self {
            HistoryAction::NodeAdd {
                id,
                node_type: _,
                position,
            } => Some(HistoryAction::NodeDelete {
                id: id.clone(),
                state: SerializedNodeState {
                    id: id.clone(),
                    position: *position,
                    size: (200.0, 150.0),
                    minimized: false,
                },
            }),
            HistoryAction::NodeDelete { id, state } => Some(HistoryAction::NodeAdd {
                id: id.clone(),
                node_type: "custom".to_string(),
                position: state.position,
            }),
            HistoryAction::NodeMove { id, from, to } => Some(HistoryAction::NodeMove {
                id: id.clone(),
                from: *to,
                to: *from,
            }),
            HistoryAction::ConnectionAdd {
                id,
                from_node,
                from_port,
                to_node,
                to_port,
            } => Some(HistoryAction::ConnectionDelete {
                id: id.clone(),
                state: SerializedConnectionState {
                    id: id.clone(),
                    from_node: from_node.clone(),
                    from_port: from_port.clone(),
                    to_node: to_node.clone(),
                    to_port: to_port.clone(),
                },
            }),
            HistoryAction::ConnectionDelete { id, state } => Some(HistoryAction::ConnectionAdd {
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
    pub fn new() -> Self {
        Self {
            undo_stack: VecDeque::with_capacity(100),
            redo_stack: VecDeque::with_capacity(100),
            max_size: 100,
            current_id: 0,
        }
    }

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
    pub fn current_id(&self) -> HistoryId {
        self.current_id
    }

    /// Get undo stack size
    pub fn undo_size(&self) -> usize {
        self.undo_stack.len()
    }

    /// Get redo stack size
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
