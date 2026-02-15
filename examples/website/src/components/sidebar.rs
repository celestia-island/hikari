// website/src/components/sidebar.rs
// Sidebar navigation with 3-level hierarchy using Menu component

use dioxus::prelude::*;

use crate::app::Route;
use _components::navigation::{Menu, MenuItem, MenuItemHeight, MenuMode, SubMenu};
use _icons::{Icon, MdiIcon};

/// Global scroll position storage for sidebar
/// Uses the actual aside content container's scroll position
static SIDEBAR_SCROLL_POSITION: GlobalSignal<f64> = Signal::global(|| 0.0);

/// Get localized text for sidebar category by id
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

/// Get localized text for sidebar subcategory by parent id and label key
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

/// Get localized text for sidebar item by label key
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

/// Sidebar navigation with 3-level hierarchy using Menu component
#[component]
pub fn Sidebar(current_route: Route) -> Element {
    // Effect to restore scroll position after route change
    use_effect(move || {
        let scroll_pos = *SIDEBAR_SCROLL_POSITION.read();
        if scroll_pos > 0.0 {
            if let Some(window) = web_sys::window() {
                if let Some(document) = window.document() {
                    // Try to find the scrollable aside content container
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

    rsx! {
        Menu {
            mode: MenuMode::Vertical,
            compact: true,
            on_select: move |_key| {},

            for category in NAVIGATION_CATEGORIES {
                SidebarCategorySection {
                    category,
                    current_route: current_route.clone(),
                }
            }
        }
    }
}

/// Render a category section (Level 1) with its subcategories
#[component]
fn SidebarCategorySection(category: &'static NavCategory, current_route: Route) -> Element {
    let title = get_category_title(category.id);

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
                }
            }
        }
    }
}

/// Render a subcategory (Level 2) with optional nested items
#[component]
fn SidebarSubcategoryItem(
    subcategory: &'static NavSubcategory,
    category_id: &'static str,
    current_route: Route,
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
                    }
                }
            }
        }
    } else {
        let is_active = subcategory
            .route
            .as_ref()
            .map(|r| std::mem::discriminant(r) == std::mem::discriminant(&current_route))
            .unwrap_or(false);

        let route_to_navigate = subcategory.route.clone();
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
                        if let Some(route) = route_to_navigate.as_ref() {
                            navigator.push(route.clone());
                        }
                    }
                },

                "{label}"
            }
        }
    }
}

