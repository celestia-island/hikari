//! Markdown to VNode parser using pulldown-cmark.
//!
//! Supports standard Markdown elements and custom `_hikari_component` code blocks
//! for embedding interactive components.

use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use tairitsu_vdom::{VElement, VNode, VText};
use crate::reactive::{switch, button_counter, interactive_input};

/// Component types that can be embedded in markdown via `_hikari_component` code blocks.
#[derive(Debug, Clone, PartialEq)]
pub enum ComponentType {
    /// A layer component: (layer_name, component_name, optional_variant_id)
    Layer(String, String, Option<String>),
    /// A demo component: (category, demo_name, optional_variant_id)
    Demo(String, String, Option<String>),
    /// Interactive component: (component_type, params)
    Interactive(String, InteractiveParams),
    /// Plain code block (content)
    Code(String),
}

/// Parameters for interactive components.
#[derive(Debug, Clone, PartialEq)]
pub struct InteractiveParams {
    /// Label for the component
    pub label: Option<String>,
    /// Initial value/state
    pub initial: Option<String>,
    /// Placeholder text (for inputs)
    pub placeholder: Option<String>,
}

impl InteractiveParams {
    /// Parse params from a string like "label:My Label|initial:true|placeholder:Type here"
    pub fn parse(input: &str) -> Self {
        let mut label = None;
        let mut initial = None;
        let mut placeholder = None;

        for part in input.split('|') {
            let mut kv = part.splitn(2, ':');
            if let (Some(key), Some(value)) = (kv.next(), kv.next()) {
                match key.trim() {
                    "label" => label = Some(value.trim().to_string()),
                    "initial" => initial = Some(value.trim().to_string()),
                    "placeholder" => placeholder = Some(value.trim().to_string()),
                    _ => {}
                }
            }
        }

        Self {
            label,
            initial,
            placeholder,
        }
    }
}

/// Render markdown content to VNode tree wrapped in a markdown content container.
pub fn render_markdown(markdown: &str) -> VNode {
    let elements = parse_markdown(markdown);

    VNode::Element(
        VElement::new("div")
            .class("hi-markdown-content")
            .children(elements),
    )
}

