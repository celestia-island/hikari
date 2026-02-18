// website/src/components/sidebar.rs
// Sidebar navigation with 3-level hierarchy using Menu component

use dioxus::prelude::*;
use dioxus_router::{use_navigator, use_route};

use crate::app::Route;
use crate::hooks::use_language;
use _components::navigation::{Menu, MenuItem, MenuItemHeight, MenuMode, SubMenu};
use _i18n::context::Language;
use _icons::{Icon, MdiIcon};

static SIDEBAR_SCROLL_POSITION: GlobalSignal<f64> = Signal::global(|| 0.0);

fn get_category_title(id: &str) -> String {
    let i18n = match crate::hooks::use_i18n() {
        Some(ctx) => ctx,
        None => return id.to_string(),
    };

    match id {
        "overview" => i18n.keys.sidebar.overview.title.clone(),
        "components" => i18n.keys.sidebar.components.title.clone(),
        "system" => i18n.keys.sidebar.system.title.clone(),
        "demos" => i18n.keys.sidebar.demos.title.clone(),
        _ => id.to_string(),
    }
}

fn get_subcategory_label(category_id: &str, label_key: &str) -> String {
    let i18n = match crate::hooks::use_i18n() {
        Some(ctx) => ctx,
        None => return label_key.to_string(),
    };

    match (category_id, label_key) {
        ("overview", "home") => i18n
            .keys
            .sidebar
            .overview
            .home
            .clone()
            .unwrap_or_else(|| label_key.to_string()),
        ("components", "layer1") => i18n
            .keys
            .sidebar
            .components
            .layer1
            .clone()
            .unwrap_or_else(|| label_key.to_string()),
        ("components", "layer2") => i18n
            .keys
            .sidebar
            .components
            .layer2
            .clone()
            .unwrap_or_else(|| label_key.to_string()),
        ("components", "layer3") => i18n
            .keys
            .sidebar
            .components
            .layer3
            .clone()
            .unwrap_or_else(|| label_key.to_string()),
        ("system", "overview") => i18n
            .keys
            .sidebar
            .system
            .overview
            .clone()
            .unwrap_or_else(|| label_key.to_string()),
        ("system", "css_utilities") => i18n
            .keys
            .sidebar
            .system
            .css_utilities
            .clone()
            .unwrap_or_else(|| label_key.to_string()),
        ("system", "icons") => i18n
            .keys
            .sidebar
            .system
            .icons
            .clone()
            .unwrap_or_else(|| label_key.to_string()),
        ("system", "palette") => i18n
            .keys
            .sidebar
            .system
            .palette
            .clone()
            .unwrap_or_else(|| label_key.to_string()),
        ("system", "animations") => i18n
            .keys
            .sidebar
            .system
            .animations
            .clone()
            .unwrap_or_else(|| label_key.to_string()),
        ("system", "animation_demo") => i18n
            .keys
            .sidebar
            .system
            .animation_demo
            .clone()
            .unwrap_or_else(|| label_key.to_string()),
        ("demos", "all_demos") => i18n
            .keys
            .sidebar
            .demos
            .all_demos
            .clone()
            .unwrap_or_else(|| label_key.to_string()),
        _ => label_key.to_string(),
    }
}

