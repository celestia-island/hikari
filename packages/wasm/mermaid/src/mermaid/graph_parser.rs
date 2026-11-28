use pest::Parser;
use pest_derive::Parser;
use std::collections::{HashMap, HashSet};

use super::types::*;

#[derive(Parser)]
#[grammar = "mermaid/grammar.pest"]
pub struct MermaidParser;

/// Mutable parse context: the node/edge tables plus the subgraph stack.
///
/// Subgraphs are a CONTAINER concept in mermaid (a cluster frame drawn
/// around its members, addressable by edges like `C --> G`), but the family
/// grammar only ever produced a flat node/edge graph — `subgraph`/`end`
/// lines fell through to `nodedef` and were painted as two literal boxes.
/// The docs hub's platform pages all use the shape, so the parser now keeps
/// a group table alongside the nodes and records membership as it walks the
/// nested `stmts` (a nested group's nodes join every open ancestor too, so
/// an outer frame's bbox encloses the inner one without a second pass).
struct State {
    nodes: Vec<MermaidNode>,
    edges: Vec<MermaidEdge>,
    node_map: HashMap<String, usize>,
    groups: Vec<MermaidGroup>,
    group_index: HashMap<String, usize>,
    /// Group ids currently open, outermost first.
    open: Vec<String>,
    /// Counter behind the ids of headless groups (`subgraph "Title"`).
    auto_group: usize,
}

impl State {
    fn new() -> Self {
        State {
            nodes: Vec::new(),
            edges: Vec::new(),
            node_map: HashMap::new(),
            groups: Vec::new(),
            group_index: HashMap::new(),
            open: Vec::new(),
            auto_group: 0,
        }
    }

    /// Define (or refine) a node and join it to every open group.
    fn ensure_node(&mut self, id: &str, label: Option<&str>, shape: Option<NodeShape>) {
        MermaidDiagram::ensure_node(&mut self.nodes, &mut self.node_map, id, label, shape);
        for group_id in self.open.clone() {
            let Some(&idx) = self.group_index.get(&group_id) else {
                continue;
            };
            let members = &mut self.groups[idx].members;
            if !members.iter().any(|m| m == id) {
                members.push(id.to_string());
            }
        }
    }
}

/// A `subgraph <head>` line split into its optional id and caption.
struct GroupHead {
    id: Option<String>,
    label: Option<String>,
}

