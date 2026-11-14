//! The mermaid parser, vendored from ratatui-markdown v0.3.6, with serde
//! serialization for the wasm component's JSON contract.

pub mod types;
pub mod graph_parser;
pub mod parser;
pub mod pie;
pub mod gantt;
pub mod sequence;

pub use types::*;
pub use parser::{parse, parse_any};
