use crate::router;

pub fn router_js() -> String {
    router::generate_router_js()
}

pub fn render_router_script() -> tairitsu_vdom::VNode {
    use tairitsu_vdom::{VElement, VNode, VText};
    VNode::Element(
        VElement::new("script")
            .attr("id", "hikari-spa-router")
            .child(VNode::Text(VText::new(&router_js()))),
    )
}
