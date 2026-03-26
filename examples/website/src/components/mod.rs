//! Shared layout components: top nav and sidebar.
//!
//! Uses hikari-components CSS class names (hi-header, hi-aside, etc.)
//! so the bundle.css styles apply correctly for the drawer/header/aside layout.

use tairitsu_macros::rsx;
use tairitsu_vdom::{VElement, VNode, VText};

/// Sidebar navigation links grouped by section.
struct NavSection {
    label: &'static str,
    items: &'static [(&'static str, &'static str)], // (label, href)
}

const NAV: &[NavSection] = &[
    NavSection {
        label: "Components",
        items: &[
            ("Overview", "/components"),
            ("Layer 1 — Base", "/components/layer1"),
            ("Layer 2 — Composed", "/components/layer2"),
            ("Layer 3 — Complex", "/components/layer3"),
        ],
    },
    NavSection {
        label: "System",
        items: &[
            ("Overview", "/system"),
            ("Color Palette", "/system/palette"),
            ("CSS Utilities", "/system/css"),
            ("Icons", "/system/icons"),
            ("Animations", "/system/animations"),
            ("i18n", "/system/i18n"),
        ],
    },
    NavSection {
        label: "Demos",
        items: &[
            ("Overview", "/demos"),
            ("Form Demo", "/demos/form"),
            ("Dashboard", "/demos/dashboard"),
        ],
    },
];

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

/// Render the top navigation bar using hikari Header classes.
///
/// Matches the structure produced by `hikari_components::layout::Header`:
///   <header class="hi-header hi-header-sticky hi-header-md">
///     <div class="hi-header-left">
///       <button class="hi-header-toggle"> ... </button>
///       <div class="..."> brand </div>
///     </div>
///     <div class="hi-header-right"> links </div>
///   </header>
pub fn top_nav() -> VNode {
    rsx! {
        header { class: "hi-header hi-header-sticky hi-header-md",
            div { class: "hi-header-left",
                // Hamburger toggle for mobile drawer
                button {
                    class: "hi-header-toggle",
                    id: "drawer-toggle",
                    "aria-label": "Toggle menu",
                    // SVG hamburger icon
                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        fill: "none",
                        view_box: "0 0 24 24",
                        stroke: "currentColor",
                        stroke_width: "2",
                        stroke_linecap: "round",
                        stroke_linejoin: "round",
                        path { d: "M4 6h16M4 12h16M4 18h16" }
                    }
                }
                // Brand
                a { href: "/", class: "hi-header-brand", "Hikari" }
            }
            div { class: "hi-header-right",
                nav { class: "hi-header-nav",
                    a { href: "/components", class: "hikari-topnav__link", "Components" }
                    a { href: "/system", class: "hikari-topnav__link", "System" }
                    a { href: "/demos", class: "hikari-topnav__link", "Demos" }
                }
            }
        }
    }
}

/// Render the sidebar as an `<aside>` using hikari Aside classes.
///
/// Matches the structure produced by `hikari_components::layout::Aside`:
///   <aside class="hi-aside hi-aside-drawer hi-aside-lg hi-aside-light">
///     <div class="hi-layout-aside-content"> … links … </div>
///   </aside>
pub fn sidebar() -> VNode {
    let mut sections: Vec<VNode> = Vec::new();

    // Home link
    sections.push(VNode::Element(
        VElement::new("a")
            .attr("href", "/")
            .class("sidebar-link sidebar-link--home")
            .child(txt("Home")),
    ));

    for section in NAV {
        let mut items: Vec<VNode> = Vec::new();
        for (label, href) in section.items {
            items.push(VNode::Element(
                VElement::new("a")
                    .attr("href", href)
                    .class("sidebar-link")
                    .child(txt(label)),
            ));
        }

        sections.push(VNode::Element(
            VElement::new("div")
                .class("sidebar-section")
                .child(VNode::Element(
                    VElement::new("span")
                        .class("sidebar-section__label")
                        .child(txt(section.label)),
                ))
                .children(items),
        ));
    }

    // Wrap in aside with hikari classes
    VNode::Element(
        VElement::new("aside")
            .attr("id", "hikari-aside")
            .class("hi-aside hi-aside-drawer hi-aside-lg hi-aside-light")
            .child(VNode::Element(
                VElement::new("div")
                    .class("hi-layout-aside-content")
                    .children(sections),
            )),
    )
}
