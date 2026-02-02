// node_graph/history.rs
// History management for undo/redo operations

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

pub type HistoryId = usize;

/// History action type
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum HistoryAction {
    NodeAdd {
        id: String,
        node_type: String,
        position: (f64, f64),
    },
    NodeDelete {
        id: String,
        state: serde_json::Value,
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
        state: serde_json::Value,
    },
}

impl HistoryAction {
    /// Create the inverse action for undo
    pub fn inverse(&self) -> Option<HistoryAction> {
        match self {
            HistoryAction::NodeAdd { id, .. } => Some(HistoryAction::NodeDelete {
                id: id.clone(),
                state: serde_json::Value::Null,
            }),
            HistoryAction::NodeDelete { id, state } => {
                if let Some(obj) = state.as_object() {
                    Some(HistoryAction::NodeAdd {
                        id: id.clone(),
                        node_type: obj.get("node_type")?.as_str()?.to_string(),
                        position: (
                            obj.get("position")?.get(0)?.as_f64()?,
                            obj.get("position")?.get(1)?.as_f64()?,
                        ),
                    })
                } else {
                    None
                }
            }
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
                state: serde_json::json!({
                    "from_node": from_node,
                    "from_port": from_port,
                    "to_node": to_node,
                    "to_port": to_port,
                }),
            }),
            HistoryAction::ConnectionDelete { id, state } => {
                if let Some(obj) = state.as_object() {
                    Some(HistoryAction::ConnectionAdd {
                        id: id.clone(),
                        from_node: obj.get("from_node")?.as_str()?.to_string(),
                        from_port: obj.get("from_port")?.as_str()?.to_string(),
                        to_node: obj.get("to_node")?.as_str()?.to_string(),
                        to_port: obj.get("to_port")?.as_str()?.to_string(),
                    })
                } else {
                    None
                }
            }
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

    /// Pop and return the next action to undo
    pub fn undo(&mut self) -> Option<HistoryAction> {
        self.undo_stack.pop_back()
    }

    /// Get the next action to redo
    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    /// Pop and return the next action to redo
    pub fn redo(&mut self) -> Option<HistoryAction> {
        self.redo_stack.pop_back()
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
