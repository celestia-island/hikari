use tairitsu_vdom::{VElement, VNode, VText};

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

fn render_inline(text: &str) -> Vec<VNode> {
    let mut nodes: Vec<VNode> = Vec::new();
    let mut rest = text;
    while !rest.is_empty() {
        if rest.starts_with("**") {
            if let Some(end) = rest[2..].find("**") {
                nodes.push(VNode::Element(
                    VElement::new("strong").child(txt(&rest[2..end + 2])),
                ));
                rest = &rest[end + 4..];
                continue;
            }
        }
        if rest.starts_with('*') {
            if let Some(end) = rest[1..].find('*') {
                nodes.push(VNode::Element(
                    VElement::new("em").child(txt(&rest[1..end + 1])),
                ));
                rest = &rest[end + 2..];
                continue;
            }
        }
        if rest.starts_with('`') {
            if let Some(end) = rest[1..].find('`') {
                nodes.push(VNode::Element(
                    VElement::new("code").child(txt(&rest[1..end + 1])),
                ));
                rest = &rest[end + 2..];
                continue;
            }
        }
        if let Some(next_fmt) = rest.find(|c: char| c == '*' || c == '`') {
            if next_fmt > 0 {
                nodes.push(txt(&rest[..next_fmt]));
                rest = &rest[next_fmt..];
            }
        } else {
            nodes.push(txt(rest));
            break;
        }
    }
    if nodes.is_empty() {
        nodes.push(txt(text));
    }
    nodes
}

fn render_list_line(line: &str) -> VNode {
    let trimmed = line.trim_start_matches("- ").trim_start_matches("* ");
    let children = render_inline(trimmed);
    VNode::Element(VElement::new("li").children(children))
}

pub fn render_markdown_simple(content: &str) -> VNode {
    let mut nodes: Vec<VNode> = Vec::new();
    let mut lines = content.lines().peekable();
    let mut in_code_block = false;
    let mut code_buf = String::new();
    let mut code_lang = String::new();

    while let Some(line) = lines.next() {
        if in_code_block {
            if line.starts_with("```") {
                in_code_block = false;
                let code_node = VNode::Element(
                    VElement::new("pre")
                        .class("hi-code-block")
                        .child(VNode::Element(VElement::new("code").child(txt(&code_buf)))),
                );
                let mut block_children = Vec::new();
                if !code_lang.is_empty() {
                    block_children.push(VNode::Element(
                        VElement::new("div")
                            .class("hi-code-block-header")
                            .child(txt(&code_lang)),
                    ));
                }
                block_children.push(code_node);
                nodes.push(VNode::Element(
                    VElement::new("div")
                        .class("hi-markdown-code-block")
                        .children(block_children),
                ));
                code_buf.clear();
                code_lang.clear();
            } else {
                if !code_buf.is_empty() {
                    code_buf.push('\n');
                }
                code_buf.push_str(line);
            }
            continue;
        }

        if line.starts_with("```") {
            in_code_block = true;
            code_lang = line.trim_start_matches('`').trim().to_string();
            continue;
        }

        if line.starts_with("### ") {
            nodes.push(VNode::Element(
                VElement::new("h3").child(txt(line.trim_start_matches("### ").trim())),
            ));
        } else if line.starts_with("## ") {
            nodes.push(VNode::Element(
                VElement::new("h2").child(txt(line.trim_start_matches("## ").trim())),
            ));
        } else if line.starts_with("# ") {
            nodes.push(VNode::Element(
                VElement::new("h1").child(txt(line.trim_start_matches("# ").trim())),
            ));
        } else if line.starts_with("- ") || line.starts_with("* ") {
            let mut items: Vec<VNode> = Vec::new();
            items.push(render_list_line(line));
            while let Some(next) = lines.peek() {
                if next.starts_with("- ") || next.starts_with("* ") {
                    items.push(render_list_line(lines.next().expect("peeked line exists")));
                } else {
                    break;
                }
            }
            nodes.push(VNode::Element(VElement::new("ul").children(items)));
        } else if line.starts_with("- ") || line.starts_with("* ") {
            nodes.push(render_list_line(line));
        } else if line.trim().is_empty() {
            continue;
        } else {
            let inline = render_inline(line);
            nodes.push(VNode::Element(VElement::new("p").children(inline)));
        }
    }

    VNode::Element(
        VElement::new("div")
            .class("hi-markdown-content")
            .children(nodes),
    )
}
