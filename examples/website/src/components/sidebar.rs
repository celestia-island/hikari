use std::cell::RefCell;
use std::rc::Rc;

use hikari_i18n::t;
use super::glow::{glow_wrap, GlowColor, GlowConfig, GlowIntensity};
use hikari_icons::generated::mdi_selected::get;
use hikari_icons::MdiIcon;
use tairitsu_vdom::{VElement, VNode, VText};

struct NavItem {
    label_key: &'static str,
    icon: MdiIcon,
    href: &'static str,
}

struct NavSubcategory {
    label_key: &'static str,
    href: &'static str,
    items: &'static [NavItem],
}

struct NavCategory {
    label_key: &'static str,
    default_open: bool,
    subcategories: &'static [NavSubcategory],
}

const NAV_CATEGORIES: &[NavCategory] = &[
    NavCategory {
        label_key: "sidebar.overview.title",
        default_open: true,
        subcategories: &[NavSubcategory {
            label_key: "sidebar.overview.home",
            href: "/",
            items: &[],
        }],
    },
    NavCategory {
        label_key: "sidebar.components.title",
        default_open: true,
        subcategories: &[
            NavSubcategory {
                label_key: "sidebar.components.layer1",
                href: "/components/layer1",
                items: &[
                    NavItem { label_key: "sidebar.items.button", icon: MdiIcon::Cursor, href: "/components/layer1/button" },
                    NavItem { label_key: "sidebar.items.form", icon: MdiIcon::TextBoxEdit, href: "/components/layer1/form" },
                    NavItem { label_key: "sidebar.items.number_input", icon: MdiIcon::FormatListNumbered, href: "/components/layer1/number-input" },
                    NavItem { label_key: "sidebar.items.search", icon: MdiIcon::Magnify, href: "/components/layer1/search" },
                    NavItem { label_key: "sidebar.items.switch", icon: MdiIcon::ToggleSwitch, href: "/components/layer1/switch" },
                    NavItem { label_key: "sidebar.items.feedback", icon: MdiIcon::Alert, href: "/components/layer1/feedback" },
                    NavItem { label_key: "sidebar.items.display", icon: MdiIcon::Image, href: "/components/layer1/display" },
                    NavItem { label_key: "sidebar.items.avatar", icon: MdiIcon::Account, href: "/components/layer1/avatar" },
                    NavItem { label_key: "sidebar.items.image", icon: MdiIcon::Image, href: "/components/layer1/image" },
                    NavItem { label_key: "sidebar.items.tag", icon: MdiIcon::Star, href: "/components/layer1/tag" },
                    NavItem { label_key: "sidebar.items.empty", icon: MdiIcon::ViewDashboard, href: "/components/layer1/empty" },
                    NavItem { label_key: "sidebar.items.comment", icon: MdiIcon::Chat, href: "/components/layer1/comment" },
                    NavItem { label_key: "sidebar.items.description_list", icon: MdiIcon::FormatListBulleted, href: "/components/layer1/description-list" },
                ],
            },
            NavSubcategory {
                label_key: "sidebar.components.layer2",
                href: "/components/layer2",
                items: &[
                    NavItem { label_key: "sidebar.items.navigation", icon: MdiIcon::FormatListBulleted, href: "/components/layer2/navigation" },
                    NavItem { label_key: "sidebar.items.collapsible", icon: MdiIcon::ArrowExpandHorizontal, href: "/components/layer2/collapsible" },
                    NavItem { label_key: "sidebar.items.data", icon: MdiIcon::Graph, href: "/components/layer2/data" },
                    NavItem { label_key: "sidebar.items.table", icon: MdiIcon::Table, href: "/components/layer2/table" },
                    NavItem { label_key: "sidebar.items.tree", icon: MdiIcon::SourceBranch, href: "/components/layer2/tree" },
                    NavItem { label_key: "sidebar.items.pagination", icon: MdiIcon::ChevronLeft, href: "/components/layer2/pagination" },
                    NavItem { label_key: "sidebar.items.qrcode", icon: MdiIcon::ViewDashboard, href: "/components/layer2/qrcode" },
                    NavItem { label_key: "sidebar.items.timeline", icon: MdiIcon::ChartTimeline, href: "/components/layer2/timeline" },
                    NavItem { label_key: "sidebar.items.form", icon: MdiIcon::TextBoxEdit, href: "/components/layer2/form" },
                    NavItem { label_key: "sidebar.items.cascader", icon: MdiIcon::ChevronDown, href: "/components/layer2/cascader" },
                    NavItem { label_key: "sidebar.items.transfer", icon: MdiIcon::SwapHorizontal, href: "/components/layer2/transfer" },
                    NavItem { label_key: "sidebar.items.feedback", icon: MdiIcon::Bell, href: "/components/layer2/feedback" },
                ],
            },
            NavSubcategory {
                label_key: "sidebar.components.layer3",
                href: "/components/layer3",
                items: &[
                    NavItem { label_key: "sidebar.items.media", icon: MdiIcon::Play, href: "/components/layer3/media" },
                    NavItem { label_key: "sidebar.items.editor", icon: MdiIcon::FormatBold, href: "/components/layer3/editor" },
                    NavItem { label_key: "sidebar.items.visualization", icon: MdiIcon::CubeOutline, href: "/components/layer3/visualization" },
                    NavItem { label_key: "sidebar.items.user_guide", icon: MdiIcon::BookOpen, href: "/components/layer3/user-guide" },
                    NavItem { label_key: "sidebar.items.zoom_controls", icon: MdiIcon::MagnifyPlus, href: "/components/layer3/zoom-controls" },
                ],
            },
        ],
    },
    NavCategory {
        label_key: "sidebar.system.title",
        default_open: false,
        subcategories: &[
            NavSubcategory { label_key: "sidebar.system.overview", href: "/system", items: &[] },
            NavSubcategory { label_key: "sidebar.system.css_utilities", href: "/system/css", items: &[] },
            NavSubcategory { label_key: "sidebar.system.icons", href: "/system/icons", items: &[] },
            NavSubcategory { label_key: "sidebar.system.palette", href: "/system/palette", items: &[] },
            NavSubcategory { label_key: "sidebar.system.animations", href: "/system/animations", items: &[] },
            NavSubcategory { label_key: "sidebar.system.i18n", href: "/system/i18n", items: &[] },
            NavSubcategory { label_key: "sidebar.system.animation_demo", href: "/animations", items: &[] },
        ],
    },
    NavCategory {
        label_key: "sidebar.demos.title",
        default_open: false,
        subcategories: &[NavSubcategory {
            label_key: "sidebar.demos.all_demos",
            href: "/demos",
            items: &[
                NavItem { label_key: "sidebar.items.form_demo", icon: MdiIcon::TextBoxEdit, href: "/demos/form" },
                NavItem { label_key: "sidebar.items.dashboard_demo", icon: MdiIcon::ViewColumn, href: "/demos/dashboard" },
                NavItem { label_key: "sidebar.items.video_demo", icon: MdiIcon::Play, href: "/demos/video" },
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
            .inner_html(svg_str),
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
    glow_wrap(
        VNode::Element(
            VElement::new("li")
                .class("hi-menu-item hi-menu-height-compact")
                .child(inner),
        ),
        GlowConfig {
            intensity: GlowIntensity::Dim,
            color: GlowColor::Ghost,
            block: true,
            radius: "var(--hi-radius-sm, 4px)",
            ..Default::default()
        },
    )
}

fn submenu_title(label: &str, _level: u32) -> VNode {
    let arrow = icon_el(MdiIcon::ChevronRight);
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
            .style(format!("padding-left:{}em", level))
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
    glow_wrap(
        VNode::Element(
            VElement::new("li")
                .class(format!("hi-menu-item hi-menu-height-compact"))
                .child(inner),
        ),
        GlowConfig {
            intensity: GlowIntensity::Dim,
            color: GlowColor::Ghost,
            block: true,
            radius: "var(--hi-radius-sm, 4px)",
            ..Default::default()
        },
    )
}

pub fn render(app_ref: Rc<RefCell<Option<Box<dyn std::any::Any>>>>) -> VNode {
    let mut category_nodes: Vec<VNode> = Vec::new();

    for category in NAV_CATEGORIES {
        if category.subcategories.len() == 1 && category.subcategories[0].items.is_empty() {
            let sub = &category.subcategories[0];
            category_nodes.push(plain_menu_item(sub.href, &t!(sub.label_key), 1));
            continue;
        }

        let mut subcategory_nodes: Vec<VNode> = Vec::new();

        for subcategory in category.subcategories {
            if subcategory.items.is_empty() {
                subcategory_nodes.push(plain_menu_item(subcategory.href, &t!(subcategory.label_key), 2));
            } else {
                let item_nodes: Vec<VNode> = subcategory
                    .items
                    .iter()
                    .map(|item| menu_item(item.href, &t!(item.label_key), item.icon))
                    .collect();
                subcategory_nodes.push(submenu(&t!(subcategory.label_key), 2, item_nodes, true));
            }
        }

        category_nodes.push(submenu(
            &t!(category.label_key),
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
                VElement::new("div")
                    .class("hi-aside-content")
                    .child(VNode::Element(
                        VElement::new("nav")
                            .class("hi-menu hi-menu-vertical hi-menu-compact")
                            .child(menu_list),
                    )),
            ))
            .child(super::aside_footer::render(app_ref)),
    )
}