fn get_item_label(label_key: &str) -> String {
    let i18n = match crate::hooks::use_i18n() {
        Some(ctx) => ctx,
        None => return label_key.to_string(),
    };

    match label_key {
        "button" => i18n.keys.sidebar.items.button.clone(),
        "form" => i18n.keys.sidebar.items.form.clone(),
        "number_input" => i18n.keys.sidebar.items.number_input.clone(),
        "search" => i18n.keys.sidebar.items.search.clone(),
        "switch" => i18n.keys.sidebar.items.switch.clone(),
        "feedback" => i18n.keys.sidebar.items.feedback.clone(),
        "display" => i18n.keys.sidebar.items.display.clone(),
        "avatar" => i18n.keys.sidebar.items.avatar.clone(),
        "image" => i18n.keys.sidebar.items.image.clone(),
        "tag" => i18n.keys.sidebar.items.tag.clone(),
        "empty" => i18n.keys.sidebar.items.empty.clone(),
        "comment" => i18n.keys.sidebar.items.comment.clone(),
        "description_list" => i18n.keys.sidebar.items.description_list.clone(),
        "navigation" => i18n.keys.sidebar.items.navigation.clone(),
        "collapsible" => i18n.keys.sidebar.items.collapsible.clone(),
        "data" => i18n.keys.sidebar.items.data.clone(),
        "table" => i18n.keys.sidebar.items.table.clone(),
        "tree" => i18n.keys.sidebar.items.tree.clone(),
        "pagination" => i18n.keys.sidebar.items.pagination.clone(),
        "qrcode" => i18n.keys.sidebar.items.qrcode.clone(),
        "timeline" => i18n.keys.sidebar.items.timeline.clone(),
        "cascader" => i18n.keys.sidebar.items.cascader.clone(),
        "transfer" => i18n.keys.sidebar.items.transfer.clone(),
        "media" => i18n.keys.sidebar.items.media.clone(),
        "editor" => i18n.keys.sidebar.items.editor.clone(),
        "visualization" => i18n.keys.sidebar.items.visualization.clone(),
        "user_guide" => i18n.keys.sidebar.items.user_guide.clone(),
        "zoom_controls" => i18n.keys.sidebar.items.zoom_controls.clone(),
        "form_demo" => i18n.keys.sidebar.items.form_demo.clone(),
        "dashboard_demo" => i18n.keys.sidebar.items.dashboard_demo.clone(),
        "video_demo" => i18n.keys.sidebar.items.video_demo.clone(),
        _ => label_key.to_string(),
    }
}

fn route_key_to_route(key: &str, lang: &str) -> Route {
    match key {
        "home" => Route::LangHome {
            lang: lang.to_string(),
        },
        "components" => Route::ComponentsOverview {
            lang: lang.to_string(),
        },
        "animation_demo" => Route::AnimationDemo {
            lang: lang.to_string(),
        },
        "demos" => Route::DemosOverview {
            lang: lang.to_string(),
        },
        "form_demo" => Route::FormDemo {
            lang: lang.to_string(),
        },
        "dashboard_demo" => Route::DashboardDemo {
            lang: lang.to_string(),
        },
        "video_demo" => Route::VideoDemo {
            lang: lang.to_string(),
        },
        "button" => Route::Button {
            lang: lang.to_string(),
        },
        "layer1_form" => Route::Layer1Form {
            lang: lang.to_string(),
        },
        "layer1_switch" => Route::Layer1Switch {
            lang: lang.to_string(),
        },
        "layer1_feedback" => Route::Layer1Feedback {
            lang: lang.to_string(),
        },
        "layer1_display" => Route::Layer1Display {
            lang: lang.to_string(),
        },
        "number_input" => Route::NumberInput {
            lang: lang.to_string(),
        },
        "search" => Route::Search {
            lang: lang.to_string(),
        },
        "avatar" => Route::Avatar {
            lang: lang.to_string(),
        },
        "image" => Route::Image {
            lang: lang.to_string(),
        },
        "tag" => Route::Tag {
            lang: lang.to_string(),
        },
        "empty" => Route::Empty {
            lang: lang.to_string(),
        },
        "comment" => Route::Comment {
            lang: lang.to_string(),
        },
        "description_list" => Route::DescriptionList {
            lang: lang.to_string(),
        },
        "layer2" => Route::Layer2Overview {
            lang: lang.to_string(),
        },
        "layer2_navigation" => Route::Layer2Navigation {
            lang: lang.to_string(),
        },
        "layer2_data" => Route::Layer2Data {
            lang: lang.to_string(),
        },
        "layer2_form" => Route::Layer2Form {
            lang: lang.to_string(),
        },
        "layer2_feedback" => Route::Layer2Feedback {
            lang: lang.to_string(),
        },
        "cascader" => Route::Cascader {
            lang: lang.to_string(),
        },
        "transfer" => Route::Transfer {
            lang: lang.to_string(),
        },
        "collapsible" => Route::Collapsible {
            lang: lang.to_string(),
        },
        "timeline" => Route::Timeline {
            lang: lang.to_string(),
        },
        "table" => Route::Table {
            lang: lang.to_string(),
        },
        "tree" => Route::Tree {
            lang: lang.to_string(),
        },
        "pagination" => Route::Pagination {
            lang: lang.to_string(),
        },
        "qrcode" => Route::QRCode {
            lang: lang.to_string(),
        },
        "layer3" => Route::Layer3Overview {
            lang: lang.to_string(),
        },
        "layer3_media" => Route::Layer3Media {
            lang: lang.to_string(),
        },
        "layer3_editor" => Route::Layer3Editor {
            lang: lang.to_string(),
        },
        "layer3_visualization" => Route::Layer3Visualization {
            lang: lang.to_string(),
        },
        "user_guide" => Route::UserGuide {
            lang: lang.to_string(),
        },
        "zoom_controls" => Route::ZoomControls {
            lang: lang.to_string(),
        },
        "system" => Route::SystemOverview {
            lang: lang.to_string(),
        },
        "system_css" => Route::SystemCSS {
            lang: lang.to_string(),
        },
        "system_icons" => Route::SystemIcons {
            lang: lang.to_string(),
        },
        "system_palette" => Route::SystemPalette {
            lang: lang.to_string(),
        },
        "system_animations" => Route::SystemAnimations {
            lang: lang.to_string(),
        },
        "system_i18n" => Route::SystemI18n {
            lang: lang.to_string(),
        },
        _ => Route::LangHome {
            lang: lang.to_string(),
        },
    }
}

