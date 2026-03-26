//! Dynamic documentation page component.
//!
//! Provides a generic documentation page that loads markdown content
//! dynamically based on the current route and language.

use crate::dynamic_docs::{DocPage, render_doc_loader_script};
use tairitsu_vdom::{VElement, VNode, VText};

/// Documentation page with routing support.
///
/// This component renders a full documentation page with proper
/// header, content area, and error handling.
///
/// # Arguments
///
/// * `doc_path` - The documentation path (e.g., "components/layer1/button")
/// * `language` - The language code (e.g., "en-US", "zh-CHS")
/// * `title` - Optional page title (defaults to doc_path)
pub fn DocumentationPage(doc_path: String, language: String, title: Option<String>) -> VNode {
    let page_title = title.unwrap_or_else(|| {
        // Generate a readable title from the doc path
        doc_path
            .split('/')
            .last()
            .unwrap_or("Documentation")
            .replace('-', " ")
            .replace('_', " ")
            .chars()
            .enumerate()
            .map(|(i, c)| {
                if i == 0 || c.is_whitespace() {
                    c.to_uppercase().collect::<Vec<_>>()[0]
                } else {
                    c
                }
            })
            .collect()
    });

    VNode::Element(
        VElement::new("div")
            .attr("id", &format!("page-doc-{}", doc_path.replace('/', "-")))
            .attr("data-doc-path", &doc_path)
            .attr("data-language", &language)
            .class("hikari-page hikari-doc-page")
            // Page header
            .child(VNode::Element(
                VElement::new("div")
                    .class("page-header")
                    .child(VNode::Element(
                        VElement::new("h1")
                            .class("page-header__title")
                            .child(VNode::Text(VText::new(&page_title))),
                    ))
                    .child(VNode::Element(
                        VElement::new("p")
                            .class("page-header__subtitle")
                            .child(VNode::Text(VText::new(&format!("Documentation from: {}", doc_path)))),
                    )),
            ))
            // Dynamic content area
            .child(VNode::Element(
                VElement::new("div")
                    .class("page-section")
                    .child(DocPage(
                        doc_path.clone(),
                        language.clone(),
                        Some(page_title.clone()),
                    )),
            ))
            // Doc loader script
            .child(render_doc_loader_script()),
    )
}

/// Component documentation page.
///
/// Specialized page for component documentation with additional
/// component-specific metadata and styling.
///
/// # Arguments
///
/// * `component_path` - Component path (e.g., "layer1/button")
/// * `language` - The language code
/// * `layer` - The component layer (1, 2, or 3)
pub fn ComponentDocPage(component_path: String, language: String, layer: u8) -> VNode {
    let layer_name = match layer {
        1 => "Base Components",
        2 => "Composed Components",
        3 => "Complex Components",
        _ => "Components",
    };

    let title = format!("Layer {} — {}", layer, component_path.split('/').last().unwrap_or("Component"));

    VNode::Element(
        VElement::new("div")
            .attr("id", &format!("page-component-{}", component_path.replace('/', "-")))
            .attr("data-component-path", &component_path)
            .attr("data-layer", &layer.to_string())
            .attr("data-language", &language)
            .class("hikari-page hikari-component-doc-page")
            // Page header with layer badge
            .child(VNode::Element(
                VElement::new("div")
                    .class("page-header")
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("component-doc-badge")
                            .child(VNode::Element(
                                VElement::new("span")
                                    .class("component-doc-badge__layer")
                                    .child(VNode::Text(VText::new(&format!("Layer {}", layer)))),
                            ))
                            .child(VNode::Element(
                                VElement::new("span")
                                    .class("component-doc-badge__category")
                                    .child(VNode::Text(VText::new(layer_name))),
                            )),
                    ))
                    .child(VNode::Element(
                        VElement::new("h1")
                            .class("page-header__title")
                            .child(VNode::Text(VText::new(&title))),
                    )),
            ))
            // Dynamic content area
            .child(VNode::Element(
                VElement::new("div")
                    .class("page-section page-section--component")
                    .child(DocPage(
                        format!("components/{}", component_path),
                        language.clone(),
                        Some(title.clone()),
                    )),
            ))
            // Component navigation
            .child(VNode::Element(
                VElement::new("div")
                    .class("component-doc-nav")
                    .child(VNode::Element(
                        VElement::new("a")
                            .attr("href", &format!("/components/layer{}", layer))
                            .class("component-doc-nav__link component-doc-nav__link--back")
                            .child(VNode::Text(VText::new(&format!("← Back to Layer {}", layer)))),
                    )),
            ))
            // Doc loader script
            .child(render_doc_loader_script()),
    )
}

