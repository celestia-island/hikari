//! Shared layout components: top nav and sidebar.

use tairitsu_macros::rsx;
use tairitsu_vdom::{VElement, VNode, VText};

/// Sidebar navigation links grouped by section.
struct NavSection {
    label: &'static str,
    items: &'static [(&'static str, &'static str)], // (label, hash)
}

const NAV: &[NavSection] = &[
    NavSection {
        label: "Components",
        items: &[
            ("Overview", "#/components"),
            ("Layer 1 — Base", "#/components/layer1"),
            ("Layer 2 — Composed", "#/components/layer2"),
            ("Layer 3 — Complex", "#/components/layer3"),
        ],
    },
    NavSection {
        label: "System",
        items: &[
            ("Overview", "#/system"),
            ("Color Palette", "#/system/palette"),
            ("CSS Utilities", "#/system/css"),
            ("Icons", "#/system/icons"),
            ("Animations", "#/system/animations"),
            ("i18n", "#/system/i18n"),
        ],
    },
    NavSection {
        label: "Demos",
        items: &[
            ("Overview", "#/demos"),
            ("Form Demo", "#/demos/form"),
            ("Dashboard", "#/demos/dashboard"),
        ],
    },
];

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

/// Render the top navigation bar.
pub fn top_nav() -> VNode {
    rsx! {
        header { class: "hikari-topnav",
            a { href: "#/", class: "hikari-topnav__brand",
                "Hikari"
            }
            nav { class: "hikari-topnav__links",
                a { href: "#/components", class: "hikari-topnav__link",
                    "Components"
                }
                a { href: "#/system", class: "hikari-topnav__link",
                    "System"
                }
                a { href: "#/demos", class: "hikari-topnav__link",
                    "Demos"
                }
            }
        }
    }
}

/// Render the sidebar with hash-based navigation.
pub fn sidebar() -> VNode {
    let mut sections: Vec<VNode> = Vec::new();

    // Home link
    sections.push(VNode::Element(
        VElement::new("a")
            .attr("href", "#/")
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

    VNode::Element(
        VElement::new("aside")
            .class("hikari-sidebar")
            .children(sections),
    )
}
