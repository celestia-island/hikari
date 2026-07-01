// Demo page layout helpers — replaces raw HTML boilerplate in all demo pages
//
// Provides:
//   DemoPage   — outer container + PageHeader (title + subtitle)
//   DemoBlock  — section with title + content area
//   DemoRow    — centered flex row for component showcase
//   ApiTable   — API property reference table

use tairitsu_web::t;
use tairitsu_vdom::{VElement, VNode, VText};

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

fn el(tag: &str, class: &str, children: VNode) -> VNode {
    VNode::Element(VElement::new(tag).class(class).child(children))
}

fn el_style(tag: &str, class: &str, style: &str, children: VNode) -> VNode {
    VNode::Element(VElement::new(tag).class(class).style(style).child(children))
}

// ============================================
// DemoPage — Full page wrapper with header
// ============================================

pub fn render_demo_page(page_id: &str, title: &str, subtitle: &str, content: VNode) -> VNode {
    VNode::Element(
        VElement::new("div")
            .attr("id", page_id)
            .class(format!("hikari-page {}", page_id))
            .child(VNode::Fragment(vec![
                el("div", "page-header",
                    VNode::Fragment(vec![
                        el("h1", "page-header__title", txt(title)),
                        el("p", "page-header__subtitle", txt(subtitle)),
                    ])
                ),
                el("div", "page-section", content),
            ])),
    )
}

pub fn render_demo_page_raw(page_id: &str, title: Option<&str>, content: VNode) -> VNode {
    let header = if let Some(t) = title {
        el("div", "page-header",
            el("h1", "page-header__title", txt(t))
        )
    } else {
        VNode::empty()
    };

    VNode::Element(
        VElement::new("div")
            .attr("id", page_id)
            .class(format!("hikari-page {}", page_id))
            .child(VNode::Fragment(vec![header, el("div", "page-section", content)])),
    )
}

// ============================================
// DemoBlock — Section with title + body
// ============================================

pub fn render_demo_block(title: &str, body: VNode) -> VNode {
    el("div", "demo-block",
        VNode::Fragment(vec![
            el("h3", "demo-block__title", txt(title)),
            el("div", "demo-block__body", body),
        ])
    )
}

// ============================================
// DemoRow — Centered flex row
// ============================================

pub fn render_demo_row(children: VNode) -> VNode {
    el("div", "demo-row", children)
}

// ============================================
// ApiTable — API reference table
// ============================================

pub fn render_api_table(rows: &[(&str, &str, &str, &str)]) -> VNode {
    let mut trs = Vec::with_capacity(rows.len());
    for &(prop, ty, default, desc) in rows {
        trs.push(VNode::Element(
            VElement::new("tr")
                .child(el("td", "", el("code", "", txt(prop))))
                .child(el("td", "", el("code", "", txt(ty))))
                .child(el("td", "", el("code", "", txt(default))))
                .child(el("td", "", txt(desc))),
        ));
    }

    el("table", "api-table",
        VNode::Fragment(vec![
            el("thead", "",
                el("tr", "",
                    VNode::Fragment(vec![
                         el("th", "", txt(&t!("label.property"))),
                        el("th", "", txt(&t!("label.type"))),
                        el("th", "", txt(&t!("label.default"))),
                        el("th", "", txt(&t!("label.description"))),
                    ])
                )
            ),
            el("tbody", "", VNode::Fragment(trs)),
        ])
    )
}
