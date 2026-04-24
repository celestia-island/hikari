use tairitsu_vdom::{VElement, VNode, VText};

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

pub fn render() -> VNode {
    VNode::Element(
        VElement::new("nav")
            .class("hi-breadcrumb")
            .child(VNode::Element(
                VElement::new("a")
                    .attr("href", "/")
                    .class("hi-breadcrumb__item")
                    .child(txt("Home")),
            ))
            .child(VNode::Element(
                VElement::new("span")
                    .class("hi-breadcrumb__sep")
                    .child(txt("/")),
            ))
            .child(VNode::Element(
                VElement::new("span")
                    .attr("id", "breadcrumb-current")
                    .class("hi-breadcrumb__item hi-breadcrumb__item--current")
                    .child(txt("Home")),
            )),
    )
}