#[component]
pub fn Sidebar(current_route: Route) -> Element {
    use_effect(move || {
        let scroll_pos = *SIDEBAR_SCROLL_POSITION.read();
        if scroll_pos > 0.0 {
            if let Some(window) = web_sys::window() {
                if let Some(document) = window.document() {
                    if let Some(container) = document
                        .query_selector(".hi-layout-aside-content")
                        .ok()
                        .flatten()
                    {
                        container.set_scroll_top(scroll_pos as i32);
                    }
                }
            }
        }
    });

    let lang_ctx = use_language();
    let lang = (*lang_ctx.language.read()).url_prefix().to_string();

    rsx! {
        Menu {
            mode: MenuMode::Vertical,
            compact: true,
            on_select: move |_key| {},

            for category in NAVIGATION_CATEGORIES {
                SidebarCategorySection {
                    category,
                    current_route: current_route.clone(),
                    lang: lang.clone(),
                }
            }
        }
    }
}

#[component]
fn SidebarCategorySection(
    category: &'static NavCategory,
    current_route: Route,
    lang: String,
) -> Element {
    let title = get_category_title(category.id);

    // 如果只有一个子项且没有嵌套项，直接渲染为 MenuItem
    if category.subcategories.len() == 1 && category.subcategories[0].items.is_empty() {
        let sub = &category.subcategories[0];
        let route_to_navigate = route_key_to_route(sub.route_key, &lang);
        let is_active = routes_equal(&current_route, &route_to_navigate);
        let navigator = use_navigator();
        let label = get_subcategory_label(category.id, sub.label_key);

        rsx! {
            MenuItem {
                item_key: category.id.to_string(),
                class: if is_active { "hi-menu-item-active" } else { "" },
                level: 1,
                height: MenuItemHeight::Compact,
                glow: true,
                onclick: {
                    let navigator = navigator.clone();
                    move |_| {
                        save_sidebar_scroll_position();
                        navigator.push(route_to_navigate.clone());
                    }
                },
                "{label}"
            }
        }
    } else {
        rsx! {
            SubMenu {
                item_key: category.id.to_string(),
                title,
                default_expanded: category.id == "components",
                level: 1,
                height: MenuItemHeight::Compact,

                for subcategory in category.subcategories {
                    SidebarSubcategoryItem {
                        subcategory,
                        category_id: category.id,
                        current_route: current_route.clone(),
                        lang: lang.clone(),
                    }
                }
            }
        }
    }
}

#[component]
fn SidebarSubcategoryItem(
    subcategory: &'static NavSubcategory,
    category_id: &'static str,
    current_route: Route,
    lang: String,
) -> Element {
    let has_children = !subcategory.items.is_empty();
    let label = get_subcategory_label(category_id, subcategory.label_key);

    if has_children {
        rsx! {
            SubMenu {
                item_key: subcategory.label_key.to_string(),
                title: label.clone(),
                default_expanded: true,
                level: 2,
                height: MenuItemHeight::Compact,

                for item in subcategory.items {
                    SidebarNestedItem {
                        item,
                        current_route: current_route.clone(),
                        lang: lang.clone(),
                    }
                }
            }
        }
    } else {
        let route_to_navigate = route_key_to_route(subcategory.route_key, &lang);
        let is_active = routes_equal(&current_route, &route_to_navigate);
        let navigator = use_navigator();

        rsx! {
            MenuItem {
                item_key: subcategory.label_key.to_string(),
                class: if is_active { "hi-menu-item-active" } else { "" },
                level: 2,
                height: MenuItemHeight::Compact,
                glow: true,
                onclick: {
                    let navigator = navigator.clone();
                    move |_| {
                        save_sidebar_scroll_position();
                        navigator.push(route_to_navigate.clone());
                    }
                },

                "{label}"
            }
        }
    }
}

