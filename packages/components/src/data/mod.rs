//! Data display components module
//!
//! Advanced components for displaying and interacting with data,
//! including tables, trees, and supporting features.
//!
//! ## Core Components
//!
//! - [`Table`] - Full-featured data table
//! - [`Tree`] - Hierarchical tree view
//! - [`Pagination`] - Page navigation
//!
//! ## Supporting Components
//!
//! - [`Cell`] - Table cell rendering
//! - [`Column`] - Table column definitions
//! - [`Header`] - Table header component
//! - [`Node`] - Tree node representation

pub mod cell;
pub mod column;
pub mod header;
pub mod node;
pub mod pagination;
pub mod table;
pub mod tree;

// TODO: Implement these components
// pub mod collapse;
// pub mod drag;
// pub mod filter;
// pub mod selection;
// pub mod sort;
// pub mod virtual_scroll;

pub use cell::*;
pub use column::*;
pub use header::*;
pub use node::*;
pub use pagination::*;
pub use table::*;
pub use tree::*;

// TODO: Uncomment when implemented
// pub use collapse::*;
// pub use drag::*;
// pub use filter::*;
// pub use selection::*;
// pub use sort::*;
// pub use virtual_scroll::*;
