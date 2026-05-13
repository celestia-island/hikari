use tairitsu_vdom::{VElement, VNode, VText};

pub fn render_markdown(content: &str) -> VNode {
    if content.trim().is_empty() {
        return VNode::default();
    }

    let blocks = parse_blocks(content);
    VNode::Element(
        VElement::new("div")
            .class("hi-markdown-content")
            .children(blocks),
    )
}

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

fn parse_inline(text: &str) -> Vec<VNode> {
    let mut nodes: Vec<VNode> = Vec::new();
    let mut remaining = text;
    let mut buf = String::new();

    while let Some(pos) = find_first_inline_marker(remaining) {
        buf.push_str(&remaining[..pos]);
        if !buf.is_empty() {
            nodes.push(txt(&buf));
            buf.clear();
        }

        let marker = &remaining[pos..];

        if marker
            .starts_with("![")
            .then(|| marker.get(2..).unwrap_or("").starts_with("["))
            == Some(true)
        {
            if let Some(end) = remaining[pos..].find("](") {
                let alt = &remaining[pos + 2..pos + end];
                let rest = &remaining[pos + end + 2..];
                if let Some(close) = rest.find(')') {
                    let url = &rest[..close];
                    nodes.push(VNode::Element(
                        VElement::new("img").attr("src", url).attr("alt", alt),
                    ));
                    remaining = &rest[close + 1..];
                    continue;
                }
            }
            buf.push_str("!");
        }

        if marker.starts_with('[') {
            if let Some(end) = remaining[pos..].find("](") {
                let link_text = &remaining[pos + 1..pos + end];
                let rest = &remaining[pos + end + 2..];
                if let Some(close) = rest.find(')') {
                    let url = &rest[..close];
                    let inner = parse_inline(link_text);
                    let mut el = VElement::new("a").attr("href", url);
                    for node in inner {
                        el = el.child(node);
                    }
                    nodes.push(VNode::Element(el));
                    remaining = &rest[close + 1..];
                    continue;
                }
            }
            buf.push('[');
            remaining = &remaining[pos + 1..];
            continue;
        }

        if marker.starts_with("**") || marker.starts_with("__") {
            let delim_len = 2;
            if let Some(end) = remaining[pos + delim_len..].find(&remaining[pos..pos + delim_len]) {
                let inner_text = &remaining[pos + delim_len..pos + delim_len + end];
                let mut el = VElement::new("strong");
                for node in parse_inline(inner_text) {
                    el = el.child(node);
                }
                nodes.push(VNode::Element(el));
                remaining = &remaining[pos + delim_len * 2 + end..];
                continue;
            }
        }

        if marker.starts_with('*') || marker.starts_with('_') {
            let delim_len = 1;
            if let Some(end) = remaining[pos + delim_len..].find(&remaining[pos..pos + delim_len]) {
                let inner_text = &remaining[pos + delim_len..pos + delim_len + end];
                let mut el = VElement::new("em");
                for node in parse_inline(inner_text) {
                    el = el.child(node);
                }
                nodes.push(VNode::Element(el));
                remaining = &remaining[pos + delim_len * 2 + end..];
                continue;
            }
        }

        if marker.starts_with('`') {
            let backtick_len = count_backticks(remaining[pos..].chars());
            if backtick_len >= 1 {
                let closing = &remaining[pos + backtick_len..];
                if let Some(end) = closing.find(&remaining[pos..pos + backtick_len]) {
                    let code_text = &closing[..end];
                    nodes.push(VNode::Element(VElement::new("code").child(txt(code_text))));
                    remaining = &closing[end + backtick_len..];
                    continue;
                }
            }
        }

        let ch = remaining.chars().next().unwrap_or(' ');
        buf.push(ch);
        remaining = &remaining[ch.len_utf8()..];
    }

    buf.push_str(remaining);
    if !buf.is_empty() {
        nodes.push(txt(&buf));
    }

    if nodes.is_empty() {
        nodes.push(txt(""));
    }
    nodes
}

