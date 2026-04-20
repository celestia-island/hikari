//! App root — assembles all pages into a single VNode tree.
//!
//! All pages are rendered at once; JavaScript routing (History API) controls
//! which page is visible by toggling `.is-active` on `.hikari-page` divs.
//!
//! The layout mirrors the old Dioxus-era structure:
//!   Layout (hi-layout) → Header → Body (hi-layout-body) → Aside + Main

use std::cell::RefCell;
use std::rc::Rc;

use tairitsu_vdom::{VElement, VNode, VText};

use crate::{
    components::{self, portal::PortalJs},
    pages::{
        animations, components as comp_pages, demos as demo_pages, home, interactive, not_found,
        system as sys_pages,
    },
    theme,
};

pub fn render() -> VNode {
    let mut content: Vec<VNode> = Vec::new();
    content.push(home::render());
    content.extend(comp_pages::render_all());
    content.extend(sys_pages::render_all());
    content.extend(demo_pages::render_all());
    content.push(animations::render());
    content.push(interactive::render());
    content.push(not_found::render());

    let theme_style = theme::hikari_style();
    let portal_init = PortalJs::init_script();

    let app_ref: Rc<RefCell<Option<Box<dyn std::any::Any>>>> = Rc::new(RefCell::new(None));

    let app_content = VNode::Element(
        VElement::new("div")
            .attr("id", "hikari-app")
            .attr("data-theme", "hikari")
            .class("hi-layout hi-layout-light hi-layout-has-sidebar hi-ambient-bg")
            .style(theme_style)
            .ref_(app_ref.clone())
            .child(components::top_nav())
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-layout-body")
                    .child(VNode::Element(
                        VElement::new("div")
                            .attr("id", "drawer-overlay")
                            .class("hi-layout-overlay"),
                    ))
                    .child(components::sidebar(app_ref.clone()))
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hi-layout-main")
                            .child(VNode::Element(
                                VElement::new("main")
                                    .class("hi-layout-content")
                                    .child(components::breadcrumb::render())
                                    .children(content),
                            )),
                    )),
            )),
    );

    components::portal::PortalProvider::render(vec![app_content, portal_init])
}
