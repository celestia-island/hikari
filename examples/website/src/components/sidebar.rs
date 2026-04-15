use hikari_icons::generated::mdi_selected::get;
use hikari_icons::MdiIcon;
use tairitsu_vdom::{get_bounding_client_rect, set_style, VElement, VNode, VText};

struct NavItem {
    label: &'static str,
    icon: MdiIcon,
    href: &'static str,
}

struct NavSubcategory {
    label: &'static str,
    href: &'static str,
    items: &'static [NavItem],
}

struct NavCategory {
    label: &'static str,
    default_open: bool,
    subcategories: &'static [NavSubcategory],
}

const NAV_CATEGORIES: &[NavCategory] = &[
    NavCategory {
        label: "Overview",
        default_open: true,
        subcategories: &[NavSubcategory {
            label: "Home",
            href: "/",
            items: &[],
        }],
    },
    NavCategory {
        label: "Components",
        default_open: true,
        subcategories: &[
            NavSubcategory {
                label: "Layer 1 — Base",
                href: "/components/layer1",
                items: &[
                    NavItem {
                        label: "Button",
                        icon: MdiIcon::Cursor,
                        href: "/components/layer1/button",
                    },
                    NavItem {
                        label: "Form",
                        icon: MdiIcon::TextBoxEdit,
                        href: "/components/layer1/form",
                    },
                    NavItem {
                        label: "Number Input",
                        icon: MdiIcon::FormatListNumbered,
                        href: "/components/layer1/number-input",
                    },
                    NavItem {
                        label: "Search",
                        icon: MdiIcon::Magnify,
                        href: "/components/layer1/search",
                    },
                    NavItem {
                        label: "Switch",
                        icon: MdiIcon::ToggleSwitch,
                        href: "/components/layer1/switch",
                    },
                    NavItem {
                        label: "Feedback",
                        icon: MdiIcon::Alert,
                        href: "/components/layer1/feedback",
                    },
                    NavItem {
                        label: "Display",
                        icon: MdiIcon::Image,
                        href: "/components/layer1/display",
                    },
                    NavItem {
                        label: "Avatar",
                        icon: MdiIcon::Account,
                        href: "/components/layer1/avatar",
                    },
                    NavItem {
                        label: "Image",
                        icon: MdiIcon::Image,
                        href: "/components/layer1/image",
                    },
                    NavItem {
                        label: "Tag",
                        icon: MdiIcon::Star,
                        href: "/components/layer1/tag",
                    },
                    NavItem {
                        label: "Empty",
                        icon: MdiIcon::ViewDashboard,
                        href: "/components/layer1/empty",
                    },
                    NavItem {
                        label: "Comment",
                        icon: MdiIcon::Chat,
                        href: "/components/layer1/comment",
                    },
                    NavItem {
                        label: "Description List",
                        icon: MdiIcon::FormatListBulleted,
                        href: "/components/layer1/description-list",
                    },
                ],
            },
            NavSubcategory {
                label: "Layer 2 — Composed",
                href: "/components/layer2",
                items: &[
                    NavItem {
                        label: "Navigation",
                        icon: MdiIcon::FormatListBulleted,
                        href: "/components/layer2/navigation",
                    },
                    NavItem {
                        label: "Collapsible",
                        icon: MdiIcon::ArrowExpandHorizontal,
                        href: "/components/layer2/collapsible",
                    },
                    NavItem {
                        label: "Data",
                        icon: MdiIcon::Graph,
                        href: "/components/layer2/data",
                    },
                    NavItem {
                        label: "Table",
                        icon: MdiIcon::Table,
                        href: "/components/layer2/table",
                    },
                    NavItem {
                        label: "Tree",
                        icon: MdiIcon::SourceBranch,
                        href: "/components/layer2/tree",
                    },
                    NavItem {
                        label: "Pagination",
                        icon: MdiIcon::ChevronLeft,
                        href: "/components/layer2/pagination",
                    },
                    NavItem {
                        label: "QRCode",
                        icon: MdiIcon::ViewDashboard,
                        href: "/components/layer2/qrcode",
                    },
                    NavItem {
                        label: "Timeline",
                        icon: MdiIcon::ChartTimeline,
                        href: "/components/layer2/timeline",
                    },
                    NavItem {
                        label: "Form",
                        icon: MdiIcon::TextBoxEdit,
                        href: "/components/layer2/form",
                    },
                    NavItem {
                        label: "Cascader",
                        icon: MdiIcon::ChevronDown,
                        href: "/components/layer2/cascader",
                    },
                    NavItem {
                        label: "Transfer",
                        icon: MdiIcon::SwapHorizontal,
                        href: "/components/layer2/transfer",
                    },
                    NavItem {
                        label: "Feedback",
                        icon: MdiIcon::Bell,
                        href: "/components/layer2/feedback",
                    },
                ],
            },
            NavSubcategory {
                label: "Layer 3 — Complex",
                href: "/components/layer3",
                items: &[
                    NavItem {
                        label: "Media",
                        icon: MdiIcon::Play,
                        href: "/components/layer3/media",
                    },
                    NavItem {
                        label: "Editor",
                        icon: MdiIcon::FormatBold,
                        href: "/components/layer3/editor",
                    },
                    NavItem {
                        label: "Visualization",
                        icon: MdiIcon::CubeOutline,
                        href: "/components/layer3/visualization",
                    },
                    NavItem {
                        label: "User Guide",
                        icon: MdiIcon::BookOpen,
                        href: "/components/layer3/user-guide",
                    },
                    NavItem {
                        label: "Zoom Controls",
                        icon: MdiIcon::MagnifyPlus,
                        href: "/components/layer3/zoom-controls",
                    },
                ],
            },
        ],
    },
    NavCategory {
        label: "System",
        default_open: false,
        subcategories: &[
            NavSubcategory {
                label: "Overview",
                href: "/system",
                items: &[],
            },
            NavSubcategory {
                label: "CSS Utilities",
                href: "/system/css",
                items: &[],
            },
            NavSubcategory {
                label: "Icons",
                href: "/system/icons",
                items: &[],
            },
            NavSubcategory {
                label: "Color Palette",
                href: "/system/palette",
                items: &[],
            },
            NavSubcategory {
                label: "Animations",
                href: "/system/animations",
                items: &[],
            },
            NavSubcategory {
                label: "i18n",
                href: "/system/i18n",
                items: &[],
            },
            NavSubcategory {
                label: "Animation Demo",
                href: "/animations",
                items: &[],
            },
        ],
    },
    NavCategory {
        label: "Demos",
        default_open: false,
        subcategories: &[NavSubcategory {
            label: "All Demos",
            href: "/demos",
            items: &[
                NavItem {
                    label: "Form Demo",
                    icon: MdiIcon::TextBoxEdit,
                    href: "/demos/form",
                },
                NavItem {
                    label: "Dashboard",
                    icon: MdiIcon::ViewColumn,
                    href: "/demos/dashboard",
                },
                NavItem {
                    label: "Video & Audio",
                    icon: MdiIcon::Play,
                    href: "/demos/video",
                },
            ],
        }],
    },
];