/// System documentation page.
///
/// Specialized page for system documentation (theme, i18n, etc.).
///
/// # Arguments
///
/// * `system_path` - System doc path (e.g., "palette", "i18n")
/// * `language` - The language code
pub fn SystemDocPage(system_path: String, language: String) -> VNode {
    let title = system_path
        .replace('-', " ")
        .replace('_', " ")
        .chars()
        .enumerate()
        .map(|(i, c)| {
            if i == 0 {
                c.to_uppercase().collect::<Vec<_>>()[0]
            } else {
                c
            }
        })
        .collect::<String>();

    VNode::Element(
        VElement::new("div")
            .attr("id", &format!("page-system-{}", system_path))
            .attr("data-system-path", &system_path)
            .attr("data-language", &language)
            .class("hikari-page hikari-system-doc-page")
            // Page header
            .child(VNode::Element(
                VElement::new("div")
                    .class("page-header")
                    .child(VNode::Element(
                        VElement::new("span")
                            .class("system-doc-badge")
                            .child(VNode::Text(VText::new("System"))),
                    ))
                    .child(VNode::Element(
                        VElement::new("h1")
                            .class("page-header__title")
                            .child(VNode::Text(VText::new(&title))),
                    )),
            ))
            // Dynamic content area
            .child(VNode::Element(
                VElement::new("div")
                    .class("page-section page-section--system")
                    .child(DocPage(
                        format!("system/{}", system_path),
                        language.clone(),
                        Some(title.clone()),
                    )),
            ))
            // Doc loader script
            .child(render_doc_loader_script()),
    )
}

/// Guide documentation page.
///
/// Specialized page for guides and tutorials.
///
/// # Arguments
///
/// * `guide_path` - Guide doc path (e.g., "getting-started", "installation")
/// * `language` - The language code
pub fn GuideDocPage(guide_path: String, language: String) -> VNode {
    let title = guide_path
        .replace('-', " ")
        .replace('_', " ")
        .chars()
        .enumerate()
        .map(|(i, c)| {
            if i == 0 {
                c.to_uppercase().collect::<Vec<_>>()[0]
            } else {
                c
            }
        })
        .collect::<String>();

    VNode::Element(
        VElement::new("div")
            .attr("id", &format!("page-guide-{}", guide_path))
            .attr("data-guide-path", &guide_path)
            .attr("data-language", &language)
            .class("hikari-page hikari-guide-doc-page")
            // Page header
            .child(VNode::Element(
                VElement::new("div")
                    .class("page-header")
                    .child(VNode::Element(
                        VElement::new("span")
                            .class("guide-doc-badge")
                            .child(VNode::Text(VText::new("Guide"))),
                    ))
                    .child(VNode::Element(
                        VElement::new("h1")
                            .class("page-header__title")
                            .child(VNode::Text(VText::new(&title))),
                    )),
            ))
            // Dynamic content area
            .child(VNode::Element(
                VElement::new("div")
                    .class("page-section page-section--guide")
                    .child(DocPage(
                        format!("guides/{}", guide_path),
                        language.clone(),
                        Some(title.clone()),
                    )),
            ))
            // Table of contents placeholder
            .child(VNode::Element(
                VElement::new("div")
                    .class("guide-toc")
                    .child(VNode::Element(
                        VElement::new("h3")
                            .class("guide-toc__title")
                            .child(VNode::Text(VText::new("Table of Contents"))),
                    ))
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("guide-toc__content")
                            .child(VNode::Text(VText::new("Table of contents will be generated from document headers."))),
                    )),
            ))
            // Doc loader script
            .child(render_doc_loader_script()),
    )
}

/// Render a documentation index page.
///
/// Shows a list of available documentation for a category.
///
/// # Arguments
///
/// * `category` - Category name (e.g., "components", "system")
/// * `items` - List of documentation items with titles and paths
/// * `language` - The language code
pub fn DocIndexPage(
    category: String,
    items: Vec<(String, String)>,
    language: String,
) -> VNode {
    let category_title = category
        .chars()
        .enumerate()
        .map(|(i, c)| {
            if i == 0 {
                c.to_uppercase().collect::<Vec<_>>()[0]
            } else {
                c
            }
        })
        .collect::<String>();

    let mut item_nodes: Vec<VNode> = Vec::new();

    for (title, path) in items {
        item_nodes.push(VNode::Element(
            VElement::new("a")
                .attr("href", &format!("/{}/{}", category, path))
                .class("doc-index-item")
                .child(VNode::Element(
                    VElement::new("div")
                        .class("doc-index-item__title")
                        .child(VNode::Text(VText::new(&title))),
                ))
                .child(VNode::Element(
                    VElement::new("div")
                        .class("doc-index-item__path")
                        .child(VNode::Text(VText::new(&path))),
                )),
        ));
    }

    VNode::Element(
        VElement::new("div")
            .attr("id", &format!("page-index-{}", category))
            .attr("data-category", &category)
            .attr("data-language", &language)
            .class("hikari-page hikari-doc-index-page")
            // Page header
            .child(VNode::Element(
                VElement::new("div")
                    .class("page-header")
                    .child(VNode::Element(
                        VElement::new("h1")
                            .class("page-header__title")
                            .child(VNode::Text(VText::new(&category_title))),
                    ))
                    .child(VNode::Element(
                        VElement::new("p")
                            .class("page-header__subtitle")
                            .child(VNode::Text(VText::new("Browse all available documentation in this category."))),
                    )),
            ))
            // Index grid
            .child(VNode::Element(
                VElement::new("div")
                    .class("doc-index-grid")
                    .children(item_nodes),
            )),
    )
}
