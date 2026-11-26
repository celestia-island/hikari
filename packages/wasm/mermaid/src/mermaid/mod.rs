//! The mermaid parser, vendored from ratatui-markdown v0.3.6, with serde
//! serialization for the wasm component's JSON contract.
//!
//! Deliberate divergences from that vendor line (each pinned by a test in
//! `graph_parser.rs`):
//!  - `subgraph … end` clusters parse into `groups` instead of two literal
//!    nodes named "subgraph" and "end" (the vendor grammar has no block
//!    rule, so real-world diagrams rendered with the keywords painted);
//!  - bracket/quote notation is syntax, not content — `A["text"]` and
//!    `-->|"caption"|` lose their quotes like every shipped renderer does.

pub mod class_diagram;
pub mod gantt;
pub mod graph_parser;
pub mod parser;
pub mod pie;
pub mod quadrant;
pub mod sequence;
pub mod types;

pub use parser::{parse, parse_any};
pub use types::*;
