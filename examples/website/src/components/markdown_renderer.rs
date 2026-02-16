// website/src/components/markdown_renderer.rs
// Markdown to HTML component using pulldown-cmark
// Supports custom code blocks like ```_hikari_component

use _components::{ColumnDef, Table};
use dioxus::prelude::*;
use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};

use crate::components::registry::{parse_component_path, render_component, ComponentType};

/// Render markdown content to Dioxus elements
pub fn render_markdown(markdown: &str) -> Element {
    let elements = parse_markdown(markdown);

    rsx! {
        div {
            class: "hi-markdown-content",
            for element in elements {
                {element}
            }
        }
    }
}

/// Parse markdown and return a list of Dioxus elements
fn parse_markdown(markdown: &str) -> Vec<Element> {
    let mut elements = Vec::new();
    let mut in_code_block = false;
    let mut code_language = String::new();
    let mut code_content = String::new();
    let mut in_list = false;
    let mut list_items = Vec::new();
    let mut heading_level: Option<u32> = None;
    let mut heading_text = String::new();

    // Table parsing state
    let mut in_table = false;
    let mut in_table_head = false;
    let mut in_table_row = false;
    let mut in_table_cell = false;
    let mut table_headers: Vec<String> = Vec::new();
    let mut table_rows: Vec<Vec<String>> = Vec::new();
    let mut current_row: Vec<String> = Vec::new();
    let mut current_cell = String::new();

    let parser = Parser::new_ext(markdown, Options::all());

    for event in parser {
        match event {
            Event::Start(tag) => match tag {
                Tag::Paragraph => {}
                Tag::Heading { level, .. } => {
                    heading_level = Some(match level {
                        HeadingLevel::H1 => 1,
                        HeadingLevel::H2 => 2,
                        HeadingLevel::H3 => 3,
                        HeadingLevel::H4 => 4,
                        HeadingLevel::H5 => 5,
                        HeadingLevel::H6 => 6,
                    });
                    heading_text.clear();
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
                    dest_url: _,
                    title: _,
                    id: _,
                } => {}
                Tag::Image {
                    link_type: _,
                    dest_url: _,
                    title: _,
                    id: _,
                } => {}
                Tag::Emphasis => {}
                Tag::Strong => {}
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
                TagEnd::Paragraph => {}
                TagEnd::Heading(_) => {
                    if let Some(level) = heading_level {
                        elements.push(render_heading(level, &heading_text));
                    }
                    heading_level = None;
                    heading_text.clear();
                }
                TagEnd::BlockQuote(_) => {}
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
                TagEnd::Link => {}
                TagEnd::Image => {}
                TagEnd::Emphasis => {}
                TagEnd::Strong => {}
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
                    heading_text.push_str(&text);
                } else {
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
            Event::HardBreak => {}
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

/// Extract language from code block info
fn extract_language(kind: &pulldown_cmark::CodeBlockKind) -> String {
    match kind {
        pulldown_cmark::CodeBlockKind::Fenced(info) => info.to_string(),
        _ => String::new(),
    }
}

/// Parse code block and determine its type
fn parse_code_block(language: &str, content: &str) -> ComponentType {
    if language.starts_with("_inner_hikari") || language.starts_with("_hikari_component") {
        let path = content.trim();

        if let Some(ct) = parse_component_path(path) {
            ct
        } else {
            ComponentType::Code(content.to_string())
        }
    } else {
        ComponentType::Code(content.to_string())
    }
}

/// Render a heading element
fn render_heading(level: u32, text: &str) -> Element {
    let size = match level {
        1 => "hi-text-3xl",
        2 => "hi-text-2xl",
        3 => "hi-text-xl",
        _ => "hi-text-lg",
    };

    rsx! {
        div {
            class: size,
            "{text}"
        }
    }
}

/// Render plain text
fn render_text(text: &str) -> Element {
    rsx! {
        p {
            class: "hi-text-base",
            "{text}"
        }
    }
}

/// Render inline code
fn render_inline_code(code: &str) -> Element {
    rsx! {
        code {
            class: "hi-inline-code",
            "{code}"
        }
    }
}

/// Render a code block
fn render_code_block(block_type: ComponentType) -> Element {
    match block_type {
        ComponentType::Layer(ref layer, ref name, ref component_id) => {
            rsx! {
                div {
                    class: "hi-component-demo",
                    {render_component(ComponentType::Layer(layer.clone(), name.clone(), component_id.clone()))}
                }
            }
        }
        ComponentType::Demo(ref category, ref name, ref component_id) => {
            rsx! {
                div {
                    class: "hi-component-demo",
                    {render_component(ComponentType::Demo(category.clone(), name.clone(), component_id.clone()))}
                }
            }
        }
        ComponentType::Code(ref content) => {
            rsx! {
                {render_component(ComponentType::Code(content.clone()))}
            }
        }
    }
}

/// Render a list
fn render_list(items: Vec<String>) -> Element {
    rsx! {
        ul {
            class: "hi-list",
            for item in items {
                li {
                    class: "hi-list-item",
                    "{item}"
                }
            }
        }
    }
}

/// Render a horizontal rule
fn render_horizontal_rule() -> Element {
    rsx! {
        hr {
            class: "hi-hr"
        }
    }
}

/// Render HTML content
fn render_html(html: &str) -> Element {
    rsx! {
        div {
            class: "hi-html-content",
            dangerous_inner_html: "{html}"
        }
    }
}

/// MarkdownRenderer component
#[component]
pub fn MarkdownRenderer(
    #[props(into)] content: String,
    #[props(default)] class: String,
) -> Element {
    let markdown_content = content.clone();

    rsx! {
        div {
            class: format!("hi-markdown {}", class),
            {render_markdown(&markdown_content)}
        }
    }
}

/// Render a table using the component library's Table component
fn render_table(headers: Vec<String>, rows: Vec<Vec<String>>) -> Element {
    let columns: Vec<ColumnDef> = headers
        .iter()
        .enumerate()
        .map(|(i, header)| ColumnDef::new(format!("col_{}", i), header.clone()))
        .collect();

    rsx! {
        div {
            class: "hi-markdown-table",
            Table {
                columns: columns,
                data: rows,
                bordered: true,
                striped: true,
                hoverable: true,
            }
        }
    }
}
