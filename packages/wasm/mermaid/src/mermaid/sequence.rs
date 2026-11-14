//! Sequence diagram parser — semantic mirror of parseSequence.ts.
//!
//! The arrow search order matters: `-->>` before `->>` before `-->`
//! before `->` — a long token must never be misread as its shorter
//! prefix (`A-->>B` must not parse as `A-` + `->>B`).

use super::types::{SeqArrowKind, SequenceDiagram, SequenceMessage};

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

    for line in source.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("%%") {
            continue;
        }
        if line.starts_with("sequenceDiagram") {
            continue;
        }
        if let Some(p) = line.strip_prefix("participant ") {
            let name = p.trim().to_string();
            if !name.is_empty() && !participants.contains(&name) {
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

    // A diagram with declared participants but no messages is still valid
    // (the TS parser's contract); only completely empty input is None.
    if participants.is_empty() {
        return None;
    }
    Some(SequenceDiagram { participants, messages })
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
                from,
                to,
                text,
                arrow_kind: *kind,
            });
        }
    }
    None
}
