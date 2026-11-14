//! Pie chart parser — semantic mirror of parsePie.ts.
//!
//! Slices are `"Label": 12.5` (quoted — value follows the closing quote,
//! colon optional) or `Label: 12.5` (unquoted — LAST colon splits label
//! from value). Values must parse as positive numbers.

use super::types::{PieChart, PieSlice};

pub fn parse_pie(source: &str) -> Option<PieChart> {
    let mut title: Option<String> = None;
    let mut slices: Vec<PieSlice> = Vec::new();

    for line in source.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("%%") {
            continue;
        }
        if line.starts_with("pie") {
            let rest = line.strip_prefix("pie").unwrap_or("").trim();
            if let Some(t) = rest.strip_prefix("title ") {
                title = Some(t.trim().to_string());
            }
            continue;
        }
        if let Some(t) = line.strip_prefix("title ") {
            title = Some(t.trim().to_string());
            continue;
        }
        if let Some(slice) = parse_slice(line) {
            slices.push(slice);
        }
    }

    if slices.is_empty() {
        return None;
    }
    Some(PieChart { title, slices })
}

fn parse_slice(line: &str) -> Option<PieSlice> {
    let (label_part, value_part): (String, String);
    if let Some(rest) = line.strip_prefix('"') {
        // Quoted: value follows the closing quote; colon optional.
        let end_quote = rest.find('"')?;
        label_part = rest[..end_quote].to_string();
        let after = rest[end_quote + 1..].trim();
        let after = after.strip_prefix(':').unwrap_or(after).trim();
        value_part = after.to_string();
    } else {
        // Unquoted: LAST colon splits label from value.
        let idx = line.rfind(':')?;
        label_part = line[..idx].trim().to_string();
        value_part = line[idx + 1..].trim().to_string();
    }
    if label_part.is_empty() {
        return None;
    }
    let value: f64 = value_part.parse().ok()?;
    if !value.is_finite() || value <= 0.0 {
        return None;
    }
    Some(PieSlice { label: label_part, value })
}