#[component]
fn SidebarNestedItem(item: &'static NavItem, current_route: Route, lang: String) -> Element {
    let route_to_navigate = route_key_to_route(item.route_key, &lang);
    let is_active = routes_equal(&current_route, &route_to_navigate);
    let navigator = use_navigator();
    let label = get_item_label(item.label_key);

    rsx! {
        MenuItem {
            item_key: format!("{:?}", std::mem::discriminant(&route_to_navigate)),
            class: if is_active { "hi-menu-item-active" } else { "" },
            level: 3,
            height: MenuItemHeight::Compact,
            glow: true,
            icon: rsx! { Icon { icon: item.icon, size:14 } },
            onclick: {
                let navigator = navigator.clone();
                move |_| {
                    save_sidebar_scroll_position();
                    navigator.push(route_to_navigate.clone());
                }
            },

            "{label}"
        }
    }
}

fn routes_equal(a: &Route, b: &Route) -> bool {
    std::mem::discriminant(a) == std::mem::discriminant(b)
}

fn save_sidebar_scroll_position() {
    if let Some(window) = web_sys::window() {
        if let Some(document) = window.document() {
            if let Ok(Some(container)) = document.query_selector(".hi-layout-aside-content") {
                let scroll_top = container.scroll_top() as f64;
                *SIDEBAR_SCROLL_POSITION.write() = scroll_top;
            }
        }
    }
}

// ============================================
// Navigation Data Structures
// ============================================

#[derive(Clone, Debug)]
pub struct NavCategory {
    pub id: &'static str,
    pub subcategories: &'static [NavSubcategory],
}

