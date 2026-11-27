use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum Direction {
    #[serde(rename = "TD")]
    TopDown,
    #[serde(rename = "BT")]
    BottomUp,
    #[serde(rename = "LR")]
    LeftRight,
    #[serde(rename = "RL")]
    RightLeft,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeShape {
    Rect,
    Rounded,
    Diamond,
    Circle,
    /// `([text])` — pill/stadium.
    Stadium,
    /// `[[text]]` — subroutine (double side bars).
    Subroutine,
    /// `[(text)]` — cylinder/database.
    Cylinder,
    /// `{{text}}` — hexagon.
    Hexagon,
    /// `[/text/]` — parallelogram.
    Parallelogram,
    /// `[\\text\\]` — trapezoid (mermaid's alt form, `[\\text/]`).
    Trapezoid,
    /// `>text]` — asymmetric flag.
    Asymmetric,
    /// `(((text)))` — double circle.
    #[serde(rename = "doublecircle")]
    DoubleCircle,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct MermaidNode {
    pub id: String,
    pub label: String,
    pub shape: NodeShape,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EdgeType {
    Arrow,
    Line,
    /// `-.->` — dashed arrow.
    Dotted,
    /// `==>` — thick arrow.
    Thick,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct MermaidEdge {
    pub source: String,
    pub target: String,
    pub label: Option<String>,
    #[serde(rename = "edgeType")]
    pub edge_type: EdgeType,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct MermaidDiagram {
    /// Always "graph" — mirrors the TS MermaidGraphDoc discriminator.
    pub kind: String,
    /// "flowchart" | "state" — mirrors the TS variant flag.
    pub variant: String,
    pub direction: Direction,
    pub nodes: Vec<MermaidNode>,
    pub edges: Vec<MermaidEdge>,
    /// `subgraph` clusters. Empty for a plain graph, so the field is omitted
    /// from the JSON and every pre-cluster document keeps its exact output.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub groups: Vec<MermaidGroup>,
}

/// A `subgraph` cluster: the frame drawn around [`members`], addressable by
/// node id like mermaid's subgraphs (`C --> G` points at the frame).
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct MermaidGroup {
    /// The subgraph id — the head's identifier when it has one, else a
    /// generated `_sg<N>` (stable per parse order).
    pub id: String,
    /// Caption painted on the frame.
    pub label: String,
    /// Node ids inside the cluster, in parse order. A nested cluster's nodes
    /// also appear here, so the outer frame encloses the inner one.
    pub members: Vec<String>,
    /// Enclosing cluster id for a nested subgraph.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
}

impl MermaidDiagram {
    pub fn ensure_node(
        nodes: &mut Vec<MermaidNode>,
        map: &mut HashMap<String, usize>,
        id: &str,
        label: Option<&str>,
        shape: Option<NodeShape>,
    ) {
        if map.contains_key(id) {
            if let (Some(lbl), Some(&idx)) = (label, map.get(id))
                && !lbl.is_empty()
            {
                nodes[idx].label = lbl.to_string();
            }
            if let (Some(s), Some(&idx)) = (shape, map.get(id)) {
                nodes[idx].shape = s;
            }
            return;
        }
        let idx = nodes.len();
        map.insert(id.to_string(), idx);
        nodes.push(MermaidNode {
            id: id.to_string(),
            label: label.unwrap_or(id).to_string(),
            shape: shape.unwrap_or(NodeShape::Rect),
        });
    }
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct SequenceDiagram {
    pub participants: Vec<String>,
    pub messages: Vec<SequenceMessage>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct SequenceMessage {
    pub from: String,
    pub to: String,
    pub text: String,
    #[serde(rename = "arrowKind")]
    pub arrow_kind: SeqArrowKind,
}

#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum SeqArrowKind {
    #[serde(rename = "solid")]
    Solid,
    #[serde(rename = "dotted")]
    Dotted,
    #[serde(rename = "solid-open")]
    SolidOpen,
    #[serde(rename = "dotted-open")]
    DottedOpen,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct PieChart {
    pub title: Option<String>,
    pub slices: Vec<PieSlice>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct PieSlice {
    pub label: String,
    pub value: f64,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct GanttChart {
    pub title: Option<String>,
    pub sections: Vec<GanttSection>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct GanttSection {
    pub name: String,
    pub tasks: Vec<GanttTask>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct GanttTask {
    pub name: String,
    pub id: Option<String>,
    pub deps: Vec<String>,
    pub duration: Option<String>,
}

// ── Class Diagram ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ClassMember {
    pub visibility: String,
    pub name: String,
    #[serde(rename = "typeInfo")]
    pub type_info: String,
    #[serde(rename = "isMethod")]
    pub is_method: bool,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ClassDefinition {
    pub name: String,
    pub attributes: Vec<ClassMember>,
    pub methods: Vec<ClassMember>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ClassRelationship {
    pub from: String,
    pub to: String,
    #[serde(rename = "relType")]
    pub rel_type: String,
    pub label: Option<String>,
    #[serde(rename = "arrowAt")]
    pub arrow_at: String,
    /// Multiplicity at the FROM end (`Student "1" --> "*" School : attends`
    /// carries `1` here). The endpoint itself is the CLASS NAME — the quoted
    /// multiplicity is decoration, and leaving it in the name invented classes
    /// called `Student "1"`.
    #[serde(rename = "fromCardinality", skip_serializing_if = "Option::is_none")]
    pub from_cardinality: Option<String>,
    /// Multiplicity at the TO end.
    #[serde(rename = "toCardinality", skip_serializing_if = "Option::is_none")]
    pub to_cardinality: Option<String>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct MermaidClassDoc {
    pub classes: Vec<ClassDefinition>,
    pub relationships: Vec<ClassRelationship>,
}

// ── Quadrant Chart ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct QuadrantPoint {
    pub label: String,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct MermaidQuadrantDoc {
    pub title: Option<String>,
    #[serde(rename = "xAxisLeft")]
    pub x_axis_left: String,
    #[serde(rename = "xAxisRight")]
    pub x_axis_right: String,
    #[serde(rename = "yAxisBottom")]
    pub y_axis_bottom: String,
    #[serde(rename = "yAxisTop")]
    pub y_axis_top: String,
    pub quadrants: Vec<Option<String>>,
    pub points: Vec<QuadrantPoint>,
}