/// Parse markdown and return a list of VNode elements.
fn parse_markdown(markdown: &str) -> Vec<VNode> {
    let mut elements = Vec::new();
    let mut in_code_block = false;
    let mut code_language = String::new();
    let mut code_content = String::new();
    let mut in_list = false;
    let mut list_items = Vec::new();
    let mut heading_level: Option<u32> = None;
    let mut heading_children = Vec::new();

    // Table parsing state
    let mut in_table = false;
    let mut in_table_head = false;
    let mut in_table_row = false;
    let mut in_table_cell = false;
    let mut table_headers: Vec<String> = Vec::new();
    let mut table_rows: Vec<Vec<String>> = Vec::new();
    let mut current_row: Vec<String> = Vec::new();
    let mut current_cell = String::new();

    // Link/Image parsing state
    let mut link_url = String::new();
    let mut link_title = String::new();
    let mut link_children = Vec::new();
    let mut image_url = String::new();
    let mut image_title = String::new();
    let mut image_alt = String::new();

    // Emphasis/Strong state
    let mut emphasis_children: Vec<VNode> = Vec::new();
    let mut strong_children: Vec<VNode> = Vec::new();

    let parser = Parser::new_ext(markdown, Options::all());

    for event in parser {
        match event {
            Event::Start(tag) => match tag {
                Tag::Paragraph => {
                    // Start of paragraph - will accumulate children
                }
                Tag::Heading { level, .. } => {
                    heading_level = Some(match level {
                        HeadingLevel::H1 => 1,
                        HeadingLevel::H2 => 2,
                        HeadingLevel::H3 => 3,
                        HeadingLevel::H4 => 4,
                        HeadingLevel::H5 => 5,
                        HeadingLevel::H6 => 6,
                    });
                    heading_children.clear();
                }
                Tag::BlockQuote(_) => {}
                Tag::CodeBlock(kind) => {
                    in_code_block = true;
                    code_language = extract_language(&kind);
                }
                Tag::List(_) => {
                    in_list = true;
                    list_items.clear();
                }
                Tag::Item => {}
                Tag::Link {
                    link_type: _,
                    dest_url,
                    title,
                    id: _,
                } => {
                    link_url = dest_url.to_string();
                    link_title = title.to_string();
                    link_children.clear();
                }
                Tag::Image {
                    link_type: _,
                    dest_url,
                    title,
                    id: _,
                } => {
                    image_url = dest_url.to_string();
                    image_title = title.to_string();
                    image_alt.clear();
                }
                Tag::Emphasis => {
                    emphasis_children.clear();
                }
                Tag::Strong => {
                    strong_children.clear();
                }
                Tag::Strikethrough => {}
                Tag::Table(_alignment) => {
                    in_table = true;
                    table_headers.clear();
                    table_rows.clear();
                }
                Tag::TableHead => {
                    in_table_head = true;
                    current_row.clear();
                }
                Tag::TableRow => {
                    in_table_row = true;
                    current_row.clear();
                }
                Tag::TableCell => {
                    in_table_cell = true;
                    current_cell.clear();
                }
                _ => {}
            },

            Event::End(tag_end) => match tag_end {
                TagEnd::Paragraph => {
                    // Paragraphs are handled through text events
                }
                TagEnd::Heading(_) => {
                    if let Some(level) = heading_level {
                        elements.push(render_heading(level, heading_children.clone()));
                    }
                    heading_level = None;
                    heading_children.clear();
                }
                TagEnd::BlockQuote(_) => {
                    // Block quotes are handled through text events
                }
                TagEnd::CodeBlock => {
                    if in_code_block {
                        in_code_block = false;
                        let component_type = parse_code_block(&code_language, &code_content);
                        elements.push(render_code_block(component_type));
                        code_language.clear();
                        code_content.clear();
                    }
                }
                TagEnd::List(_) => {
                    in_list = false;
                    elements.push(render_list(list_items.clone()));
                    list_items.clear();
                }
                TagEnd::Item => {}
                TagEnd::Link => {
                    elements.push(render_link(&link_url, &link_title, link_children.clone()));
                    link_url.clear();
                    link_title.clear();
                    link_children.clear();
                }
                TagEnd::Image => {
                    elements.push(render_image(&image_url, &image_title, &image_alt));
                    image_url.clear();
                    image_title.clear();
                    image_alt.clear();
                }
                TagEnd::Emphasis => {
                    emphasis_children.clear();
                }
                TagEnd::Strong => {
                    strong_children.clear();
                }
                TagEnd::Strikethrough => {}
                TagEnd::Table => {
                    if in_table {
                        in_table = false;
                        elements.push(render_table(table_headers.clone(), table_rows.clone()));
                        table_headers.clear();
                        table_rows.clear();
                    }
                }
                TagEnd::TableHead => {
                    in_table_head = false;
                    table_headers = current_row.clone();
                    current_row.clear();
                }
                TagEnd::TableRow => {
                    in_table_row = false;
                    if !current_row.is_empty() {
                        table_rows.push(current_row.clone());
                    }
                    current_row.clear();
                }
                TagEnd::TableCell => {
                    in_table_cell = false;
                    current_row.push(current_cell.trim().to_string());
                    current_cell.clear();
                }
                _ => {}
            },

            Event::Text(text) => {
                if in_code_block {
                    code_content.push_str(&text);
                } else if in_table_cell {
                    current_cell.push_str(&text);
                } else if in_list {
                    list_items.push(text.to_string());
                } else if heading_level.is_some() {
                    heading_children.push(VNode::Text(VText::new(&text)));
                } else if !link_url.is_empty() {
                    // Text inside a link
                    link_children.push(VNode::Text(VText::new(&text)));
                } else if !image_url.is_empty() {
                    // Alt text for image
                    image_alt.push_str(&text);
                } else {
                    // Regular paragraph text
                    elements.push(render_text(&text));
                }
            }

            Event::Code(text) => {
                if in_table_cell {
                    current_cell.push_str(&format!("`{}`", text));
                } else {
                    elements.push(render_inline_code(&text));
                }
            }

            Event::SoftBreak => {}
            Event::HardBreak => {
                elements.push(VNode::Element(VElement::new("br")));
            }
            Event::Rule => {
                elements.push(render_horizontal_rule());
            }

            Event::Html(html) => {
                elements.push(render_html(&html));
            }

            Event::FootnoteReference(_) => {}
            Event::TaskListMarker(_) => {}
            Event::InlineMath(_) => {}
            Event::DisplayMath(_) => {}
            Event::InlineHtml(_) => {}
        }
    }

    elements
}