/// Render a nested item (Level 3) as MenuItem
#[component]
fn SidebarNestedItem(item: &'static NavItem, current_route: Route) -> Element {
    let is_active = std::mem::discriminant(&item.route) == std::mem::discriminant(&current_route);
    let route_to_navigate = item.route.clone();
    let navigator = use_navigator();
    let label = get_item_label(item.label_key);

    rsx! {
        MenuItem {
            item_key: format!("{:?}", std::mem::discriminant(&item.route)),
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

/// Save the current scroll position of the sidebar's aside content container
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
    pub route: Option<Route>,
    pub items: &'static [NavItem],
}

impl PartialEq for NavSubcategory {
    fn eq(&self, other: &Self) -> bool {
        self.label_key == other.label_key
            && self.route.as_ref().map(|r| std::mem::discriminant(r))
                == other.route.as_ref().map(|r| std::mem::discriminant(r))
    }
}

#[derive(Clone, Debug)]
pub struct NavItem {
    pub label_key: &'static str,
    pub icon: MdiIcon,
    pub route: Route,
}

impl PartialEq for NavItem {
    fn eq(&self, other: &Self) -> bool {
        self.label_key == other.label_key
            && std::mem::discriminant(&self.route) == std::mem::discriminant(&other.route)
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
            route: Some(Route::Home {}),
            items: &[],
        }],
    },
    NavCategory {
        id: "components",
        subcategories: &[
            NavSubcategory {
                label_key: "layer1",
                route: Some(Route::Button {}),
                items: &[
                    NavItem {
                        label_key: "button",
                        icon: MdiIcon::Cursor,
                        route: Route::Button {},
                    },
                    NavItem {
                        label_key: "form",
                        icon: MdiIcon::TextBoxEdit,
                        route: Route::Layer1Form {},
                    },
                    NavItem {
                        label_key: "number_input",
                        icon: MdiIcon::FormatListNumbered,
                        route: Route::NumberInput {},
                    },
                    NavItem {
                        label_key: "search",
                        icon: MdiIcon::Magnify,
                        route: Route::Search {},
                    },
                    NavItem {
                        label_key: "switch",
                        icon: MdiIcon::ToggleSwitch,
                        route: Route::Layer1Switch {},
                    },
                    NavItem {
                        label_key: "feedback",
                        icon: MdiIcon::Alert,
                        route: Route::Layer1Feedback {},
                    },
                    NavItem {
                        label_key: "display",
                        icon: MdiIcon::Image,
                        route: Route::Layer1Display {},
                    },
                    NavItem {
                        label_key: "avatar",
                        icon: MdiIcon::Account,
                        route: Route::Avatar {},
                    },
                    NavItem {
                        label_key: "image",
                        icon: MdiIcon::Image,
                        route: Route::Image {},
                    },
                    NavItem {
                        label_key: "tag",
                        icon: MdiIcon::Star,
                        route: Route::Tag {},
                    },
                    NavItem {
                        label_key: "empty",
                        icon: MdiIcon::ViewDashboard,
                        route: Route::Empty {},
                    },
                    NavItem {
                        label_key: "comment",
                        icon: MdiIcon::Chat,
                        route: Route::Comment {},
                    },
                    NavItem {
                        label_key: "description_list",
                        icon: MdiIcon::FormatListBulleted,
                        route: Route::DescriptionList {},
                    },
                ],
            },
            NavSubcategory {
                label_key: "layer2",
                route: Some(Route::Layer2Overview {}),
                items: &[
                    NavItem {
                        label_key: "navigation",
                        icon: MdiIcon::FormatListBulleted,
                        route: Route::Layer2Navigation {},
                    },
                    NavItem {
                        label_key: "collapsible",
                        icon: MdiIcon::ArrowExpandHorizontal,
                        route: Route::Collapsible {},
                    },
                    NavItem {
                        label_key: "data",
                        icon: MdiIcon::Graph,
                        route: Route::Layer2Data {},
                    },
                    NavItem {
                        label_key: "table",
                        icon: MdiIcon::Table,
                        route: Route::Table {},
                    },
                    NavItem {
                        label_key: "tree",
                        icon: MdiIcon::SourceBranch,
                        route: Route::Tree {},
                    },
                    NavItem {
                        label_key: "pagination",
                        icon: MdiIcon::ChevronLeft,
                        route: Route::Pagination {},
                    },
                    NavItem {
                        label_key: "qrcode",
                        icon: MdiIcon::ViewDashboard,
                        route: Route::QRCode {},
                    },
                    NavItem {
                        label_key: "timeline",
                        icon: MdiIcon::ChartTimeline,
                        route: Route::Timeline {},
                    },
                    NavItem {
                        label_key: "form",
                        icon: MdiIcon::TextBoxEdit,
                        route: Route::Layer2Form {},
                    },
                    NavItem {
                        label_key: "cascader",
                        icon: MdiIcon::ChevronDown,
                        route: Route::Cascader {},
                    },
                    NavItem {
                        label_key: "transfer",
                        icon: MdiIcon::SwapHorizontal,
                        route: Route::Transfer {},
                    },
                    NavItem {
                        label_key: "feedback",
                        icon: MdiIcon::Bell,
                        route: Route::Layer2Feedback {},
                    },
                ],
            },
            NavSubcategory {
                label_key: "layer3",
                route: Some(Route::Layer3Overview {}),
                items: &[
                    NavItem {
                        label_key: "media",
                        icon: MdiIcon::Play,
                        route: Route::Layer3Media {},
                    },
                    NavItem {
                        label_key: "editor",
                        icon: MdiIcon::FormatBold,
                        route: Route::Layer3Editor {},
                    },
                    NavItem {
                        label_key: "visualization",
                        icon: MdiIcon::CubeOutline,
                        route: Route::Layer3Visualization {},
                    },
                    NavItem {
                        label_key: "user_guide",
                        icon: MdiIcon::BookOpen,
                        route: Route::UserGuide {},
                    },
                    NavItem {
                        label_key: "zoom_controls",
                        icon: MdiIcon::MagnifyPlus,
                        route: Route::ZoomControls {},
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
                route: Some(Route::SystemOverview {}),
                items: &[],
            },
            NavSubcategory {
                label_key: "css_utilities",
                route: Some(Route::SystemCSS {}),
                items: &[],
            },
            NavSubcategory {
                label_key: "icons",
                route: Some(Route::SystemIcons {}),
                items: &[],
            },
            NavSubcategory {
                label_key: "palette",
                route: Some(Route::SystemPalette {}),
                items: &[],
            },
            NavSubcategory {
                label_key: "animations",
                route: Some(Route::SystemAnimations {}),
                items: &[],
            },
            NavSubcategory {
                label_key: "animation_demo",
                route: Some(Route::AnimationDemo {}),
                items: &[],
            },
        ],
    },
    NavCategory {
        id: "demos",
        subcategories: &[NavSubcategory {
            label_key: "all_demos",
            route: Some(Route::DemosOverview {}),
            items: &[
                NavItem {
                    label_key: "form_demo",
                    icon: MdiIcon::TextBoxEdit,
                    route: Route::FormDemo {},
                },
                NavItem {
                    label_key: "dashboard_demo",
                    icon: MdiIcon::ViewColumn,
                    route: Route::DashboardDemo {},
                },
                NavItem {
                    label_key: "video_demo",
                    icon: MdiIcon::Play,
                    route: Route::VideoDemo {},
                },
            ],
        }],
    },
];
