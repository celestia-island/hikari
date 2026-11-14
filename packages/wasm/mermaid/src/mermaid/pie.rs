//! Pie chart parser — from ratatui-markdown v0.3.6, parse logic only.

use super::types::PieChart;

pub fn parse_pie(source: &str) -> Option<PieChart> {
    let mut title: Option<String> = None;
    let mut slices: Vec<(String, f64)> = Vec::new();

    for line in source.lines() {
        let line = line.trim();
        if line.is_empty() {
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

fn parse_slice(line: &str) -> Option<(String, f64)> {
    let idx = line.rfind(':')?;
    let label = line[..idx].trim().to_string();
    let value: f64 = line[idx + 1..].trim().parse().ok()?;
    if label.is_empty() {
        return None;
    }
    Some((label, value))
}
