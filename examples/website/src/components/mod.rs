//! Shared layout components: top nav and sidebar.
//!
//! Uses hikari-components CSS class names (hi-header, hi-aside, etc.)
//! so the bundle.css styles apply correctly for the drawer/header/aside layout.

pub mod portal;
pub mod portal_examples;

use tairitsu_macros::rsx;
use tairitsu_vdom::{VElement, VNode, VText};

struct NavItem {
    label: &'static str,
    icon: &'static str,
    href: &'static str,
}

struct NavSubcategory {
    label: &'static str,
    icon: &'static str,
    href: &'static str,
    items: &'static [NavItem],
}

struct NavCategory {
    label: &'static str,
    icon: &'static str,
    default_open: bool,
    subcategories: &'static [NavSubcategory],
}

const NAV_CATEGORIES: &[NavCategory] = &[
    NavCategory {
        label: "Overview",
        icon: "\u{2302}",
        default_open: true,
        subcategories: &[NavSubcategory {
            label: "Home",
            icon: "\u{2302}",
            href: "/",
            items: &[],
        }],
    },
    NavCategory {
        label: "Components",
        icon: "\u{229E}",
        default_open: true,
        subcategories: &[
            NavSubcategory {
                label: "Layer 1 \u{2014} Base",
                icon: "\u{25C9}",
                href: "/components/layer1",
                items: &[
                    NavItem {
                        label: "Button",
                        icon: "\u{25C9}",
                        href: "/components/layer1/button",
                    },
                    NavItem {
                        label: "Form",
                        icon: "\u{25A2}",
                        href: "/components/layer1/form",
                    },
                    NavItem {
                        label: "Number Input",
                        icon: "#",
                        href: "/components/layer1/number-input",
                    },
                    NavItem {
                        label: "Search",
                        icon: "\u{2315}",
                        href: "/components/layer1/search",
                    },
                    NavItem {
                        label: "Switch",
                        icon: "\u{25D1}",
                        href: "/components/layer1/switch",
                    },
                    NavItem {
                        label: "Feedback",
                        icon: "\u{26A0}",
                        href: "/components/layer1/feedback",
                    },
                    NavItem {
                        label: "Display",
                        icon: "\u{25FB}",
                        href: "/components/layer1/display",
                    },
                    NavItem {
                        label: "Avatar",
                        icon: "\u{25CB}",
                        href: "/components/layer1/avatar",
                    },
                    NavItem {
                        label: "Image",
                        icon: "\u{25A6}",
                        href: "/components/layer1/image",
                    },
                    NavItem {
                        label: "Tag",
                        icon: "\u{25C7}",
                        href: "/components/layer1/tag",
                    },
                    NavItem {
                        label: "Empty",
                        icon: "\u{25A1}",
                        href: "/components/layer1/empty",
                    },
                    NavItem {
                        label: "Comment",
                        icon: "\u{270E}",
                        href: "/components/layer1/comment",
                    },
                    NavItem {
                        label: "Description List",
                        icon: "\u{2261}",
                        href: "/components/layer1/description-list",
                    },
                ],
            },
            NavSubcategory {
                label: "Layer 2 \u{2014} Composed",
                icon: "\u{25C8}",
                href: "/components/layer2",
                items: &[
                    NavItem {
                        label: "Navigation",
                        icon: "\u{25C8}",
                        href: "/components/layer2/navigation",
                    },
                    NavItem {
                        label: "Collapsible",
                        icon: "\u{2194}",
                        href: "/components/layer2/collapsible",
                    },
                    NavItem {
                        label: "Data",
                        icon: "\u{25C7}",
                        href: "/components/layer2/data",
                    },
                    NavItem {
                        label: "Table",
                        icon: "\u{229E}",
                        href: "/components/layer2/table",
                    },
                    NavItem {
                        label: "Tree",
                        icon: "\u{2142}",
                        href: "/components/layer2/tree",
                    },
                    NavItem {
                        label: "Pagination",
                        icon: "\u{2039}\u{203A}",
                        href: "/components/layer2/pagination",
                    },
                    NavItem {
                        label: "QRCode",
                        icon: "\u{25A3}",
                        href: "/components/layer2/qrcode",
                    },
                    NavItem {
                        label: "Timeline",
                        icon: "\u{25E0}",
                        href: "/components/layer2/timeline",
                    },
                    NavItem {
                        label: "Form",
                        icon: "\u{25A2}",
                        href: "/components/layer2/form",
                    },
                    NavItem {
                        label: "Cascader",
                        icon: "\u{25BE}",
                        href: "/components/layer2/cascader",
                    },
                    NavItem {
                        label: "Transfer",
                        icon: "\u{21C4}",
                        href: "/components/layer2/transfer",
                    },
                    NavItem {
                        label: "Feedback",
                        icon: "\u{26A0}",
                        href: "/components/layer2/feedback",
                    },
                ],
            },
            NavSubcategory {
                label: "Layer 3 \u{2014} Complex",
                icon: "\u{25C7}",
                href: "/components/layer3",
                items: &[
                    NavItem {
                        label: "Media",
                        icon: "\u{25B6}",
                        href: "/components/layer3/media",
                    },
                    NavItem {
                        label: "Editor",
                        icon: "\u{270E}",
                        href: "/components/layer3/editor",
                    },
                    NavItem {
                        label: "Visualization",
                        icon: "\u{25C7}",
                        href: "/components/layer3/visualization",
                    },
                    NavItem {
                        label: "User Guide",
                        icon: "\u{25D0}",
                        href: "/components/layer3/user-guide",
                    },
                    NavItem {
                        label: "Zoom Controls",
                        icon: "\u{2295}",
                        href: "/components/layer3/zoom-controls",
                    },
                ],
            },
        ],
    },
    NavCategory {
        label: "System",
        icon: "\u{2699}",
        default_open: false,
        subcategories: &[
            NavSubcategory {
                label: "Overview",
                icon: "\u{25C9}",
                href: "/system",
                items: &[],
            },
            NavSubcategory {
                label: "CSS Utilities",
                icon: "\u{2261}",
                href: "/system/css",
                items: &[],
            },
            NavSubcategory {
                label: "Icons",
                icon: "\u{2726}",
                href: "/system/icons",
                items: &[],
            },
            NavSubcategory {
                label: "Color Palette",
                icon: "\u{25C8}",
                href: "/system/palette",
                items: &[],
            },
            NavSubcategory {
                label: "Animations",
                icon: "\u{21BB}",
                href: "/system/animations",
                items: &[],
            },
            NavSubcategory {
                label: "i18n",
                icon: "\u{2603}",
                href: "/system/i18n",
                items: &[],
            },
            NavSubcategory {
                label: "Animation Demo",
                icon: "\u{25B6}",
                href: "/animations",
                items: &[],
            },
        ],
    },
    NavCategory {
        label: "Demos",
        icon: "\u{25A3}",
        default_open: false,
        subcategories: &[NavSubcategory {
            label: "All Demos",
            icon: "\u{25A3}",
            href: "/demos",
            items: &[
                NavItem {
                    label: "Form Demo",
                    icon: "\u{25A2}",
                    href: "/demos/form",
                },
                NavItem {
                    label: "Dashboard",
                    icon: "\u{229E}",
                    href: "/demos/dashboard",
                },
                NavItem {
                    label: "Video & Audio",
                    icon: "\u{25B6}",
                    href: "/demos/video",
                },
            ],
        }],
    },
];

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

