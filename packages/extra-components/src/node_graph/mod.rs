// node_graph/mod.rs
// Node Graph System - Framework Agnostic Data Models

pub mod connection;
pub mod history;
pub mod minimap;
pub mod node;
pub mod registry;
pub mod serialization;
pub mod value;
pub mod viewport;
pub mod plugins;

pub use connection::{Connection, ConnectionId, ConnectionLine};
pub use history::{HistoryAction, HistoryState, SerializedConnectionState, SerializedNodeState};
pub use minimap::NodeGraphMinimap;
pub use node::{Node, NodeId, NodePlugin, NodeState, NodeType, NodePort, PortPosition};
pub use plugins::*;
pub use registry::{NodeRegistry, RegistryEntry, list_all_plugins};
pub use serialization::SerializedNodeGraph;
pub use value::NodeValue;
pub use viewport::Viewport;
