// node_graph/mod.rs
// Node Graph System module

pub mod canvas;
pub mod connection;
pub mod history;
pub mod minimap;
pub mod node;
pub mod plugins;
pub mod port;
pub mod registry;
pub mod serialization;
pub mod value;
pub mod viewport;

pub use canvas::NodeGraphCanvas;
pub use connection::{Connection, ConnectionId, ConnectionLine};
pub use history::{HistoryAction, HistoryState, SerializedConnectionState, SerializedNodeState};
pub use minimap::NodeGraphMinimap;
pub use node::{Node, NodeId, NodePlugin, NodeState, NodeType};
pub use plugins::*;
pub use port::{Port, PortId, PortType};
pub use registry::{list_all_plugins, NodeRegistry, RegistryEntry};
pub use serialization::SerializedNodeGraph;
pub use value::NodeValue;
pub use viewport::Viewport;