fn txt(s: &str) -> VNode {
    VNode::Text(VText::new(s))
}

fn icon_el(icon: MdiIcon) -> VNode {
    let icon_name = icon.to_string();
    let svg_str = get(&icon_name)
        .map(|data| {
            format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{}" width="14" height="14"><path fill="currentColor" d="{}"/></svg>"#,
                data.view_box.as_deref().unwrap_or("0 0 24 24"),
                data.path.as_deref().unwrap_or("")
            )
        })
        .unwrap_or_else(|| String::from(
            r#"<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>"#
        ));
    VNode::Element(
        VElement::new("span")
            .class("hi-menu-item-icon hikari-icon")
            .attr("style", "width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;")
            .inner_html(svg_str),
    )
}

fn glow_wrap(children: VNode) -> VNode {
    let onmousemove = move |e: std::boxed::Box<dyn tairitsu_vdom::EventData>| {
        if let Some(me) = e.as_any().downcast_ref::<tairitsu_vdom::MouseEvent>() {
            if let Some(target) = me.target {
                let rect = get_bounding_client_rect(target);
                if rect.width > 0.0 && rect.height > 0.0 {
                    let px = (me.offset_x as f64 / rect.width * 100.0).clamp(0.0, 100.0);
                    let py = (me.offset_y as f64 / rect.height * 100.0).clamp(0.0, 100.0);
                    set_style(target, "--glow-x", &format!("{:.1}%", px));
                    set_style(target, "--glow-y", &format!("{:.1}%", py));
                }
            }
        }
    };
    let onmouseenter = move |e: std::boxed::Box<dyn tairitsu_vdom::EventData>| {
        if let Some(me) = e.as_any().downcast_ref::<tairitsu_vdom::MouseEvent>() {
            if let Some(target) = me.target {
                set_style(target, "--glow-intensity", "1");
            }
        }
    };
    let onmouseleave = move |e: std::boxed::Box<dyn tairitsu_vdom::EventData>| {
        if let Some(me) = e.as_any().downcast_ref::<tairitsu_vdom::MouseEvent>() {
            if let Some(target) = me.target {
                set_style(target, "--glow-x", "50%");
                set_style(target, "--glow-y", "50%");
                set_style(target, "--glow-intensity", "0");
            }
        }
    };
    VNode::Element(
        VElement::new("div")
            .class("hi-glow-wrapper hi-glow-blur-medium hi-glow-soft")
            .attr("style", "--glow-x:50%;--glow-y:50%;--glow-intensity:0;")
            .on_event("mousemove", onmousemove)
            .on_event("mouseenter", onmouseenter)
            .on_event("mouseleave", onmouseleave)
            .child(children),
    )
}

