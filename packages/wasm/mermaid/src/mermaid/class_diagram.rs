//! Class diagram parser — semantic mirror of parseClass.ts.
//!
//! Class blocks with braces, member visibility prefixes (+/-/#/~),
//! method vs attribute (paren detection, colon splits), relationship
//! patterns searched longest-first (`<|--` before `..` before `--`).

use super::types::*;

/// Relationship patterns IN ORDER (first match wins).
const RELATIONS: &[(&str, &str, &str)] = &[
    // (pattern, relType, arrowAt)
    ("<|--", "inheritance", "from"),
    ("*--", "composition", "from"),
    ("o--", "aggregation", "from"),
    ("..|>", "implements", "to"),
    ("..>", "dependency", "to"),
    ("..", "dependency", "none"),
    ("<--", "directed-association", "from"),
    ("-->", "directed-association", "to"),
    ("--", "association", "none"),
];

fn visibility_of(ch: char) -> Option<&'static str> {
    match ch {
        '+' => Some("public"),
        '-' => Some("private"),
        '#' => Some("protected"),
        '~' => Some("internal"),
        _ => None,
    }
}

fn strip_edge_quotes(s: &str) -> String {
    s.trim_start_matches('"').trim_end_matches('"').to_string()
}

fn parse_member(line: &str) -> Option<ClassMember> {
    if line.is_empty() || line.starts_with('%') {
        return None;
    }
    let first = line.chars().next()?;
    let vis = visibility_of(first);
    match vis {
        None => Some(ClassMember {
            visibility: "internal".to_string(),
            name: line.to_string(),
            type_info: String::new(),
            is_method: line.contains('('),
        }),
        Some(v) => {
            let rest = line[first.len_utf8()..].trim();
            let is_method = rest.contains('(');
            if is_method {
                let paren = rest.find('(')?;
                let name = rest[..paren].trim().to_string();
                let after = &rest[paren..];
                let colon = after.rfind(':');
                let type_info = colon
                    .map(|c| after[c + 1..].trim().to_string())
                    .unwrap_or_default();
                Some(ClassMember {
                    visibility: v.to_string(),
                    name,
                    type_info,
                    is_method: true,
                })
            } else {
                let colon = rest.find(':');
                match colon {
                    Some(c) => Some(ClassMember {
                        visibility: v.to_string(),
                        name: rest[..c].trim().to_string(),
                        type_info: rest[c + 1..].trim().to_string(),
                        is_method: false,
                    }),
                    None => Some(ClassMember {
                        visibility: v.to_string(),
                        name: rest.to_string(),
                        type_info: String::new(),
                        is_method: false,
                    }),
                }
            }
        }
    }
}

fn parse_relationship(line: &str) -> Option<ClassRelationship> {
    if line.is_empty() || line.starts_with('%') {
        return None;
    }
    for (pattern, rel_type, arrow_at) in RELATIONS {
        if let Some(pos) = line.find(pattern) {
            let from = line[..pos].trim();
            let after = &line[pos + pattern.len()..];
            let colon = after.find(':');
            let (to, label) = match colon {
                Some(c) => (
                    after[..c].trim().to_string(),
                    Some(after[c + 1..].trim().to_string()),
                ),
                None => (after.trim().to_string(), None),
            };
            if from.is_empty() || to.is_empty() {
                return None;
            }
            return Some(ClassRelationship {
                from: strip_edge_quotes(from),
                to: strip_edge_quotes(&to),
                rel_type: rel_type.to_string(),
                label: label.filter(|l| !l.is_empty()),
                arrow_at: arrow_at.to_string(),
            });
        }
    }
    None
}

pub fn parse_class_diagram(source: &str) -> Option<MermaidClassDoc> {
    let mut classes: Vec<ClassDefinition> = Vec::new();
    let mut relationships: Vec<ClassRelationship> = Vec::new();
    let mut current: Option<ClassDefinition> = None;
    let mut in_body = false;
    let mut brace_depth = 0i32;

    for raw in source.lines() {
        let line = raw.trim();
        if line.is_empty() || line == "classDiagram" {
            continue;
        }

        if in_body {
            if let Some(ref mut cls) = current {
                if line == "}" {
                    brace_depth -= 1;
                    if brace_depth == 0 {
                        in_body = false;
                        classes.push(cls.clone());
                        current = None;
                        continue;
                    }
                }
                if brace_depth > 0 && !line.is_empty() && !line.starts_with('%') {
                    if let Some(member) = parse_member(line) {
                        if member.is_method {
                            cls.methods.push(member);
                        } else {
                            cls.attributes.push(member);
                        }
                    }
                }
                continue;
            }
        }

        if line.starts_with("class ") && line.contains('{') {
            let rest = line.strip_prefix("class ")? .trim();
            let name = rest.split('{').next()?.trim().to_string();
            if name.is_empty() {
                continue;
            }
            let mut cls = ClassDefinition { name, attributes: Vec::new(), methods: Vec::new() };
            let body_part = line.split('{').nth(1).unwrap_or("");
            if body_part.contains('}') {
                let content = body_part.split('}').next().unwrap_or("");
                for member_str in content.split(';') {
                    if let Some(member) = parse_member(member_str.trim()) {
                        if member.is_method {
                            cls.methods.push(member);
                        } else {
                            cls.attributes.push(member);
                        }
                    }
                }
                classes.push(cls);
            } else {
                current = Some(cls);
                in_body = true;
                brace_depth = 1;
            }
            continue;
        }

        if let Some(rel) = parse_relationship(line) {
            relationships.push(rel);
        }
    }

    // Unterminated block: keep it if it gathered anything.
    if let Some(cls) = current {
        if !cls.attributes.is_empty() || !cls.methods.is_empty() {
            classes.push(cls);
        }
    }

    if classes.is_empty() {
        return None;
    }
    Some(MermaidClassDoc { classes, relationships })
}
