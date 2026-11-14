//! The mermaid parser core, vendored from ratatui-markdown v0.3.6 (the
//! semantic reference hikari's TS port was a mirror of), with serde
//! serialization added for the wasm component's JSON contract.
//!
//! This first wave carries the graph/flowchart parser (the pest-driven
//! mainstay); sequence/class/gantt/pie/quadrant parsers ride the next
//! wave — they need their parse functions separated from their render
//! functions in the source crate first.

pub mod types;
pub mod parser;

pub use types::*;
pub use parser::parse;