fn menu_item(href: &str, label: &str, icon: MdiIcon) -> VNode {
    let inner = VNode::Element(
        VElement::new("a")
            .attr("href", href)
            .class("hi-menu-item-inner")
            .child(icon_el(icon))
            .child(VNode::Element(
                VElement::new("span")
                    .class("hi-menu-item-content")
                    .child(txt(label)),
            )),
    );
    glow_wrap(VNode::Element(
        VElement::new("li")
            .class("hi-menu-item hi-menu-height-compact")
            .child(inner),
    ))
}

fn submenu_title(label: &str, _level: u32) -> VNode {
    let arrow = VNode::Element(
        VElement::new("span")
            .class("hi-menu-item-arrow")
            .child(txt("›")),
    );
    VNode::Element(
        VElement::new("div")
            .class(format!("hi-submenu-title hi-menu-height-compact"))
            .child(arrow)
            .child(txt(label)),
    )
}

fn submenu(label: &str, level: u32, children: Vec<VNode>, open: bool) -> VNode {
    let title = submenu_title(label, level);
    let list = VNode::Element(
        VElement::new("ul")
            .class("hi-submenu-list")
            .children(children),
    );
    let mut el = VElement::new("li").class("hi-submenu");
    el = el.child(title).child(list);
    if !open {
        el = el.attr("data-collapsed", "");
    }
    VNode::Element(el)
}

fn plain_menu_item(href: &str, label: &str, _level: u32) -> VNode {
    let inner = VNode::Element(
        VElement::new("a")
            .attr("href", href)
            .class("hi-menu-item-inner")
            .child(VNode::Element(
                VElement::new("span")
                    .class("hi-menu-item-content")
                    .child(txt(label)),
            )),
    );
    glow_wrap(VNode::Element(
        VElement::new("li")
            .class(format!("hi-menu-item hi-menu-height-compact"))
            .child(inner),
    ))
}

pub fn render() -> VNode {
    let mut category_nodes: Vec<VNode> = Vec::new();

    for category in NAV_CATEGORIES {
        if category.subcategories.len() == 1 && category.subcategories[0].items.is_empty() {
            let sub = &category.subcategories[0];
            category_nodes.push(plain_menu_item(sub.href, sub.label, 1));
            continue;
        }

        let mut subcategory_nodes: Vec<VNode> = Vec::new();

        for subcategory in category.subcategories {
            if subcategory.items.is_empty() {
                subcategory_nodes.push(plain_menu_item(subcategory.href, subcategory.label, 2));
            } else {
                let item_nodes: Vec<VNode> = subcategory
                    .items
                    .iter()
                    .map(|item| menu_item(item.href, item.label, item.icon))
                    .collect();
                subcategory_nodes.push(submenu(subcategory.label, 2, item_nodes, true));
            }
        }

        category_nodes.push(submenu(
            category.label,
            1,
            subcategory_nodes,
            category.default_open,
        ));
    }

    let menu_list = VNode::Element(
        VElement::new("ul")
            .class("hi-menu-list")
            .children(category_nodes),
    );

    VNode::Element(
        VElement::new("aside")
            .attr("id", "hikari-aside")
            .class("hi-aside hi-aside-drawer hi-aside-lg hi-aside-light")
            .child(VNode::Element(
                VElement::new("nav")
                    .class("hi-menu hi-menu-vertical hi-menu-compact")
                    .child(menu_list),
            ))
            .child(super::aside_footer::render()),
    )
}
