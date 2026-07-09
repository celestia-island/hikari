//! App root — assembles all pages into a single VNode tree.
//!
//! All pages are rendered at once; JavaScript routing (History API) controls
//! which page is visible by toggling `.is-active` on `.hikari-page` divs.
//!
//! The layout mirrors the old tairitsu-era structure:
//!   Layout (hi-layout) → Header → Body (hi-layout-body) → Aside + Main

use tairitsu_vdom::{VElement, VNode};

use crate::{
    components,
    pages::{components as comp_pages, demos as demo_pages, home, not_found, system as sys_pages},
};

/// Render the full application VNode tree.
pub fn render() -> VNode {
    let mut content: Vec<VNode> = Vec::new();
    content.push(home::render());
    content.extend(comp_pages::render_all());
    content.extend(sys_pages::render_all());
    content.extend(demo_pages::render_all());
    content.push(not_found::render());

    // Outer layout wrapper — matches hikari-components Layout component
    VNode::Element(
        VElement::new("div")
            .attr("id", "hikari-app")
            .class("hi-layout hi-layout-light hi-layout-has-sidebar")
            // Header bar (top, full-width, sticky)
            .child(components::top_nav())
            // Body: aside + main content area
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-layout-body")
                    // Mobile overlay backdrop
                    .child(VNode::Element(
                        VElement::new("div")
                            .attr("id", "drawer-overlay")
                            .class("hi-layout-overlay"),
                    ))
                    // Sidebar / Aside (drawer)
                    .child(components::sidebar())
                    // Main content wrapper
                    .child(VNode::Element(
                        VElement::new("div")
                            .class("hi-layout-main")
                            .child(VNode::Element(
                                VElement::new("main")
                                    .class("hi-layout-content")
                                    .children(content),
                            )),
                    )),
            )),
    )
}