fn nav_link(href: &str, label: &str, icon: &str, extra_class: &str) -> VNode {
    let icon_node = VNode::Element(
        VElement::new("span")
            .class("hi-sidebar-icon")
            .child(txt(icon)),
    );
    let label_node = VNode::Element(
        VElement::new("span")
            .class("hi-sidebar-label")
            .child(txt(label)),
    );
    let mut el = VElement::new("a")
        .attr("href", href)
        .class("hi-sidebar-item");
    if !extra_class.is_empty() {
        el = el.class(extra_class);
    }
    VNode::Element(el.child(icon_node).child(label_node))
}

fn details_open(
    class_name: &str,
    summary_class: &str,
    label: &str,
    icon: &str,
    children: Vec<VNode>,
    is_open: bool,
) -> VNode {
    let icon_node = VNode::Element(
        VElement::new("span")
            .class("hi-sidebar-icon")
            .child(txt(icon)),
    );
    let label_node = VNode::Element(
        VElement::new("span")
            .class("hi-sidebar-label")
            .child(txt(label)),
    );
    let summary = VNode::Element(
        VElement::new("summary")
            .class(summary_class)
            .child(icon_node)
            .child(label_node),
    );
    let mut el = VElement::new("details").class(class_name);
    if is_open {
        el = el.attr("open", "");
    }
    VNode::Element(el.child(summary).children(children))
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
                    a { href: "/interactive", class: "hikari-topnav__link", "Interactive" }
                    a { href: "/demos", class: "hikari-topnav__link", "Demos" }
                }
                // Language toggle button
                button {
                    class: "hi-header-icon hi-lang-toggle",
                    id: "lang-toggle",
                    "aria-label": "Toggle language",
                    "title": "Switch language",
                    "data-lang": "en",
                    "EN"
                }
                // Theme toggle button
                button {
                    class: "hi-header-icon hi-theme-toggle",
                    id: "theme-toggle",
                    "aria-label": "Toggle theme",
                    "title": "Toggle theme",
                    // Sun icon (shown in dark mode)
                    svg {
                        class: "theme-icon-sun",
                        xmlns: "http://www.w3.org/2000/svg",
                        fill: "none",
                        view_box: "0 0 24 24",
                        stroke: "currentColor",
                        stroke_width: "2",
                        stroke_linecap: "round",
                        stroke_linejoin: "round",
                        circle { cx: "12", cy: "12", r: "5" }
                        line { x1: "12", y1: "1", x2: "12", y2: "3" }
                        line { x1: "12", y1: "21", x2: "12", y2: "23" }
                        line { x1: "4.22", y1: "4.22", x2: "5.64", y2: "5.64" }
                        line { x1: "18.36", y1: "18.36", x2: "19.78", y2: "19.78" }
                        line { x1: "1", y1: "12", x2: "3", y2: "12" }
                        line { x1: "21", y1: "12", x2: "23", y2: "12" }
                        line { x1: "4.22", y1: "19.78", x2: "5.64", y2: "18.36" }
                        line { x1: "18.36", y1: "5.64", x2: "19.78", y2: "4.22" }
                    }
                    // Moon icon (shown in light mode)
                    svg {
                        class: "theme-icon-moon",
                        xmlns: "http://www.w3.org/2000/svg",
                        fill: "none",
                        view_box: "0 0 24 24",
                        stroke: "currentColor",
                        stroke_width: "2",
                        stroke_linecap: "round",
                        stroke_linejoin: "round",
                        path { d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" }
                    }
                }
            }
        }
    }
}

