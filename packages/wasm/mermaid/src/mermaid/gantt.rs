//! Gantt chart parser — from ratatui-markdown v0.3.6, parse logic only.

use super::types::{GanttChart, GanttSection, GanttTask};

pub fn parse_gantt(source: &str) -> Option<GanttChart> {
    let mut title: Option<String> = None;
    let mut sections: Vec<GanttSection> = Vec::new();

    for line in source.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if line.starts_with("gantt") {
            let rest = line.strip_prefix("gantt").unwrap_or("").trim();
            if let Some(t) = rest.strip_prefix("title ") {
                title = Some(t.trim().to_string());
            }
            continue;
        }
        if let Some(t) = line.strip_prefix("title ") {
            title = Some(t.trim().to_string());
            continue;
        }
        if let Some(sec) = line.strip_prefix("section ") {
            sections.push(GanttSection {
                name: sec.trim().to_string(),
                tasks: Vec::new(),
            });
            continue;
        }
        if let Some(task) = parse_task(line) {
            if let Some(last) = sections.last_mut() {
                last.tasks.push(task);
            }
        }
    }

    if sections.is_empty() {
        return None;
    }
    Some(GanttChart { title, sections })
}

fn parse_task(line: &str) -> Option<GanttTask> {
    let mut parts = line.split(':');
    let name = parts.next()?.trim().to_string();
    if name.is_empty() {
        return None;
    }
    let rest = parts.next().unwrap_or("").trim();
    let mut task = GanttTask {
        name,
        id: None,
        deps: Vec::new(),
        duration: None,
    };
    for part in rest.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        if let Some(id) = part.strip_prefix("id=") {
            task.id = Some(id.to_string());
        } else if let Some(d) = part.strip_prefix("dur=") {
            task.duration = Some(d.to_string());
        } else if part.starts_with("after ") {
            for dep in part.strip_prefix("after ").unwrap_or("").split(' ') {
                let dep = dep.trim();
                if !dep.is_empty() {
                    task.deps.push(dep.to_string());
                }
            }
        }
    }
    Some(task)
}
