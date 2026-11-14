//! Sequence diagram parser — from ratatui-markdown v0.3.6, parse logic only.

use super::types::{SeqArrowKind, SequenceDiagram, SequenceMessage};

pub fn parse_sequence(source: &str) -> Option<SequenceDiagram> {
    let mut participants: Vec<String> = Vec::new();
    let mut messages: Vec<SequenceMessage> = Vec::new();

    for line in source.lines() {
        let line = line.trim();
        if line.is_empty() {
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

    if messages.is_empty() {
        return None;
    }
    Some(SequenceDiagram { participants, messages })
}

fn parse_message(line: &str) -> Option<SequenceMessage> {
    // Arrow patterns: ->>, -->>, ->, -->
    for (pattern, kind) in [
        ("->>", SeqArrowKind::Solid),
        ("-->>", SeqArrowKind::Dotted),
        ("->", SeqArrowKind::SolidOpen),
        ("-->", SeqArrowKind::DottedOpen),
    ] {
        if let Some(idx) = line.find(pattern) {
            let from = line[..idx].trim().to_string();
            let rest = &line[idx + pattern.len()..];
            let to_text: Vec<&str> = rest.splitn(2, ':').collect();
            let to = to_text.first()?.trim().to_string();
            let text = to_text.get(1).unwrap_or(&"").trim().to_string();
            if from.is_empty() || to.is_empty() {
                continue;
            }
            return Some(SequenceMessage { from, to, text, arrow_kind: kind });
        }
    }
    None
}