pub fn sidebar() -> VNode {
    let mut sections: Vec<VNode> = Vec::new();

    for category in NAV_CATEGORIES {
        if category.subcategories.len() == 1 && category.subcategories[0].items.is_empty() {
            let sub = &category.subcategories[0];
            sections.push(nav_link(
                sub.href,
                sub.label,
                sub.icon,
                "hi-sidebar-item--home",
            ));
            continue;
        }

        let mut subcategory_nodes: Vec<VNode> = Vec::new();

        for subcategory in category.subcategories {
            if subcategory.items.is_empty() {
                subcategory_nodes.push(nav_link(
                    subcategory.href,
                    subcategory.label,
                    subcategory.icon,
                    "",
                ));
            } else {
                let item_nodes: Vec<VNode> = subcategory
                    .items
                    .iter()
                    .map(|item| nav_link(item.href, item.label, item.icon, ""))
                    .collect();
                subcategory_nodes.push(details_open(
                    "hi-sidebar-subsection",
                    "hi-sidebar-subsection-title",
                    subcategory.label,
                    subcategory.icon,
                    item_nodes,
                    true,
                ));
            }
        }

        sections.push(details_open(
            "hi-sidebar-section",
            "hi-sidebar-section-title",
            category.label,
            category.icon,
            subcategory_nodes,
            category.default_open,
        ));
    }

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