pub fn parse(source: &str) -> Result<MermaidDiagram, String> {
    // TODO: extend for pie/gantt/sequence once the WIT contract carries
    // their result types. For now these diagram types fall through to the
    // TS parser on the wasmEngine side.
    let pairs = MermaidParser::parse(Rule::file, source)
        .map_err(|e| format!("mermaid parse error: {}", e))?;

    let mut direction = Direction::TopDown;
    let mut state = State::new();

    for pair in pairs {
        if pair.as_rule() == Rule::file {
            for inner in pair.into_inner() {
                if inner.as_rule() == Rule::diagram {
                    for dchild in inner.into_inner() {
                        match dchild.as_rule() {
                            Rule::direction => {
                                direction = match dchild.as_str() {
                                    "TD" | "TB" => Direction::TopDown,
                                    "BT" => Direction::BottomUp,
                                    "LR" => Direction::LeftRight,
                                    "RL" => Direction::RightLeft,
                                    _ => Direction::TopDown,
                                };
                            }
                            Rule::stmts => {
                                parse_stmts(dchild, &mut state);
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }

    // A subgraph's id is a container, not a node: mermaid lets edges point at
    // it (`C --> G`) and paints the arrow onto the frame. Drop any placeholder
    // node that an edge defined before the block was reached, and keep the
    // membership lists free of group ids for the same reason.
    let group_ids: HashSet<String> = state.groups.iter().map(|g| g.id.clone()).collect();
    state.nodes.retain(|n| !group_ids.contains(&n.id));
    for group in &mut state.groups {
        group.members.retain(|m| !group_ids.contains(m));
    }

    Ok(MermaidDiagram {
        kind: "graph".to_string(),
        variant: "flowchart".to_string(),
        direction,
        nodes: state.nodes,
        edges: state.edges,
        groups: state.groups,
    })
}

fn parse_stmts(pair: pest::iterators::Pair<Rule>, state: &mut State) {
    for stmt in pair.into_inner() {
        if stmt.as_rule() == Rule::stmt {
            parse_stmt(stmt, state);
        }
    }
}

fn parse_stmt(pair: pest::iterators::Pair<Rule>, state: &mut State) {
    for inner in pair.into_inner() {
        if inner.as_rule() == Rule::stmt_inner {
            for inner2 in inner.into_inner() {
                match inner2.as_rule() {
                    Rule::chain => {
                        parse_chain(inner2, state);
                    }
                    Rule::nodedef => {
                        parse_nodedef(inner2, state);
                    }
                    Rule::subgraph => {
                        parse_subgraph(inner2, state);
                    }
                    _ => {}
                }
            }
        }
    }
}

/// `subgraph <head>` … `end` — register the cluster, then parse its body with
/// the group open so every node inside joins it.
fn parse_subgraph(pair: pest::iterators::Pair<Rule>, state: &mut State) {
    let mut head = String::new();
    let mut body = None;

    for inner in pair.into_inner() {
        match inner.as_rule() {
            Rule::group_head => head = inner.as_str().trim().to_string(),
            Rule::stmts => body = Some(inner),
            _ => {}
        }
    }

    let parsed = parse_group_head(&head);
    let id = match parsed.id {
        Some(id) => id,
        None => {
            state.auto_group += 1;
            format!("_sg{}", state.auto_group)
        }
    };
    let label = parsed
        .label
        .filter(|l| !l.is_empty())
        .unwrap_or_else(|| id.clone());
    let parent = state.open.last().cloned();

    if !state.group_index.contains_key(&id) {
        state.group_index.insert(id.clone(), state.groups.len());
        state.groups.push(MermaidGroup {
            id: id.clone(),
            label,
            members: Vec::new(),
            parent,
        });
    }

    state.open.push(id);
    if let Some(body) = body {
        parse_stmts(body, state);
    }
    state.open.pop();
}

/// Split a `subgraph` head into id and caption.
///
/// Real mermaid accepts `Id["Title"]`, `["Title"]`, `Id (Title)`, `Id`,
/// `"Title"` and a bare multi-word title. An id is only claimed when the head
/// starts with an identifier AND is exhausted by it or by the shape that
/// follows it — `subgraph G extra` is a title, exactly like mermaid's
/// "an id must be a single token" rule.
fn parse_group_head(raw: &str) -> GroupHead {
    let text = raw.trim();
    let bytes = text.as_bytes();
    // A leading run of identifier bytes. A digit-led head is only an id when
    // a shape follows it (`2["Tier"]`); `subgraph 2 Tier` stays a caption,
    // because an id is only claimed when the head reduces to one.
    let mut id_end = 0;
    while id_end < bytes.len() && (bytes[id_end].is_ascii_alphanumeric() || bytes[id_end] == b'_') {
        id_end += 1;
    }
    let (head_id, rest) = text.split_at(id_end);
    let rest = rest.trim();

    if rest.is_empty() {
        if head_id.is_empty() {
            return GroupHead {
                id: None,
                label: None,
            };
        }
        return GroupHead {
            id: Some(head_id.to_string()),
            label: Some(head_id.to_string()),
        };
    }

    if let Some(label) = strip_shape(rest) {
        let label = if label.is_empty() {
            head_id.to_string()
        } else {
            label
        };
        return GroupHead {
            id: (!head_id.is_empty()).then(|| head_id.to_string()),
            label: Some(label),
        };
    }

    if head_id.is_empty() {
        return GroupHead {
            id: None,
            label: Some(strip_quotes(rest)),
        };
    }

    // Identifier followed by something that is not a shape: the whole head is
    // the caption, not an id plus junk.
    GroupHead {
        id: None,
        label: Some(strip_quotes(text)),
    }
}

/// `["Title"]` / `("Title")` / `(("Title"))` / `{"Title"}` → `Title`.
fn strip_shape(text: &str) -> Option<String> {
    for (open, close) in [("((", "))"), ("[", "]"), ("(", ")"), ("{", "}")] {
        if let Some(inner) = text.strip_prefix(open).and_then(|t| t.strip_suffix(close)) {
            return Some(strip_quotes(inner.trim()));
        }
    }
    None
}

/// Mermaid lets a label be quoted (`A["text"]`, `-->|"text"|`); the quotes
/// are syntax, never content — the shipped renderers strip them, and the docs
/// hub writes every label that way (leaving them in painted literal `"…"`
/// around each node).
fn strip_quotes(text: &str) -> String {
    let t = text.trim();
    if t.len() >= 2 && t.starts_with('"') && t.ends_with('"') {
        t[1..t.len() - 1].trim().to_string()
    } else {
        t.to_string()
    }
}

fn parse_chain(pair: pest::iterators::Pair<Rule>, state: &mut State) {
    let mut edge_types: Vec<ParsedEdge> = Vec::new();

    // Each chain position is a GROUP of refs (`A & B --> C & D`); the edges
    // are the cross product between consecutive groups, which is what
    // mermaid draws for the shorthand.
    let mut groups: Vec<Vec<String>> = Vec::new();
    for inner in pair.into_inner() {
        match inner.as_rule() {
            Rule::refs => {
                let mut group = Vec::new();
                for nref in inner.into_inner() {
                    if nref.as_rule() != Rule::nref {
                        continue;
                    }
                    let (id, label, shape) = parse_nref(nref);
                    state.ensure_node(&id, label.as_deref(), shape);
                    group.push(id);
                }
                groups.push(group);
            }
            Rule::edge => {
                edge_types.push(parse_edge(inner));
            }
            _ => {}
        }
    }

    for i in 0..edge_types.len().min(groups.len().saturating_sub(1)) {
        let (et, lbl, head_end, head_start) = &edge_types[i];
        for source in &groups[i] {
            for target in &groups[i + 1] {
                // A real self-loop (`A --> A`) is meaningful — the layout
                // draws it as a stub around the node's side — so only the
                // FAN-OUT cross product drops the identity pairs (they would
                // be spurious `A --> A` edges from `A & B --> B & C`).
                let fan_out = groups[i].len() > 1 || groups[i + 1].len() > 1;
                if fan_out && source == target {
                    continue;
                }
                state.edges.push(MermaidEdge {
                    source: source.clone(),
                    target: target.clone(),
                    label: lbl.clone(),
                    edge_type: et.clone(),
                    head_end: *head_end,
                    head_start: *head_start,
                });
            }
        }
    }
}

fn parse_nodedef(pair: pest::iterators::Pair<Rule>, state: &mut State) {
    let mut id = String::new();
    let mut label: Option<String> = None;
    let mut shape: Option<NodeShape> = None;

    for inner in pair.into_inner() {
        match inner.as_rule() {
            Rule::nid => {
                id = inner.as_str().to_string();
            }
            Rule::shape => {
                let (s, l) = parse_shape(inner);
                shape = Some(s);
                label = l;
            }
            _ => {}
        }
    }

    state.ensure_node(&id, label.as_deref(), shape);
}

fn parse_nref(pair: pest::iterators::Pair<Rule>) -> (String, Option<String>, Option<NodeShape>) {
    let mut id = String::new();
    let mut label: Option<String> = None;
    let mut shape: Option<NodeShape> = None;

    for inner in pair.into_inner() {
        match inner.as_rule() {
            Rule::nid => {
                id = inner.as_str().to_string();
            }
            Rule::shape => {
                let (s, l) = parse_shape(inner);
                shape = Some(s);
                label = l;
            }
            _ => {}
        }
    }

    (id, label, shape)
}

fn parse_shape(pair: pest::iterators::Pair<Rule>) -> (NodeShape, Option<String>) {
    for inner in pair.into_inner() {
        let text = inner
            .clone()
            .into_inner()
            .next()
            .map(|p| strip_quotes(p.as_str()));
        // An EMPTY label is meaningful: `A((\"\"))` (and a state diagram's
        // pseudostates) draw a bare shape with no text, so the empty string is
        // carried through instead of falling back to the node id. The old
        // `filter(|t| !t.is_empty())` made such a node render its id inside the
        // circle.
        match inner.as_rule() {
            Rule::dblcirc => return (NodeShape::DoubleCircle, text),
            Rule::stadium => return (NodeShape::Stadium, text),
            Rule::subrt => return (NodeShape::Subroutine, text),
            Rule::cyl => return (NodeShape::Cylinder, text),
            Rule::hex => return (NodeShape::Hexagon, text),
            Rule::para => return (NodeShape::Parallelogram, text),
            Rule::trap => return (NodeShape::Trapezoid, text),
            Rule::asym => return (NodeShape::Asymmetric, text),
            Rule::circ => return (NodeShape::Circle, text),
            Rule::rect => return (NodeShape::Rect, text),
            Rule::rnd => return (NodeShape::Rounded, text),
            Rule::diam => return (NodeShape::Diamond, text),
            _ => {}
        }
    }
    (NodeShape::Rect, None)
}

/// Pull the `|caption|` (if any) out of an edge rule's children.
fn edge_label(pair: &pest::iterators::Pair<Rule>) -> Option<String> {
    for inner in pair.clone().into_inner() {
        match inner.as_rule() {
            Rule::lbl => {
                let text = inner
                    .into_inner()
                    .next()
                    .map(|lp| strip_quotes(lp.as_str()))
                    .unwrap_or_default();
                return Some(text).filter(|l| !l.is_empty());
            }
            // `-- caption -->`: the caption is the raw run between the dashes.
            Rule::ltxt_raw => {
                let text = strip_quotes(inner.as_str());
                return Some(text).filter(|l| !l.is_empty());
            }
            _ => {}
        }
    }
    None
}

/// Classify one link token into (line kind, caption).
///
/// The head glyph (`o`, `x`, `<`) is part of the token in mermaid but changes
/// only the ARROWHEAD, which the renderer reads from the source text; the
/// line kind (solid / dashed / thick / plain) is what the layout needs, so
/// that is what this returns.
/// One link token: its line kind, its caption, and the two head adornments.
type ParsedEdge = (EdgeType, Option<String>, Option<EdgeHead>, Option<EdgeHead>);

fn parse_edge(pair: pest::iterators::Pair<Rule>) -> ParsedEdge {
    for inner in pair.into_inner() {
        match inner.as_rule() {
            Rule::arr | Rule::arr_lbl | Rule::arr_text => {
                return (EdgeType::Arrow, edge_label(&inner), None, None);
            }
            Rule::ln | Rule::ln_lbl | Rule::ln_text => {
                return (EdgeType::Line, edge_label(&inner), None, None);
            }
            // Head-adorned links keep their LINE kind and carry the glyph in
            // the contract (`headEnd`/`headStart`) so the painter can draw it.
            // `<-->` is an arrow drawn at both ends.
            Rule::bi_arr => {
                return (
                    EdgeType::Arrow,
                    edge_label(&inner),
                    None,
                    Some(EdgeHead::Arrow),
                );
            }
            Rule::o_head => {
                return (
                    EdgeType::Line,
                    edge_label(&inner),
                    Some(EdgeHead::Circle),
                    None,
                );
            }
            Rule::x_head => {
                return (
                    EdgeType::Line,
                    edge_label(&inner),
                    Some(EdgeHead::Cross),
                    None,
                );
            }
            Rule::dotted | Rule::dotted_lbl => {
                return (EdgeType::Dotted, edge_label(&inner), None, None);
            }
            Rule::thick | Rule::thick_lbl => {
                return (EdgeType::Thick, edge_label(&inner), None, None);
            }
            _ => {}
        }
    }
    (EdgeType::Arrow, None, None, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── coverage wave (2026-11-28) ──────────────────────────────────
    //
    // Each case is a construct the docs hub (or mermaid's own reference)
    // uses and the grammar used to REJECT, which turned the whole diagram
    // into a fallback code block — the failure mode that matters here,
    // because a partial render is better than no render.
    //
    // MUT: reverting any shape/link rule below makes the corresponding
    // assertion fail with a parse error, not a wrong shape.

    #[test]
    fn every_node_shape_parses_to_its_own_variant() {
        let doc = parse(
            "flowchart LR\n\
             A[rect] --> B(rounded)\n\
             B --> C([stadium])\n\
             C --> D[[subroutine]]\n\
             D --> E[(database)]\n\
             E --> F((circle))\n\
             F --> G{diamond}\n\
             G --> H{{hexagon}}\n\
             H --> I[/parallelogram/]\n\
             I --> J>asymmetric]\n\
             J --> K(((double circle)))\n",
        )
        .expect("every documented shape must parse");
        let shapes: Vec<(String, NodeShape)> = doc
            .nodes
            .iter()
            .map(|n| (n.label.clone(), n.shape.clone()))
            .collect();
        assert_eq!(
            shapes,
            vec![
                ("rect".to_string(), NodeShape::Rect),
                ("rounded".to_string(), NodeShape::Rounded),
                ("stadium".to_string(), NodeShape::Stadium),
                ("subroutine".to_string(), NodeShape::Subroutine),
                ("database".to_string(), NodeShape::Cylinder),
                ("circle".to_string(), NodeShape::Circle),
                ("diamond".to_string(), NodeShape::Diamond),
                ("hexagon".to_string(), NodeShape::Hexagon),
                ("parallelogram".to_string(), NodeShape::Parallelogram),
                ("asymmetric".to_string(), NodeShape::Asymmetric),
                ("double circle".to_string(), NodeShape::DoubleCircle),
            ]
        );
    }

    #[test]
    fn the_link_family_classifies_its_line_kind_and_keeps_its_caption() {
        let doc = parse(
            "flowchart TD\n\
             A -->|arrow| B\n\
             B --- C\n\
             C -.->|dashed| D\n\
             D ==> E\n\
             E -- text on line --> F\n\
             F ---|plain caption| G\n",
        )
        .expect("every link form must parse");
        let by_label = |from: &str| -> (EdgeType, Option<String>) {
            let e = doc
                .edges
                .iter()
                .find(|e| e.source == from)
                .unwrap_or_else(|| panic!("no edge from {from}"));
            (e.edge_type.clone(), e.label.clone())
        };
        assert_eq!(by_label("A"), (EdgeType::Arrow, Some("arrow".to_string())));
        assert_eq!(by_label("B"), (EdgeType::Line, None));
        assert_eq!(
            by_label("C"),
            (EdgeType::Dotted, Some("dashed".to_string()))
        );
        assert_eq!(by_label("D"), (EdgeType::Thick, None));
        assert_eq!(
            by_label("E"),
            (EdgeType::Arrow, Some("text on line".to_string()))
        );
        assert_eq!(
            by_label("F"),
            (EdgeType::Line, Some("plain caption".to_string()))
        );
    }

    #[test]
    fn the_ampersand_shorthand_fans_into_the_cross_product() {
        // `A --> B & C` is two edges, `A & B --> C & D` is four.
        let doc = parse("flowchart TD\n  A & B --> C & D\n").expect("fan-out must parse");
        let mut pairs: Vec<(String, String)> = doc
            .edges
            .iter()
            .map(|e| (e.source.clone(), e.target.clone()))
            .collect();
        pairs.sort();
        assert_eq!(
            pairs,
            vec![
                ("A".to_string(), "C".to_string()),
                ("A".to_string(), "D".to_string()),
                ("B".to_string(), "C".to_string()),
                ("B".to_string(), "D".to_string()),
            ]
        );
    }

    /// `--o` / `--x` / `<-->`: the HEAD glyph is syntax, never a node.
    ///
    /// MUT: dropping these rules from the grammar reads the `o`/`x` as the
    /// TARGET node (`A --o B` → an edge to a node named "o") and rejects
    /// `<-->` outright — both assertions below fail.
    #[test]
    fn head_adorned_links_reach_the_real_target() {
        let doc = parse("flowchart TD\n  A --o B\n  B --x C\n  C <--> D\n  D --o|cap| E\n")
            .expect("every head form must parse");
        let pairs: Vec<(String, String, EdgeType, Option<String>)> = doc
            .edges
            .iter()
            .map(|e| {
                (
                    e.source.clone(),
                    e.target.clone(),
                    e.edge_type.clone(),
                    e.label.clone(),
                )
            })
            .collect();
        assert_eq!(
            pairs,
            vec![
                ("A".to_string(), "B".to_string(), EdgeType::Line, None),
                ("B".to_string(), "C".to_string(), EdgeType::Line, None),
                // `<-->` is an arrow drawn at BOTH ends, so it classifies as
                // an arrow (not a plain line).
                ("C".to_string(), "D".to_string(), EdgeType::Arrow, None),
                (
                    "D".to_string(),
                    "E".to_string(),
                    EdgeType::Line,
                    Some("cap".to_string())
                ),
            ]
        );
        // No invented nodes: the glyphs never became ids.
        let ids: Vec<&str> = doc.nodes.iter().map(|n| n.id.as_str()).collect();
        assert_eq!(ids, vec!["A", "B", "C", "D", "E"]);
    }

    #[test]
    fn a_captioned_dotted_link_is_not_read_as_a_plain_dash_run() {
        // The PEG ordering trap: `-.->` must win over `-.-` / `--`, and
        // `-->` must never be read as `--` + caption.
        let doc = parse("flowchart TD\n  A -.-> B\n  B -->|cap| C\n").expect("parse");
        assert_eq!(doc.edges[0].edge_type, EdgeType::Dotted);
        assert_eq!(doc.edges[1].edge_type, EdgeType::Arrow);
        assert_eq!(doc.edges[1].label.as_deref(), Some("cap"));
    }

    #[test]
    fn subgraph_becomes_a_group_not_two_nodes() {
        let doc = parse("flowchart TD\n  subgraph G[\"Gateway\"]\n    A[\"a\"]\n    B[\"b\"]\n  end\n  C --> G\n")
            .expect("parse");
        assert_eq!(
            doc.nodes.iter().map(|n| n.id.as_str()).collect::<Vec<_>>(),
            vec!["A", "B", "C"],
            "subgraph/end must not be painted as nodes"
        );
        assert_eq!(doc.groups.len(), 1);
        let g = &doc.groups[0];
        assert_eq!(g.id, "G");
        assert_eq!(g.label, "Gateway");
        assert_eq!(g.members, vec!["A".to_string(), "B".to_string()]);
        assert_eq!(g.parent, None);
        // The edge to the cluster id survives; the layout maps it onto the frame.
        assert!(doc.edges.iter().any(|e| e.source == "C" && e.target == "G"));
    }

    #[test]
    fn nested_groups_join_every_open_ancestor() {
        let doc = parse(
            "flowchart TD\n  subgraph Outer[\"out\"]\n    subgraph Inner[\"in\"]\n      A[\"a\"]\n    end\n    B[\"b\"]\n  end\n",
        )
        .expect("parse");
        assert_eq!(doc.groups.len(), 2);
        let outer = doc.groups.iter().find(|g| g.id == "Outer").unwrap();
        let inner = doc.groups.iter().find(|g| g.id == "Inner").unwrap();
        assert_eq!(inner.parent.as_deref(), Some("Outer"));
        assert_eq!(inner.members, vec!["A".to_string()]);
        assert_eq!(
            outer.members,
            vec!["A".to_string(), "B".to_string()],
            "an outer frame must enclose its nested frame's members"
        );
        assert_eq!(outer.parent, None);
    }

    #[test]
    fn quoted_labels_lose_their_syntax_quotes() {
        // Mermaid's brackets/quotes are syntax: `A["text"]` renders `text`.
        // The docs hub quotes every label, so leaving them in painted a
        // literal "…" around each node.
        let doc =
            parse("flowchart TD\n  A[\"text\"] -->|\"edge caption\"| B[\"b\"]\n").expect("parse");
        assert_eq!(doc.nodes[0].label, "text");
        assert_eq!(doc.nodes[1].label, "b");
        assert_eq!(doc.edges[0].label.as_deref(), Some("edge caption"));
        // An unquoted label keeps its own quotes as content.
        let doc = parse("flowchart TD\n  A[say \"hi\"]\n").expect("parse");
        assert_eq!(doc.nodes[0].label, "say \"hi\"");
    }

    /// The hub's platform pages (arona / chest / entelecheia / evernight) all
    /// use this exact shape: a quoted cluster with quoted members, an edge
    /// captioned with a quoted string, and an edge addressed to the cluster.
    #[test]
    fn the_hub_architecture_diagram_parses_into_one_cluster() {
        let src = "flowchart TD\n    C[\"shittim-chest / 任意 OpenAI 兼容客户端\"]\n    subgraph G[\"Arona 网关（node-2:8420）\"]\n        N0[\"Router：别名 → 后端间最少计数负载均衡\"]\n        N1[\"记忆网关：召回注入 → 聊天 → 写回（episode）\"]\n        N2[\"Agent 控制面（/ws/agent）\"]\n    end\n    C -->|\"/v1/chat/completions（Bearer API key）\"| G\n    N2 --> T[\"GPU 节点上的 arona-agent\"]\n    G --> B[\"后端：ollama · external（OpenAI 兼容）· agent 部署的引擎\"]\n";
        let doc = parse(src).expect("parse");
        assert_eq!(
            doc.nodes.iter().map(|n| n.id.as_str()).collect::<Vec<_>>(),
            vec!["C", "N0", "N1", "N2", "T", "B"],
        );
        assert_eq!(doc.groups.len(), 1);
        assert_eq!(doc.groups[0].id, "G");
        assert_eq!(doc.groups[0].label, "Arona 网关（node-2:8420）");
        assert_eq!(doc.groups[0].members, vec!["N0", "N1", "N2"]);
        assert_eq!(doc.nodes[0].label, "shittim-chest / 任意 OpenAI 兼容客户端");
        assert_eq!(
            doc.edges[0].label.as_deref(),
            Some("/v1/chat/completions（Bearer API key）")
        );
        assert!(doc.edges.iter().any(|e| e.source == "C" && e.target == "G"));
        assert!(doc.edges.iter().any(|e| e.source == "G" && e.target == "B"));
    }

    #[test]
    fn headless_and_quoted_titles_get_stable_ids() {
        let doc = parse("flowchart TD\n  subgraph \"Plain title\"\n    A[\"a\"]\n  end\n  subgraph 网络层\n    B[\"b\"]\n  end\n")
            .expect("parse");
        assert_eq!(doc.groups.len(), 2);
        assert_eq!(doc.groups[0].id, "_sg1");
        assert_eq!(doc.groups[0].label, "Plain title");
        assert_eq!(doc.groups[1].id, "_sg2");
        assert_eq!(doc.groups[1].label, "网络层");
    }

    #[test]
    fn an_unclosed_subgraph_still_forms_one_cluster() {
        // No `end` at all: the keyword must never fall through to `nodedef`
        // and paint the literal box this feature exists to remove. The block
        // degrades to "runs to EOF" instead.
        let doc = parse("flowchart TD\n  subgraph G[\"Gateway\"]\n    A[\"a\"]\n").expect("parse");
        assert_eq!(
            doc.nodes.iter().map(|n| n.id.as_str()).collect::<Vec<_>>(),
            vec!["A"],
            "no literal `subgraph` node on an unclosed block"
        );
        assert_eq!(doc.groups.len(), 1);
        assert_eq!(doc.groups[0].id, "G");
        assert_eq!(doc.groups[0].members, vec!["A".to_string()]);
    }

    #[test]
    fn a_word_that_merely_starts_with_end_stays_a_node() {
        let doc = parse("flowchart TD\n  endpoint --> A\n").expect("parse");
        assert!(doc.nodes.iter().any(|n| n.id == "endpoint"));
        assert!(doc.groups.is_empty());
    }

    #[test]
    fn group_head_splits_id_shape_and_bare_forms() {
        let g = parse_group_head("G[\"Arona 网关（node-2:8420）\"]");
        assert_eq!(g.id.as_deref(), Some("G"));
        assert_eq!(g.label.as_deref(), Some("Arona 网关（node-2:8420）"));

        let g = parse_group_head("Plant[\"Plant Network\"]");
        assert_eq!(g.id.as_deref(), Some("Plant"));
        assert_eq!(g.label.as_deref(), Some("Plant Network"));

        let g = parse_group_head("Gateway");
        assert_eq!(g.id.as_deref(), Some("Gateway"));
        assert_eq!(g.label.as_deref(), Some("Gateway"));

        let g = parse_group_head("[\"Only a title\"]");
        assert_eq!(g.id, None);
        assert_eq!(g.label.as_deref(), Some("Only a title"));

        // Reported as an S3 (numeric cluster ids): `subgraph 2 Tier` must be
        // read as a caption, not torn into id "2" + caption "Tier" — an id is
        // only claimed when the head reduces to one.
        let g = parse_group_head("2 Tier");
        assert_eq!(g.id, None, "a digit-led multi-word head is a caption");
        assert_eq!(g.label.as_deref(), Some("2 Tier"));

        let g = parse_group_head("G extra words");
        assert_eq!(g.id, None, "a multi-word head is a title, not an id");
        assert_eq!(g.label.as_deref(), Some("G extra words"));

        let g = parse_group_head("(Rounded title)");
        assert_eq!(g.id, None);
        assert_eq!(g.label.as_deref(), Some("Rounded title"));
    }
}