/// Extract language from code block info.
fn extract_language(kind: &pulldown_cmark::CodeBlockKind) -> String {
    match kind {
        pulldown_cmark::CodeBlockKind::Fenced(info) => info.to_string(),
        _ => String::new(),
    }
}

/// Parse code block and determine its type.
fn parse_code_block(language: &str, content: &str) -> ComponentType {
    if language.starts_with("_inner_hikari") || language.starts_with("_hikari_component") {
        let path = content.trim();
        parse_component_path(path)
    } else if language.starts_with("_interactive") {
        // Parse interactive component syntax: _interactive component_name|params
        let parts: Vec<&str> = language.splitn(2, '_').collect();
        let remaining = parts.get(1).unwrap_or(&"");
        let comp_parts: Vec<&str> = remaining.splitn(2, ' ').collect();
        let component_type = comp_parts.first().map(|s| s.trim()).unwrap_or("");
        let params_str = comp_parts.get(1).unwrap_or(&"");
        let params = InteractiveParams::parse(params_str);
        ComponentType::Interactive(component_type.to_string(), params)
    } else {
        ComponentType::Code(content.to_string())
    }
}

/// Parse a component path like "layer1.button.variants" into a ComponentType.
fn parse_component_path(path: &str) -> ComponentType {
    let parts: Vec<&str> = path.split('.').collect();
    match parts.as_slice() {
        [layer, name] => ComponentType::Layer(layer.to_string(), name.to_string(), None),
        [layer, name, id] => ComponentType::Layer(
            layer.to_string(),
            name.to_string(),
            Some(id.to_string()),
        ),
        [category, demo, name] => ComponentType::Demo(
            category.to_string(),
            demo.to_string(),
            Some(name.to_string()),
        ),
        _ => ComponentType::Code(path.to_string()),
    }
}

/// Render a heading element.
fn render_heading(level: u32, children: Vec<VNode>) -> VNode {
    let tag = match level {
        1 => "h1",
        2 => "h2",
        3 => "h3",
        4 => "h4",
        5 => "h5",
        _ => "h6",
    };

    VNode::Element(
        VElement::new(tag)
            .children(children),
    )
}

/// Render plain text as a paragraph.
fn render_text(text: &str) -> VNode {
    VNode::Element(
        VElement::new("p")
            .child(VNode::Text(VText::new(text))),
    )
}

/// Render inline code.
fn render_inline_code(code: &str) -> VNode {
    VNode::Element(
        VElement::new("code")
            .class("hi-inline-code")
            .child(VNode::Text(VText::new(code))),
    )
}

/// Render a code block or component.
fn render_code_block(block_type: ComponentType) -> VNode {
    match block_type {
        ComponentType::Layer(ref layer, ref name, ref component_id) => {
            render_hikari_component(layer, name, component_id.as_deref())
        }
        ComponentType::Demo(ref category, ref name, ref component_id) => {
            render_demo_component(category, name, component_id.as_deref())
        }
        ComponentType::Interactive(ref comp_type, ref params) => {
            render_interactive_component(comp_type, params)
        }
        ComponentType::Code(ref content) => {
            VNode::Element(
                VElement::new("pre")
                    .class("hi-code-block")
                    .child(VNode::Element(
                        VElement::new("code")
                            .class("hi-code-content")
                            .child(VNode::Text(VText::new(content))),
                    )),
            )
        }
    }
}

/// Render a Hikari component from the registry.
fn render_hikari_component(layer: &str, name: &str, variant_id: Option<&str>) -> VNode {
    let path = if let Some(id) = variant_id {
        format!("{}.{}.{}", layer, name, id)
    } else {
        format!("{}.{}", layer, name)
    };

    let placeholder_text = format!("[{} component would be rendered here]", name);

    VNode::Element(
        VElement::new("div")
            .class("hi-component-demo")
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-inner-hikari-block")
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hi-inner-hikari-label")
                            .child(VNode::Text(VText::new("Hikari Component"))),
                    ))
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hi-inner-hikari-path")
                            .child(VNode::Text(VText::new(&path))),
                    ))
                    .child(VNode::Element(
                        VElement::new("div")
                            .attr("data-component", &path)
                            .class("component-placeholder")
                            .child(VNode::Text(VText::new(&placeholder_text))),
                    )),
            )),
    )
}