impl PartialEq for NavCategory {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl Eq for NavCategory {}

#[derive(Clone, Debug)]
pub struct NavSubcategory {
    pub label_key: &'static str,
    pub route_key: &'static str,
    pub items: &'static [NavItem],
}

impl PartialEq for NavSubcategory {
    fn eq(&self, other: &Self) -> bool {
        self.label_key == other.label_key
    }
}

#[derive(Clone, Debug)]
pub struct NavItem {
    pub label_key: &'static str,
    pub icon: MdiIcon,
    pub route_key: &'static str,
}

impl PartialEq for NavItem {
    fn eq(&self, other: &Self) -> bool {
        self.label_key == other.label_key
    }
}

// ============================================
// Navigation Data
// ============================================

pub static NAVIGATION_CATEGORIES: &[NavCategory] = &[
    NavCategory {
        id: "overview",
        subcategories: &[NavSubcategory {
            label_key: "home",
            route_key: "home",
            items: &[],
        }],
    },
    NavCategory {
        id: "components",
        subcategories: &[
            NavSubcategory {
                label_key: "layer1",
                route_key: "button",
                items: &[
                    NavItem {
                        label_key: "button",
                        icon: MdiIcon::Cursor,
                        route_key: "button",
                    },
                    NavItem {
                        label_key: "form",
                        icon: MdiIcon::TextBoxEdit,
                        route_key: "layer1_form",
                    },
                    NavItem {
                        label_key: "number_input",
                        icon: MdiIcon::FormatListNumbered,
                        route_key: "number_input",
                    },
                    NavItem {
                        label_key: "search",
                        icon: MdiIcon::Magnify,
                        route_key: "search",
                    },
                    NavItem {
                        label_key: "switch",
                        icon: MdiIcon::ToggleSwitch,
                        route_key: "layer1_switch",
                    },
                    NavItem {
                        label_key: "feedback",
                        icon: MdiIcon::Alert,
                        route_key: "layer1_feedback",
                    },
                    NavItem {
                        label_key: "display",
                        icon: MdiIcon::Image,
                        route_key: "layer1_display",
                    },
                    NavItem {
                        label_key: "avatar",
                        icon: MdiIcon::Account,
                        route_key: "avatar",
                    },
                    NavItem {
                        label_key: "image",
                        icon: MdiIcon::Image,
                        route_key: "image",
                    },
                    NavItem {
                        label_key: "tag",
                        icon: MdiIcon::Star,
                        route_key: "tag",
                    },
                    NavItem {
                        label_key: "empty",
                        icon: MdiIcon::ViewDashboard,
                        route_key: "empty",
                    },
                    NavItem {
                        label_key: "comment",
                        icon: MdiIcon::Chat,
                        route_key: "comment",
                    },
                    NavItem {
                        label_key: "description_list",
                        icon: MdiIcon::FormatListBulleted,
                        route_key: "description_list",
                    },
                ],
            },
            NavSubcategory {
                label_key: "layer2",
                route_key: "layer2",
                items: &[
                    NavItem {
                        label_key: "navigation",
                        icon: MdiIcon::FormatListBulleted,
                        route_key: "layer2_navigation",
                    },
                    NavItem {
                        label_key: "collapsible",
                        icon: MdiIcon::ArrowExpandHorizontal,
                        route_key: "collapsible",
                    },
                    NavItem {
                        label_key: "data",
                        icon: MdiIcon::Graph,
                        route_key: "layer2_data",
                    },
                    NavItem {
                        label_key: "table",
                        icon: MdiIcon::Table,
                        route_key: "table",
                    },
                    NavItem {
                        label_key: "tree",
                        icon: MdiIcon::SourceBranch,
                        route_key: "tree",
                    },
                    NavItem {
                        label_key: "pagination",
                        icon: MdiIcon::ChevronLeft,
                        route_key: "pagination",
                    },
                    NavItem {
                        label_key: "qrcode",
                        icon: MdiIcon::ViewDashboard,
                        route_key: "qrcode",
                    },
                    NavItem {
                        label_key: "timeline",
                        icon: MdiIcon::ChartTimeline,
                        route_key: "timeline",
                    },
                    NavItem {
                        label_key: "form",
                        icon: MdiIcon::TextBoxEdit,
                        route_key: "layer2_form",
                    },
                    NavItem {
                        label_key: "cascader",
                        icon: MdiIcon::ChevronDown,
                        route_key: "cascader",
                    },
                    NavItem {
                        label_key: "transfer",
                        icon: MdiIcon::SwapHorizontal,
                        route_key: "transfer",
                    },
                    NavItem {
                        label_key: "feedback",
                        icon: MdiIcon::Bell,
                        route_key: "layer2_feedback",
                    },
                ],
            },
            NavSubcategory {
                label_key: "layer3",
                route_key: "layer3",
                items: &[
                    NavItem {
                        label_key: "media",
                        icon: MdiIcon::Play,
                        route_key: "layer3_media",
                    },
                    NavItem {
                        label_key: "editor",
                        icon: MdiIcon::FormatBold,
                        route_key: "layer3_editor",
                    },
                    NavItem {
                        label_key: "visualization",
                        icon: MdiIcon::CubeOutline,
                        route_key: "layer3_visualization",
                    },
                    NavItem {
                        label_key: "user_guide",
                        icon: MdiIcon::BookOpen,
                        route_key: "user_guide",
                    },
                    NavItem {
                        label_key: "zoom_controls",
                        icon: MdiIcon::MagnifyPlus,
                        route_key: "zoom_controls",
                    },
                ],
            },
        ],
    },
    NavCategory {
        id: "system",
        subcategories: &[
            NavSubcategory {
                label_key: "overview",
                route_key: "system",
                items: &[],
            },
            NavSubcategory {
                label_key: "css_utilities",
                route_key: "system_css",
                items: &[],
            },
            NavSubcategory {
                label_key: "icons",
                route_key: "system_icons",
                items: &[],
            },
            NavSubcategory {
                label_key: "palette",
                route_key: "system_palette",
                items: &[],
            },
            NavSubcategory {
                label_key: "animations",
                route_key: "system_animations",
                items: &[],
            },
            NavSubcategory {
                label_key: "animation_demo",
                route_key: "animation_demo",
                items: &[],
            },
        ],
    },
    NavCategory {
        id: "demos",
        subcategories: &[NavSubcategory {
            label_key: "all_demos",
            route_key: "demos",
            items: &[
                NavItem {
                    label_key: "form_demo",
                    icon: MdiIcon::TextBoxEdit,
                    route_key: "form_demo",
                },
                NavItem {
                    label_key: "dashboard_demo",
                    icon: MdiIcon::ViewColumn,
                    route_key: "dashboard_demo",
                },
                NavItem {
                    label_key: "video_demo",
                    icon: MdiIcon::Play,
                    route_key: "video_demo",
                },
            ],
        }],
    },
];
