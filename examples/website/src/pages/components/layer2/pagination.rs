use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use tairitsu_vdom::{VElement, VNode, VText};

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

fn elem(tag: &str, attrs: Vec<(&str, &str)>, children: Vec<VNode>) -> VNode {
    let mut el = VElement::new(tag);
    for (k, v) in attrs {
        el = el.attr(k, v);
    }
    for child in children {
        el = el.child(child);
    }
    VNode::Element(el)
}

pub fn render() -> VNode {
    render_demo_page("page-component-pagination", "Pagination", "Page navigation control with total count display and quick jump support.", VNode::Fragment(vec![
        render_demo_block("Basic Pagination", elem("div", vec![("class", "hi-pagination")], vec![
            elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("\u{2039}")])]),
            elem("div", vec![], vec![elem("span", vec![("class", "hi-pagination__item is-active")], vec![txt("1")])]),
            elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("2")])]),
            elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("3")])]),
            elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("\u{203A}")])]),
        ])),
        render_demo_block("With Total Count", elem("div", vec![("style", "display:flex;align-items:center;gap:16px;")], vec![
            elem("div", vec![("class", "hi-pagination")], vec![
                elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("\u{2039}")])]),
                elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("1")])]),
                elem("div", vec![], vec![elem("span", vec![("class", "hi-pagination__item is-active")], vec![txt("2")])]),
                elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("3")])]),
                elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("\u{203A}")])]),
            ]),
            elem("span", vec![("class", "hi-pagination__total")], vec![txt("Total: 86 items")]),
        ])),
        render_demo_block("With Ellipsis", elem("div", vec![("class", "hi-pagination")], vec![
            elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("\u{2039}")])]),
            elem("div", vec![], vec![elem("span", vec![("class", "hi-pagination__item is-active")], vec![txt("1")])]),
            elem("div", vec![], vec![elem("span", vec![("class", "hi-pagination__item hi-pagination__ellipsis")], vec![txt("\u{2026}")])]),
            elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("10")])]),
            elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("\u{203A}")])]),
        ])),
        render_demo_block("Simple Mode", elem("div", vec![("class", "hi-pagination")], vec![
            elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("\u{2039} Previous")])]),
            elem("div", vec![], vec![elem("a", vec![("class", "hi-pagination__item"), ("href", "#")], vec![txt("Next \u{203A}")])]),
        ])),
        render_demo_block("API", elem("div", vec![], vec![
            render_api_table(&[
                ("current", "number", "1", "Current active page"),
                ("total", "number", "-", "Total number of items"),
                ("pageSize", "number", "10", "Items per page"),
                ("showTotal", "bool", "false", "Show total item count"),
                ("simple", "bool", "false", "Show only prev/next buttons"),
            ])
        ])),
    ]))
}