/// Render a demo component.
fn render_demo_component(category: &str, name: &str, variant_id: Option<&str>) -> VNode {
    let path = if let Some(id) = variant_id {
        format!("{}.{}.{}", category, name, id)
    } else {
        format!("{}.{}", category, name)
    };

    let placeholder_text = format!("[{} demo would be rendered here]", name);

    VNode::Element(
        VElement::new("div")
            .class("hi-component-demo")
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-inner-hikari-block")
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hi-inner-hikari-label")
                            .child(VNode::Text(VText::new("Demo Component"))),
                    ))
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hi-inner-hikari-path")
                            .child(VNode::Text(VText::new(&path))),
                    ))
                    .child(VNode::Element(
                        VElement::new("div")
                            .attr("data-demo", &path)
                            .class("demo-placeholder")
                            .child(VNode::Text(VText::new(&placeholder_text))),
                    )),
            )),
    )
}

/// Render a list.
fn render_list(items: Vec<String>) -> VNode {
    let mut li_elements: Vec<VNode> = Vec::new();
    for item in items {
        li_elements.push(VNode::Element(
            VElement::new("li")
                .class("hi-list-item")
                .child(VNode::Text(VText::new(&item))),
        ));
    }

    VNode::Element(
        VElement::new("ul")
            .class("hi-list")
            .children(li_elements),
    )
}

/// Render a horizontal rule.
fn render_horizontal_rule() -> VNode {
    VNode::Element(
        VElement::new("hr")
            .class("hi-hr"),
    )
}

/// Render HTML content.
fn render_html(html: &str) -> VNode {
    VNode::Element(
        VElement::new("div")
            .class("hi-html-content")
            .attr("data-html", html),
    )
}

/// Render a link.
fn render_link(url: &str, _title: &str, children: Vec<VNode>) -> VNode {
    VNode::Element(
        VElement::new("a")
            .attr("href", url)
            .children(children),
    )
}

/// Render an image.
fn render_image(url: &str, _title: &str, alt: &str) -> VNode {
    VNode::Element(
        VElement::new("img")
            .attr("src", url)
            .attr("alt", alt)
            .class("hi-markdown-image"),
    )
}

/// Render a table.
fn render_table(headers: Vec<String>, rows: Vec<Vec<String>>) -> VNode {
    let mut header_cells: Vec<VNode> = Vec::new();
    for header in headers {
        header_cells.push(VNode::Element(
            VElement::new("th")
                .child(VNode::Text(VText::new(&header))),
        ));
    }

    let mut row_elements: Vec<VNode> = Vec::new();
    for row in rows {
        let mut cells: Vec<VNode> = Vec::new();
        for cell in row {
            cells.push(VNode::Element(
                VElement::new("td")
                    .child(VNode::Text(VText::new(&cell))),
            ));
        }
        row_elements.push(VNode::Element(
            VElement::new("tr")
                .children(cells),
        ));
    }

    let thead = VNode::Element(
        VElement::new("thead")
            .child(VNode::Element(
                VElement::new("tr")
                    .children(header_cells),
            )),
    );

    let tbody = VNode::Element(
        VElement::new("tbody")
            .children(row_elements),
    );

    VNode::Element(
        VElement::new("table")
            .class("hi-markdown-table")
            .child(thead)
            .child(tbody),
    )
}

/// Render an interactive component with the given type and parameters.
fn render_interactive_component(comp_type: &str, params: &InteractiveParams) -> VNode {
    let label = params.label.as_deref();

    match comp_type {
        "switch" => {
            let checked = params.initial.as_deref()
                .and_then(|v| v.parse::<bool>().ok())
                .unwrap_or(false);
            let (_id, vnode) = switch(checked, label);
            vnode
        }
        "button-counter" | "counter" => {
            let count = params.initial.as_deref()
                .and_then(|v| v.parse::<u32>().ok())
                .unwrap_or(0);
            let (_id, vnode) = button_counter(count, label);
            vnode
        }
        "input" => {
            let value = params.initial.as_deref().unwrap_or("");
            let placeholder = params.placeholder.as_deref().unwrap_or("Enter text...");
            let (_id, vnode) = interactive_input(value, placeholder, label);
            vnode
        }
        _ => {
            VNode::Element(
                VElement::new("div")
                    .class("hi-interactive-error")
                    .child(VNode::Text(VText::new(&format!(
                        "Unknown interactive component: {}",
                        comp_type
                    )))),
            )
        }
    }
}
