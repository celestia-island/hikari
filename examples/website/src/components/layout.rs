use std::cell::RefCell;
use std::rc::Rc;

use tairitsu_vdom::{VElement, VNode};

pub fn render(content: VNode) -> VNode {
    let app_ref: Rc<RefCell<Option<Box<dyn std::any::Any>>>> = Rc::new(RefCell::new(None));
    let aside_ref: Rc<RefCell<Option<Box<dyn std::any::Any>>>> = Rc::new(RefCell::new(None));
    VNode::Element(
        VElement::new("div")
            .attr("id", "hikari-app")
            .attr("data-theme", "hikari")
            .class("hi-layout hi-layout-light hi-layout-has-sidebar")
            .child(super::top_nav::render())
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-layout-body")
                    .child(VNode::Element(
                        VElement::new("div")
                            .attr("id", "drawer-overlay")
                            .class("hi-layout-overlay"),
                    ))
                    .child(super::sidebar::render(app_ref, aside_ref))
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hi-layout-main")
                            .child(VNode::Element(
                                VElement::new("main")
                                    .class("hi-layout-content")
                                    .child(content),
                            )),
                    )),
            )),
    )
}
