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
    let mut refs: Vec<String> = Vec::new();
    let mut edge_types: Vec<(EdgeType, Option<String>)> = Vec::new();

    for inner in pair.into_inner() {
        match inner.as_rule() {
            Rule::nref => {
                let (id, label, shape) = parse_nref(inner);
                state.ensure_node(&id, label.as_deref(), shape);
                refs.push(id);
            }
            Rule::edge => {
                let (et, lbl) = parse_edge(inner);
                edge_types.push((et, lbl));
            }
            _ => {}
        }
    }

    for i in 0..edge_types.len() {
        if i + 1 < refs.len() {
            let (et, lbl) = &edge_types[i];
            state.edges.push(MermaidEdge {
                source: refs[i].clone(),
                target: refs[i + 1].clone(),
                label: lbl.clone(),
                edge_type: et.clone(),
            });
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
        let text = text.filter(|t| !t.is_empty());
        match inner.as_rule() {
            Rule::circ => return (NodeShape::Circle, text),
            Rule::rect => return (NodeShape::Rect, text),
            Rule::rnd => return (NodeShape::Rounded, text),
            Rule::diam => return (NodeShape::Diamond, text),
            _ => {}
        }
    }
    (NodeShape::Rect, None)
}

fn parse_edge(pair: pest::iterators::Pair<Rule>) -> (EdgeType, Option<String>) {
    for inner in pair.into_inner() {
        match inner.as_rule() {
            Rule::arr | Rule::arr_lbl => {
                let label = inner.into_inner().next().map(|p| {
                    p.into_inner()
                        .next()
                        .map(|lp| strip_quotes(lp.as_str()))
                        .unwrap_or_default()
                });
                return (EdgeType::Arrow, label.filter(|l| !l.is_empty()));
            }
            Rule::ln | Rule::ln_lbl => {
                let label = inner.into_inner().next().map(|p| {
                    p.into_inner()
                        .next()
                        .map(|lp| strip_quotes(lp.as_str()))
                        .unwrap_or_default()
                });
                return (EdgeType::Line, label.filter(|l| !l.is_empty()));
            }
            _ => {}
        }
    }
    (EdgeType::Arrow, None)
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert!(doc
            .edges
            .iter()
            .any(|e| e.source == "C" && e.target == "G"));
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
        let doc = parse("flowchart TD\n  A[\"text\"] -->|\"edge caption\"| B[\"b\"]\n").expect("parse");
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