fn find_first_inline_marker(s: &str) -> Option<usize> {
    let mut earliest: Option<usize> = None;
    let mut i = 0;
    let chars: Vec<char> = s.chars().collect();
    let len = chars.len();

    while i < len {
        let ch = chars[i];

        if ch == '\\' && i + 1 < len {
            i += 2;
            continue;
        }

        match ch {
            '[' | '*' | '_' | '`' => {
                if earliest.is_none() {
                    earliest = Some(i);
                }
                break;
            }
            '!' => {
                if i + 1 < len && chars[i + 1] == '[' && earliest.is_none() {
                    earliest = Some(i);
                }
                break;
            }
            _ => {}
        }
        i += 1;
    }

    earliest
}

fn count_backticks(chars: std::str::Chars<'_>) -> usize {
    let mut count = 0;
    for ch in chars {
        if ch == '`' {
            count += 1;
        } else {
            break;
        }
    }
    count
}

fn parse_blocks(content: &str) -> Vec<VNode> {
    let mut nodes: Vec<VNode> = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;
    let len = lines.len();

    while i < len {
        let line = lines[i];

        if line.trim().is_empty() {
            i += 1;
            continue;
        }

        if let Some(heading_level) = parse_atx_heading(line) {
            let text = line[heading_level..].trim();
            let tag = format!("h{}", heading_level);
            let mut el = VElement::new(&tag);
            for node in parse_inline(text) {
                el = el.child(node);
            }
            nodes.push(VNode::Element(el));
            i += 1;
            continue;
        }

        if is_horizontal_rule(line) {
            nodes.push(VNode::Element(VElement::new("hr")));
            i += 1;
            continue;
        }

        if line.trim_start().starts_with("```") {
            let (block, consumed) = parse_code_block(&lines, i);
            nodes.push(block);
            i += consumed;
            continue;
        }

        if is_table_row(line) && i + 1 < len && is_table_separator(&lines[i + 1]) {
            let (table, consumed) = parse_table(&lines, i);
            nodes.push(table);
            i += consumed;
            continue;
        }

        if is_unordered_list_item(line) {
            let (list, consumed) = parse_unordered_list(&lines, i);
            nodes.push(list);
            i += consumed;
            continue;
        }

        if is_ordered_list_item(line) {
            let (list, consumed) = parse_ordered_list(&lines, i);
            nodes.push(list);
            i += consumed;
            continue;
        }

        let mut paragraph_lines: Vec<&str> = Vec::new();
        while i < len && !lines[i].trim().is_empty() && !is_block_start(lines[i]) {
            paragraph_lines.push(lines[i]);
            i += 1;
        }
        if !paragraph_lines.is_empty() {
            let text = paragraph_lines.join("\n");
            let mut el = VElement::new("p");
            for node in parse_inline(&text) {
                el = el.child(node);
            }
            nodes.push(VNode::Element(el));
        }
    }

    nodes
}

fn is_block_start(line: &str) -> bool {
    let trimmed = line.trim();
    parse_atx_heading(trimmed).is_some()
        || is_horizontal_rule(trimmed)
        || trimmed.starts_with("```")
        || is_unordered_list_item(trimmed)
        || is_ordered_list_item(trimmed)
}

fn parse_atx_heading(line: &str) -> Option<usize> {
    let trimmed = line.trim_start();
    let mut count = 0;
    for ch in trimmed.chars() {
        if ch == '#' {
            count += 1;
        } else {
            break;
        }
    }
    if (1..=6).contains(&count) && trimmed.chars().nth(count) == Some(' ') {
        Some(count)
    } else {
        None
    }
}

fn is_horizontal_rule(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.len() < 3 {
        return false;
    }
    let first = match trimmed.chars().next() {
        Some(ch) => ch,
        None => return false,
    };
    if first != '-' && first != '*' && first != '_' {
        return false;
    }
    trimmed
        .chars()
        .all(|ch| ch == first || ch == ' ' || ch == '\t')
}

fn is_unordered_list_item(line: &str) -> bool {
    let trimmed = line.trim_start();
    trimmed.starts_with("- ") || trimmed.starts_with("* ") || trimmed.starts_with("+ ")
}

fn is_ordered_list_item(line: &str) -> bool {
    let trimmed = line.trim_start();
    let mut pos = 0;
    for ch in trimmed.chars() {
        if ch.is_ascii_digit() {
            pos += 1;
        } else {
            break;
        }
    }
    pos > 0 && trimmed.len() > pos + 1 && &trimmed[pos..pos + 2] == ". "
}

