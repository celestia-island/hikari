//! Sequence diagram parser — semantic mirror of parseSequence.ts.
//!
//! The arrow search order matters: `-->>` before `->>` before `-->`
//! before `->` — a long token must never be misread as its shorter
//! prefix (`A-->>B` must not parse as `A-` + `->>B`).

use super::types::{SeqArrowKind, SequenceBlock, SequenceDiagram, SequenceMessage};

/// Arrow tokens longest-first, mapped to the TS SeqArrowKind literals.
const ARROWS: &[(&str, SeqArrowKind)] = &[
    ("-->>", SeqArrowKind::DottedOpen),
    ("->>", SeqArrowKind::SolidOpen),
    ("-->", SeqArrowKind::Dotted),
    ("->", SeqArrowKind::Solid),
];

pub fn parse_sequence(source: &str) -> Option<SequenceDiagram> {
    let mut participants: Vec<String> = Vec::new();
    let mut messages: Vec<SequenceMessage> = Vec::new();
    // Block frames: `(kind, label, first message index)`. `else`/`and` close
    // the open frame and open a sibling with the same keyword — mermaid's
    // sections are frames of their own.
    let mut open_blocks: Vec<(String, Option<String>, usize)> = Vec::new();
    let mut blocks: Vec<SequenceBlock> = Vec::new();
    // `participant A as Alice` declares the id `A` with the DISPLAY name
    // `Alice`. The contract carries display names only, so the alias is
    // resolved here: the id is replaced by its name everywhere (declaration
    // and every message endpoint), which is what the reader expects to see in
    // the lane headers — the raw `participant A as Alice` line used to become
    // one participant literally named "A as Alice".
    let mut aliases: Vec<(String, String)> = Vec::new();

    for line in source.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("%%") {
            continue;
        }
        if line.starts_with("sequenceDiagram") {
            continue;
        }
        // Block control lines. `end` closes; `else`/`and` close-and-reopen a
        // sibling (kind inherited from the open frame); anything else that
        // starts with a block keyword opens one. These never fail the parse:
        // an unlabelled `end` with nothing open is just dropped.
        let first = line.split_whitespace().next().unwrap_or("");
        let rest_label = line
            .split_whitespace()
            .skip(1)
            .collect::<Vec<_>>()
            .join(" ");
        let make_label = || Some(strip_quotes(&rest_label)).filter(|l| !l.is_empty());
        match first {
            "alt" | "opt" | "loop" | "par" | "critical" | "break" => {
                open_blocks.push((first.to_string(), make_label(), messages.len()));
                continue;
            }
            "else" | "and" => {
                // The frame being CLOSED keeps its own label (the `alt` line's);
                // the new label belongs to the sibling being opened.
                if let Some((kind, stored_label, from)) = open_blocks.pop() {
                    if messages.len() > from {
                        blocks.push(SequenceBlock {
                            kind: kind.clone(),
                            label: stored_label,
                            from,
                            to: messages.len() - 1,
                        });
                    }
                    open_blocks.push((kind, make_label(), messages.len()));
                }
                continue;
            }
            "end" => {
                if let Some((kind, label, from)) = open_blocks.pop()
                    && messages.len() > from
                {
                    blocks.push(SequenceBlock {
                        kind,
                        label,
                        from,
                        to: messages.len() - 1,
                    });
                }
                continue;
            }
            _ => {}
        }

        if let Some(p) = line.strip_prefix("participant ") {
            let raw = p.trim();
            if raw.is_empty() {
                continue;
            }
            let (id, name) = match raw.split_once(" as ") {
                Some((id, name)) => (id.trim().to_string(), name.trim().to_string()),
                None => (raw.to_string(), raw.to_string()),
            };
            if id.is_empty() || name.is_empty() {
                continue;
            }
            if id != name {
                aliases.retain(|(k, _)| k != &id);
                aliases.push((id, name.clone()));
            }
            if !participants.contains(&name) {
                participants.push(name);
            }
            continue;
        }
        if let Some(msg) = parse_message(line) {
            if !participants.contains(&msg.from) {
                participants.push(msg.from.clone());
            }
            if !participants.contains(&msg.to) {
                participants.push(msg.to.clone());
            }
            messages.push(msg);
        }
    }

    // Unterminated blocks: tolerate a missing `end` (the tolerant-grammar
    // rule the family lives by — degrade, never fail).
    for (kind, label, from) in open_blocks.drain(..) {
        if messages.len() > from {
            blocks.push(SequenceBlock {
                kind,
                label,
                from,
                to: messages.len() - 1,
            });
        }
    }

    // A diagram with declared participants but no messages is still valid
    // (the TS parser's contract); only completely empty input is None.
    if participants.is_empty() {
        return None;
    }
    if !aliases.is_empty() {
        let resolve = |name: &str| -> String {
            aliases
                .iter()
                .find(|(id, _)| id == name)
                .map(|(_, name)| name.clone())
                .unwrap_or_else(|| name.to_string())
        };
        for msg in &mut messages {
            msg.from = resolve(&msg.from);
            msg.to = resolve(&msg.to);
        }
        // The message loop above registered the raw ID of every endpoint
        // before the alias was known, so drop the IDs the aliases replaced —
        // otherwise each lane appears twice (once as `A`, once as `Alice`).
        participants.retain(|p| !aliases.iter().any(|(id, _)| id == p));
        // An alias may have introduced a name the declaration loop never saw
        // (a message endpoint that used only the ID).
        for msg in &messages {
            for name in [&msg.from, &msg.to] {
                if !participants.contains(name) {
                    participants.push(name.clone());
                }
            }
        }
    }
    Some(SequenceDiagram {
        participants,
        messages,
        blocks,
    })
}

