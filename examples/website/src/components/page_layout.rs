use tairitsu_vdom::{VElement, VNode, VText};

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

pub fn render_demo_section(title: &str, content: VNode) -> VNode {
    VNode::Element(
        VElement::new("section")
            .class("mb-8 p-6")
            .style("border-radius:0.75rem;border:1px solid var(--hi-color-border);background:var(--hi-color-surface)")
            .child(VNode::Element(
                VElement::new("h2")
                    .class("text-lg font-semibold text-primary mb-4")
                    .style("padding-bottom:0.75rem;border-bottom:1px solid var(--hi-color-border)")
                    .child(txt(title)),
            ))
            .child(content),
    )
}

pub fn render_page_container(
    title: Option<&str>,
    description: Option<&str>,
    content: VNode,
) -> VNode {
    let mut children: Vec<VNode> = Vec::new();

    if let Some(t) = title {
        children.push(VNode::Element(
            VElement::new("h1")
                .class("text-4xl font-bold text-primary mb-2")
                .child(txt(t)),
        ));
    }

    if let Some(d) = description {
        children.push(VNode::Element(
            VElement::new("p")
                .class("text-secondary mb-8")
                .style("max-width:800px;line-height:1.6")
                .child(txt(d)),
        ));
    }

    children.push(content);

    VNode::Element(
        VElement::new("div")
            .class("p-6")
            .style("max-width:1200px;margin:0 auto;padding-left:2rem;padding-right:2rem")
            .children(children),
    )
}
