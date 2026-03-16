//! App root — assembles all pages into a single VNode tree.
//!
//! All pages are rendered at once; JavaScript hash routing controls which
//! page is visible by toggling `.is-active` on `.hikari-page` divs.

use tairitsu_vdom::{VElement, VNode};

use crate::components;
use crate::pages::{components as comp_pages, demos as demo_pages, home, not_found, system as sys_pages};

/// Render the full application VNode tree.
pub fn render() -> VNode {
    let mut content: Vec<VNode> = Vec::new();
    content.push(home::render());
    content.extend(comp_pages::render_all());
    content.extend(sys_pages::render_all());
    content.extend(demo_pages::render_all());
    content.push(not_found::render());

    VNode::Element(
        VElement::new("div")
            .attr("id", "hikari-app")
            .class("hikari-app")
            .child(components::top_nav())
            .child(
                VNode::Element(
                    VElement::new("div")
                        .class("hikari-body")
                        .child(components::sidebar())
                        .child(
                            VNode::Element(
                                VElement::new("main")
                                    .class("hikari-content")
                                    .children(content),
                            ),
                        ),
                ),
            ),
    )
}