/// Trim mermaid's activation markers (`+`/`-`, possibly doubled) off a
/// message endpoint. They are per-message state; the participant they name is
/// the bare identifier.
fn strip_activation(name: &str) -> String {
    let trimmed = name.trim();
    let stripped = trimmed
        .trim_start_matches(['+', '-'])
        .trim_end_matches(['+', '-'])
        .trim();
    if stripped.is_empty() {
        trimmed.to_string()
    } else {
        stripped.to_string()
    }
}

/// Mermaid lets block labels be quoted; the quotes are syntax.
fn strip_quotes(text: &str) -> String {
    let t = text.trim();
    if t.len() >= 2 && t.starts_with('"') && t.ends_with('"') {
        t[1..t.len() - 1].trim().to_string()
    } else {
        t.to_string()
    }
}

fn parse_message(line: &str) -> Option<SequenceMessage> {
    // Longest token first: -->> before ->> before --> before ->.
    for (token, kind) in ARROWS {
        if let Some(idx) = line.find(token) {
            let from = line[..idx].trim().to_string();
            let rest = &line[idx + token.len()..];
            let mut parts = rest.splitn(2, ':');
            let to = parts.next()?.trim().to_string();
            let text = parts.next().unwrap_or("").trim().to_string();
            if from.is_empty() || to.is_empty() {
                continue;
            }
            return Some(SequenceMessage {
                // Mermaid writes activation with a trailing `+`/`-` glued to
                // the participant (`Alice ->>+ Bob: hi`). The glyph is
                // STATE, not part of the name: leaving it in put lanes on the
                // board literally named "+ Bob" and "- Alice".
                from: strip_activation(&from),
                to: strip_activation(&to),
                text,
                arrow_kind: *kind,
            });
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// MUT: dropping the alias resolution leaves the participant named
    /// "A as Alice" and the message endpoints unresolved — both assertions
    /// below fail.
    #[test]
    fn participant_alias_becomes_the_display_name() {
        let doc = parse_sequence(
            "sequenceDiagram\n  participant A as Alice\n  participant B as Bob\n  A->>B: hi\n",
        )
        .expect("parse");
        assert_eq!(
            doc.participants,
            vec!["Alice".to_string(), "Bob".to_string()]
        );
        assert_eq!(doc.messages[0].from, "Alice");
        assert_eq!(doc.messages[0].to, "Bob");
    }

    /// MUT: without the alias pass the endpoints keep the ids and the lane
    /// headers (which read the participant list) disagree with the arrows.
    #[test]
    fn an_alias_used_only_by_a_message_still_resolves() {
        let doc = parse_sequence("sequenceDiagram\n  participant A as Alice\n  A->>A: think\n")
            .expect("parse");
        assert_eq!(doc.messages[0].from, "Alice");
        assert_eq!(doc.messages[0].to, "Alice");
        assert_eq!(doc.participants, vec!["Alice".to_string()]);
    }

    /// MUT: dropping `strip_activation` puts lanes on the board literally
    /// named "+ Bob" — the glyph is per-message state, never a name.
    /// MUT: dropping the block-arm (or the `else` sibling logic, or the
    /// tolerant unterminated close) each never passes — the span assertions
    /// below catch every one.
    #[test]
    fn alt_opt_and_else_become_frames_over_their_message_spans() {
        let doc = parse_sequence(
            "sequenceDiagram\n  Alice ->> Bob: a\n  alt success\n    Bob -->> Alice: b\n  else failure\n    Bob -->> Alice: c\n  end\n  opt maybe\n    Alice ->> Bob: d\n  end\n  Alice ->> Bob: e\n",
        )
        .expect("parse");
        assert_eq!(doc.blocks.len(), 3);
        // alt spans messages 1..=2, its else-section is its own frame.
        assert_eq!(
            (
                doc.blocks[0].kind.as_str(),
                doc.blocks[0].from,
                doc.blocks[0].to
            ),
            ("alt", 1, 1)
        );
        assert_eq!(doc.blocks[0].label.as_deref(), Some("success"));
        assert_eq!(
            (
                doc.blocks[1].kind.as_str(),
                doc.blocks[1].label.as_deref(),
                doc.blocks[1].from,
                doc.blocks[1].to
            ),
            ("alt", Some("failure"), 2, 2)
        );
        // opt spans message 3; the trailing message sits OUTSIDE every frame.
        assert_eq!(
            (
                doc.blocks[2].kind.as_str(),
                doc.blocks[2].from,
                doc.blocks[2].to
            ),
            ("opt", 3, 3)
        );
        assert_eq!(doc.messages.len(), 5);
    }

    /// An unterminated block still frames what it gathered (the family's
    /// degrade-never-fail rule).
    #[test]
    fn an_unterminated_block_frames_what_it_gathered() {
        let doc = parse_sequence(
            "sequenceDiagram\n  Alice ->> Bob: a\n  loop retry\n    Bob -->> Alice: b\n",
        )
        .expect("parse");
        assert_eq!(doc.blocks.len(), 1);
        assert_eq!(doc.blocks[0].kind, "loop");
        assert_eq!((doc.blocks[0].from, doc.blocks[0].to), (1, 1));
    }

    /// A block with NO messages paints nothing (empty spans are never
    /// recorded).
    #[test]
    fn an_empty_block_is_not_recorded() {
        let doc = parse_sequence(
            "sequenceDiagram\n  Alice ->> Bob: a\n  opt nothing\n  end\n  Alice ->> Bob: b\n",
        )
        .expect("parse");
        assert!(doc.blocks.is_empty());
        assert_eq!(doc.messages.len(), 2);
    }

    #[test]
    fn activation_markers_never_become_participant_names() {
        let doc = parse_sequence(
            "sequenceDiagram\n  participant Alice\n  participant Bob\n  Alice ->>+ Bob: hi\n  Bob -->>- Alice: yo\n",
        )
        .expect("parse");
        assert_eq!(
            doc.participants,
            vec!["Alice".to_string(), "Bob".to_string()]
        );
        for msg in &doc.messages {
            assert!(
                !msg.from.contains('+') && !msg.from.contains('-'),
                "{:?}",
                msg.from
            );
            assert!(
                !msg.to.contains('+') && !msg.to.contains('-'),
                "{:?}",
                msg.to
            );
        }
        // Every endpoint is a real participant, never a glyph-named lane.
        let endpoints: Vec<&str> = doc
            .messages
            .iter()
            .flat_map(|m| [m.from.as_str(), m.to.as_str()])
            .collect();
        assert_eq!(endpoints, vec!["Alice", "Bob", "Bob", "Alice"]);
    }

    #[test]
    fn a_participant_without_an_alias_keeps_its_name() {
        let doc = parse_sequence("sequenceDiagram\n  participant Only\n").expect("parse");
        assert_eq!(doc.participants, vec!["Only".to_string()]);
        assert!(doc.messages.is_empty());
    }
}
