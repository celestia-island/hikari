// node_graph/mod.rs
// Node Graph System module

pub mod canvas;
pub mod connection;
pub mod history;
pub mod minimap;
pub mod node;
pub mod port;
pub mod registry;
pub mod serialization;
pub mod viewport;

pub use canvas::NodeGraphCanvas;
pub use connection::{Connection, ConnectionId, ConnectionLine};
pub use history::{HistoryAction, HistoryState};
pub use minimap::NodeGraphMinimap;
pub use node::{Node, NodeId, NodeState, NodeType};
pub use port::{Port, PortId, PortType};
pub use registry::{NodeRegistry, RegistryEntry, list_all_plugins};
pub use serialization::SerializedNodeGraph;
pub use viewport::Viewport;
