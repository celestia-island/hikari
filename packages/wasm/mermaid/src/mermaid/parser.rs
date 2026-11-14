//! The top-level mermaid parser: dispatches by diagram type keyword,
//! serializes the result to JSON with a `kind` discriminator.

use super::{class_diagram, graph_parser, gantt, pie, quadrant, sequence};
use super::types::*;

use serde::Serialize;

#[derive(Serialize)]
#[serde(tag = "kind")]
enum AnyDiagram {
    #[serde(rename = "graph")]
    Graph(MermaidDiagram),
    #[serde(rename = "pie")]
    Pie(PieChart),
    #[serde(rename = "gantt")]
    Gantt(GanttChart),
    #[serde(rename = "sequence")]
    Sequence(SequenceDiagram),
    #[serde(rename = "class")]
    Class(MermaidClassDoc),
    #[serde(rename = "quadrant")]
    Quadrant(MermaidQuadrantDoc),
}

pub fn parse(source: &str) -> Result<MermaidDiagram, String> {
    graph_parser::parse(source)
}

/// Parse any supported diagram type; the JSON carries a `kind` tag.
pub fn parse_any(source: &str) -> Option<String> {
    let trimmed = source.trim();

    if trimmed.starts_with("pie") {
        return pie::parse_pie(trimmed)
            .and_then(|d| serde_json::to_string(&AnyDiagram::Pie(d)).ok());
    }
    if trimmed.starts_with("gantt") {
        return gantt::parse_gantt(trimmed)
            .and_then(|d| serde_json::to_string(&AnyDiagram::Gantt(d)).ok());
    }
    if trimmed.starts_with("sequenceDiagram") {
        return sequence::parse_sequence(trimmed)
            .and_then(|d| serde_json::to_string(&AnyDiagram::Sequence(d)).ok());
    }
    if trimmed.starts_with("classDiagram") {
        return class_diagram::parse_class_diagram(trimmed)
            .and_then(|d| serde_json::to_string(&AnyDiagram::Class(d)).ok());
    }
    if trimmed.starts_with("quadrantChart") {
        return quadrant::parse_quadrant(trimmed)
            .and_then(|d| serde_json::to_string(&AnyDiagram::Quadrant(d)).ok());
    }
    if trimmed.starts_with("graph") || trimmed.starts_with("flowchart") {
        return graph_parser::parse(trimmed)
            .ok()
            .and_then(|d| serde_json::to_string(&AnyDiagram::Graph(d)).ok());
    }
    None
}
