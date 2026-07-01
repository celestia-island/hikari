use tairitsu_vdom::{VElement, VNode, VText};

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

pub fn render_demo_section(title: &str, content: VNode) -> VNode {
    VNode::Element(
        VElement::new("section")
            .class("demo-section")
            .child(VNode::Element(
                VElement::new("h2")
                    .class("demo-section__title")
                    .child(txt(title)),
            ))
            .child(content),
    )
}

pub fn render_page_container(
    page_id: &str,
    title: Option<&str>,
    description: Option<&str>,
    content: VNode,
) -> VNode {
    let mut page_children: Vec<VNode> = Vec::new();

    if let Some(t) = title {
        page_children.push(VNode::Element(
            VElement::new("div")
                .class("page-header")
                .child(VNode::Element(
                    VElement::new("h1")
                        .class("page-header__title")
                        .child(txt(t)),
                ))
                .child(if let Some(d) = description {
                    VNode::Element(
                        VElement::new("p")
                            .class("page-header__subtitle")
                            .child(txt(d)),
                    )
                } else {
                    VNode::Text(VText::new(""))
                }),
        ));
    } else if let Some(d) = description {
        page_children.push(VNode::Element(
            VElement::new("p")
                .class("page-header__subtitle--standalone")
                .child(txt(d)),
        ));
    }

    page_children.push(content);

    let hikari_page = VNode::Element(
        VElement::new("div")
            .attr("id", page_id)
            .class("hikari-page")
            .children(page_children),
    );

    VNode::Element(
        VElement::new("div")
            .class("page-container")
            .child(hikari_page),
    )
}
