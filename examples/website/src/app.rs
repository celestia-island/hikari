//! App root — assembles all pages into a single VNode tree.
//!
//! All pages are rendered at once; JavaScript routing (History API) controls
//! which page is visible by toggling `.is-active` on `.hikari-page` divs.
//!
//! The layout mirrors the old Dioxus-era structure:
//!   Layout (hi-layout) → Header → Body (hi-layout-body) → Aside + Main

use tairitsu_vdom::{VElement, VNode, VText};

use crate::{
    components::{self, portal::PortalJs},
    pages::{
        animations, components as comp_pages, demos as demo_pages, home, interactive, not_found,
        system as sys_pages,
    },
    theme,
};

/// Render the full application VNode tree.
pub fn render() -> VNode {
    let mut content: Vec<VNode> = Vec::new();
    content.push(home::render());
    content.extend(comp_pages::render_all());
    content.extend(sys_pages::render_all());
    content.extend(demo_pages::render_all());
    content.push(animations::render());
    content.push(interactive::render());
    content.push(not_found::render());

    // Get theme CSS variables Style for Hikari (light) theme
    let theme_style = theme::hikari_style();

    // Initialize portal JavaScript
    let portal_init = PortalJs::init_script();

    // Create app content
    let app_content = VNode::Element(
        VElement::new("div")
            .attr("id", "hikari-app")
            .attr("data-theme", "hikari")
            .class("hi-layout hi-layout-light hi-layout-has-sidebar hi-ambient-bg")
            .style(theme_style)
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
                                    .child(components::breadcrumb::render())
                                    .children(content),
                            )),
                    )),
            )),
    );

    // Wrap everything in PortalProvider
    components::portal::PortalProvider::render(vec![app_content, portal_init])
}
