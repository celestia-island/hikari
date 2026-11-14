//! Quadrant chart parser — semantic mirror of parseQuadrant.ts.

use super::types::*;

pub fn parse_quadrant(source: &str) -> Option<MermaidQuadrantDoc> {
    let mut title: Option<String> = None;
    let mut x_axis_left = String::new();
    let mut x_axis_right = String::new();
    let mut y_axis_bottom = String::new();
    let mut y_axis_top = String::new();
    let mut quadrants: Vec<Option<String>> = vec![None, None, None, None];
    let mut points: Vec<QuadrantPoint> = Vec::new();

    for raw in source.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('%') {
            continue;
        }
        if let Some(rest) = line.strip_prefix("quadrantChart") {
            let part = rest.trim();
            if !part.is_empty() {
                title = Some(part.to_string());
            }
            continue;
        }
        if let Some(t) = line.strip_prefix("title ") {
            title = Some(t.trim().to_string());
            continue;
        }
        if let Some(rest) = line.strip_prefix("x-axis ") {
            let parts: Vec<&str> = rest.split("-->").collect();
            if parts.len() == 2 {
                x_axis_left = parts[0].trim().to_string();
                x_axis_right = parts[1].trim().to_string();
            }
            continue;
        }
        if let Some(rest) = line.strip_prefix("y-axis ") {
            let parts: Vec<&str> = rest.split("-->").collect();
            if parts.len() == 2 {
                y_axis_bottom = parts[0].trim().to_string();
                y_axis_top = parts[1].trim().to_string();
            }
            continue;
        }
        // quadrant-N Caption (or bare quadrant-N = default QN)
        let mut matched = false;
        for i in 0..4u8 {
            let prefix = format!("quadrant-{} ", i + 1);
            let alt = format!("quadrant-{}", i + 1);
            if line.starts_with(&prefix) {
                quadrants[i as usize] = Some(line[prefix.len()..].trim().to_string());
                matched = true;
            } else if line == alt {
                quadrants[i as usize] = Some(format!("Q{}", i + 1));
                matched = true;
            }
        }
        if matched {
            continue;
        }
        // Point: Label: [x, y]
        if let Some(colon) = line.find(':') {
            let label = line[..colon].trim().to_string();
            let rest = line[colon + 1..].trim();
            if let (Some(open), Some(close)) = (rest.find('['), rest.find(']')) {
                if open < close {
                    let coords = rest[open + 1..close].trim();
                    let parts: Vec<&str> = coords.split(',').collect();
                    if parts.len() == 2 {
                        let x: f64 = parts[0].trim().parse().unwrap_or(f64::NAN);
                        let y: f64 = parts[1].trim().parse().unwrap_or(f64::NAN);
                        if x.is_finite() && y.is_finite() && !label.is_empty() {
                            points.push(QuadrantPoint { label, x, y });
                        }
                    }
                }
            }
        }
    }

    if points.is_empty() {
        return None;
    }
    Some(MermaidQuadrantDoc {
        title,
        x_axis_left,
        x_axis_right,
        y_axis_bottom,
        y_axis_top,
        quadrants,
        points,
    })
}
