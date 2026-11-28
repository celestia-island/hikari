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

/// Split a relationship endpoint into `(class name, multiplicity)`.
///
/// Mermaid writes multiplicity as a QUOTED token on either side of the class
/// name: `Student "1"` (cardinality first) and `"*" School` (cardinality
/// second). Both forms are decoration — the endpoint is the class — so the
/// quoted run is lifted out instead of being glued onto the name, which is
/// what produced classes called `Student "1"`.
fn split_cardinality(text: &str) -> (String, Option<String>) {
    let t = text.trim();
    // `"1" School` — leading quoted cardinality.
    if t.starts_with('"')
        && let Some(close) = t[1..].find('"')
    {
        let card = t[1..1 + close].trim();
        let rest = t[2 + close..].trim();
        if !rest.is_empty() {
            return (rest.to_string(), Some(card.to_string()).filter(|c| !c.is_empty()));
        }
    }
    // `Student "1"` — trailing quoted cardinality.
    if t.ends_with('"')
        && let Some(open) = t[..t.len() - 1].rfind('"')
    {
        let card = t[open + 1..t.len() - 1].trim();
        let rest = t[..open].trim();
        if !rest.is_empty() {
            return (rest.to_string(), Some(card.to_string()).filter(|c| !c.is_empty()));
        }
    }
    (t.to_string(), None)
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
            let (from_name, from_cardinality) = split_cardinality(from);
            let (to_name, to_cardinality) = split_cardinality(&to);
            let from_name = strip_edge_quotes(&from_name);
            let to_name = strip_edge_quotes(&to_name);
            if from_name.is_empty() || to_name.is_empty() {
                return None;
            }
            return Some(ClassRelationship {
                from: from_name,
                to: to_name,
                rel_type: rel_type.to_string(),
                label: label.filter(|l| !l.is_empty()),
                arrow_at: arrow_at.to_string(),
                from_cardinality,
                to_cardinality,
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

        if in_body && let Some(ref mut cls) = current {
            if line == "}" {
                brace_depth -= 1;
                if brace_depth == 0 {
                    in_body = false;
                    classes.push(cls.clone());
                    current = None;
                    continue;
                }
            }
            if brace_depth > 0
                && !line.is_empty()
                && !line.starts_with('%')
                && let Some(member) = parse_member(line)
            {
                if member.is_method {
                    cls.methods.push(member);
                } else {
                    cls.attributes.push(member);
                }
            }
            continue;
        }

        if line.starts_with("class ") && line.contains('{') {
            let rest = line.strip_prefix("class ")?.trim();
            let name = rest.split('{').next()?.trim().to_string();
            if name.is_empty() {
                continue;
            }
            let mut cls = ClassDefinition {
                name,
                attributes: Vec::new(),
                methods: Vec::new(),
            };
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

        // `class Student` (no body) is a declaration: mermaid lets a class
        // exist only as the endpoint of a relationship, and the bare form is
        // how a diagram names one without attributes.
        if let Some(rest) = line.strip_prefix("class ") {
            let name = strip_edge_quotes(rest.split(['{', ' ']).next().unwrap_or("").trim());
            if !name.is_empty() && !classes.iter().any(|c| c.name == name) {
                classes.push(ClassDefinition {
                    name,
                    attributes: Vec::new(),
                    methods: Vec::new(),
                });
                continue;
            }
        }

        if let Some(rel) = parse_relationship(line) {
            relationships.push(rel);
            continue;
        }

        // `Dog : bark()` — a member declared OUTSIDE any class block. Mermaid
        // lets members accumulate on an implied class; relations are tried
        // first so a labelled relation keeps its caption. The name must be a
        // bare identifier: a quoted multiplicity or a relation pattern before
        // the colon is the other branches' business.
        if let Some((name_text, member_text)) = line.split_once(':') {
            let name = name_text.trim();
            let ident = !name.is_empty()
                && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
                && !name.chars().next().unwrap().is_ascii_digit();
            if ident
                && let Some(member) = parse_member(member_text.trim())
            {
                let cls = match classes.iter_mut().find(|c| c.name == name) {
                    Some(c) => c,
                    None => {
                        classes.push(ClassDefinition {
                            name: name.to_string(),
                            attributes: Vec::new(),
                            methods: Vec::new(),
                        });
                        classes.last_mut().unwrap()
                    }
                };
                if member.is_method {
                    cls.methods.push(member);
                } else {
                    cls.attributes.push(member);
                }
                continue;
            }
        }
    }

    // Unterminated block: keep it if it gathered anything.
    if let Some(cls) = current
        && (!cls.attributes.is_empty() || !cls.methods.is_empty())
    {
        classes.push(cls);
    }

    // Implied classes: a relationship's endpoints ARE classes — mermaid lets a
    // diagram name one only through the relation (`classDiagram\n  Animal <|--
    // Dog`). The old gate returned None when no `class` block existed, so every
    // relationship-only diagram failed the whole parse and the card fell back
    // to a plain code block. Endpoints are appended in first-seen order.
    if !relationships.is_empty() {
        for rel in &relationships {
            for name in [&rel.from, &rel.to] {
                if !classes.iter().any(|c| &c.name == name) {
                    classes.push(ClassDefinition {
                        name: name.clone(),
                        attributes: Vec::new(),
                        methods: Vec::new(),
                    });
                }
            }
        }
    }

    if classes.is_empty() {
        return None;
    }
    Some(MermaidClassDoc {
        classes,
        relationships,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Mermaid writes multiplicity as a QUOTED token beside the class:
    /// `Student "1" --> "*" School : attends`. The endpoint is the CLASS —
    /// the old parser glued the quoted token onto the name, so the diagram
    /// grew classes called `Student "1"` and `1" School`.
    ///
    /// MUT: dropping `split_cardinality` brings those invented names back.
    #[test]
    fn multiplicities_are_lifted_off_the_class_names() {
        let doc = parse_class_diagram(
            "classDiagram\n  class Student\n  class School\n  Student \"1\" --> \"*\" School : attends\n",
        )
        .expect("parse");
        let rel = &doc.relationships[0];
        assert_eq!(rel.from, "Student");
        assert_eq!(rel.to, "School");
        assert_eq!(rel.from_cardinality.as_deref(), Some("1"));
        assert_eq!(rel.to_cardinality.as_deref(), Some("*"));
        assert_eq!(rel.label.as_deref(), Some("attends"));
        // The class list carries the real names only.
        let names: Vec<&str> = doc.classes.iter().map(|c| c.name.as_str()).collect();
        assert_eq!(names, vec!["Student", "School"]);
    }

    /// A bare `class X` line registers the class: a diagram can name one
    /// without a body, and the class list must not come back empty.
    #[test]
    fn a_bare_class_declaration_registers_the_class() {
        let doc = parse_class_diagram("classDiagram\n  class Only\n").expect("parse");
        assert_eq!(doc.classes.iter().map(|c| c.name.as_str()).collect::<Vec<_>>(), vec!["Only"]);
        assert!(doc.relationships.is_empty());
    }

    /// MUT: dropping the implied-classes pass leaves the class list empty and
    /// the whole parse fails — the exact whole-diagram fallback this exists to
    /// remove.
    #[test]
    fn relationship_endpoints_imply_classes() {
        let doc = parse_class_diagram("classDiagram\n  Animal <|-- Dog\n  Dog : bark()\n")
            .expect("a relationship-only diagram must parse");
        // First-seen DOCUMENT order: `Dog` enters via its member line, the
        // implied pass then appends `Animal`.
        let names: Vec<&str> = doc.classes.iter().map(|c| c.name.as_str()).collect();
        assert_eq!(names, vec!["Dog", "Animal"]);
        assert_eq!(doc.relationships[0].rel_type, "inheritance");
        // The member line still lands on the implied class.
        let dog = doc.classes.iter().find(|c| c.name == "Dog").unwrap();
        assert_eq!(dog.methods.len(), 1);
    }

    #[test]
    fn plain_relationships_are_unchanged() {
        let doc = parse_class_diagram(
            "classDiagram\n  class A\n  class B\n  A <|-- B : extends\n",
        )
        .expect("parse");
        let rel = &doc.relationships[0];
        assert_eq!((rel.from.as_str(), rel.to.as_str()), ("A", "B"));
        assert_eq!(rel.rel_type, "inheritance");
        assert_eq!(rel.arrow_at, "from");
        assert!(rel.from_cardinality.is_none() && rel.to_cardinality.is_none());
    }
}