fn parse_unordered_list(lines: &[&str], start: usize) -> (VNode, usize) {
    let mut items: Vec<VNode> = Vec::new();
    let mut i = start;

    while i < lines.len() && is_unordered_list_item(lines[i]) {
        let text = lines[i].trim_start();
        let content = &text[2..];
        let mut el = VElement::new("li");
        for node in parse_inline(content) {
            el = el.child(node);
        }
        items.push(VNode::Element(el));
        i += 1;
    }

    let el = VElement::new("ul").children(items);
    (VNode::Element(el), i - start)
}

fn parse_ordered_list(lines: &[&str], start: usize) -> (VNode, usize) {
    let mut items: Vec<VNode> = Vec::new();
    let mut i = start;

    while i < lines.len() && is_ordered_list_item(lines[i]) {
        let text = lines[i].trim_start();
        let dot_pos = match text.find(". ") {
            Some(pos) => pos,
            None => continue,
        };
        let content = &text[dot_pos + 2..];
        let mut el = VElement::new("li");
        for node in parse_inline(content) {
            el = el.child(node);
        }
        items.push(VNode::Element(el));
        i += 1;
    }

    let el = VElement::new("ol").children(items);
    (VNode::Element(el), i - start)
}

fn parse_code_block(lines: &[&str], start: usize) -> (VNode, usize) {
    let first_line = lines[start].trim_start();
    let lang = first_line.trim_start_matches('`').trim();

    let mut code_lines: Vec<&str> = Vec::new();
    let mut i = start + 1;

    while i < lines.len() {
        if lines[i].trim_start().starts_with("```") {
            i += 1;
            break;
        }
        code_lines.push(lines[i]);
        i += 1;
    }

    let code_text = code_lines.join("\n");
    let class = if lang.is_empty() {
        "hi-code-block".to_string()
    } else {
        format!("hi-code-block language-{}", lang)
    };

    let code_el = VElement::new("code").class(&*class).child(txt(&code_text));
    let pre_el = VElement::new("pre").child(VNode::Element(code_el));
    (VNode::Element(pre_el), i - start)
}

fn is_table_row(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.starts_with('|') && trimmed.contains('|') && trimmed.len() > 2
}

fn is_table_separator(line: &str) -> bool {
    let trimmed = line.trim();
    if !trimmed.starts_with('|') || !trimmed.ends_with('|') {
        return false;
    }
    let inner = trimmed.trim_start_matches('|').trim_end_matches('|');
    let cells: Vec<&str> = inner.split('|').collect();
    if cells.is_empty() {
        return false;
    }
    cells.iter().all(|cell| {
        let cell = cell.trim();
        cell.is_empty() || cell.chars().all(|ch| ch == '-' || ch == ':' || ch == ' ')
    })
}

fn parse_table(lines: &[&str], start: usize) -> (VNode, usize) {
    let header_line = lines[start];
    let _sep_line = lines[start + 1];

    let headers = parse_table_cells(header_line);

    let mut body_rows: Vec<VNode> = Vec::new();
    let mut i = start + 2;

    while i < lines.len() && is_table_row(lines[i]) && !is_table_separator(lines[i]) {
        let cells = parse_table_cells(lines[i]);
        let row_nodes: Vec<VNode> = cells
            .iter()
            .map(|cell| {
                let mut el = VElement::new("td");
                for node in parse_inline(cell) {
                    el = el.child(node);
                }
                VNode::Element(el)
            })
            .collect();
        body_rows.push(VNode::Element(VElement::new("tr").children(row_nodes)));
        i += 1;
    }

    let header_nodes: Vec<VNode> = headers
        .iter()
        .map(|cell| {
            let mut el = VElement::new("th");
            for node in parse_inline(cell) {
                el = el.child(node);
            }
            VNode::Element(el)
        })
        .collect();

    let thead = VNode::Element(
        VElement::new("thead").child(VNode::Element(VElement::new("tr").children(header_nodes))),
    );
    let tbody = VNode::Element(VElement::new("tbody").children(body_rows));

    let table = VElement::new("table").child(thead).child(tbody);
    (VNode::Element(table), i - start)
}

fn parse_table_cells(line: &str) -> Vec<String> {
    let trimmed = line.trim();
    let inner = trimmed.trim_start_matches('|').trim_end_matches('|');
    inner
        .split('|')
        .map(|cell| cell.trim().to_string())
        .collect()
}
