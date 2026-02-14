// website/src/components/sidebar.rs
// Sidebar navigation with 3-level hierarchy using Menu component

use dioxus::prelude::*;

use crate::app::Route;
use _components::navigation::{Menu, MenuItem, MenuItemHeight, MenuMode, SubMenu};
use _icons::{Icon, MdiIcon};

/// Sidebar navigation with 3-level hierarchy using Menu component
#[component]
pub fn Sidebar(current_route: Route) -> Element {
    rsx! {
        Menu {
            mode: MenuMode::Vertical,
            compact: true,
            on_select: move |_key| {},

            // Render each top-level category
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
    rsx! {
        SubMenu {
            item_key: category.id.to_string(),
            title: category.title_en.to_string(),
            default_expanded: category.id == "components",
            level: 1,
            height: MenuItemHeight::Compact,

            // Render subcategories
            for subcategory in category.subcategories {
                SidebarSubcategoryItem {
                    subcategory,
                    current_route: current_route.clone(),
                }
            }
        }
    }
}

/// Render a subcategory (Level 2) with optional nested items
#[component]
fn SidebarSubcategoryItem(subcategory: &'static NavSubcategory, current_route: Route) -> Element {
    let has_children = !subcategory.items.is_empty();

    if has_children {
        rsx! {
            SubMenu {
                item_key: subcategory.label_en.to_string(),
                title: subcategory.label_en.to_string(),
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

        let navigator = use_navigator();
        let route_to_navigate = subcategory.route.clone();
        let label = subcategory.label_en;

        rsx! {
            MenuItem {
                item_key: label.to_string(),
                class: if is_active { "hi-menu-item-active" } else { "" },
                level: 2,
                height: MenuItemHeight::Compact,
                glow: true,
                onclick: {
                    let navigator = navigator.clone();
                    let route_to_navigate = route_to_navigate.clone();
                    move |_| {
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
    let navigator = use_navigator();
    let route_to_navigate = item.route.clone();

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
                    navigator.push(route_to_navigate.clone());
                }
            },

            "{item.label}"
        }
    }
}

// ============================================
// Navigation Data Structures
// ============================================

#[derive(Clone, Debug)]
pub struct NavCategory {
    pub id: &'static str,
    pub title_en: &'static str,
    pub title_zh: &'static str,
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
    pub label_en: &'static str,
    pub label_zh: &'static str,
    pub route: Option<Route>,
    pub items: &'static [NavItem],
}

impl PartialEq for NavSubcategory {
    fn eq(&self, other: &Self) -> bool {
        self.label_en == other.label_en
            && self.route.as_ref().map(|r| std::mem::discriminant(r))
                == other.route.as_ref().map(|r| std::mem::discriminant(r))
    }
}

#[derive(Clone, Debug)]
pub struct NavItem {
    pub label: &'static str,
    pub icon: MdiIcon,
    pub route: Route,
}

impl PartialEq for NavItem {
    fn eq(&self, other: &Self) -> bool {
        self.label == other.label
            && std::mem::discriminant(&self.route) == std::mem::discriminant(&other.route)
    }
}

// ============================================
// Navigation Data
// ============================================

pub static NAVIGATION_CATEGORIES: &[NavCategory] = &[
    NavCategory {
        id: "overview",
        title_en: "Overview",
        title_zh: "概览",
        subcategories: &[NavSubcategory {
            label_en: "Home",
            label_zh: "首页",
            route: Some(Route::Home {}),
            items: &[],
        }],
    },
    NavCategory {
        id: "components",
        title_en: "Components",
        title_zh: "组件",
        subcategories: &[
            // Layer 1 - Basic Components
            NavSubcategory {
                label_en: "Layer 1",
                label_zh: "基础组件",
                route: Some(Route::Layer1Basic {}),
                items: &[
                    NavItem {
                        label: "Basic",
                        icon: MdiIcon::GestureTap,
                        route: Route::Layer1Basic {},
                    },
                    NavItem {
                        label: "Form",
                        icon: MdiIcon::TextBoxEdit,
                        route: Route::Layer1Form {},
                    },
                    NavItem {
                        label: "NumberInput",
                        icon: MdiIcon::FormatListNumbered,
                        route: Route::NumberInput {},
                    },
                    NavItem {
                        label: "Search",
                        icon: MdiIcon::Magnify,
                        route: Route::Search {},
                    },
                    NavItem {
                        label: "Switch",
                        icon: MdiIcon::ToggleSwitch,
                        route: Route::Layer1Switch {},
                    },
                    NavItem {
                        label: "Feedback",
                        icon: MdiIcon::Alert,
                        route: Route::Layer1Feedback {},
                    },
                    NavItem {
                        label: "Display",
                        icon: MdiIcon::Image,
                        route: Route::Layer1Display {},
                    },
                    NavItem {
                        label: "Avatar",
                        icon: MdiIcon::Account,
                        route: Route::Avatar {},
                    },
                    NavItem {
                        label: "Image",
                        icon: MdiIcon::Image,
                        route: Route::Image {},
                    },
                    NavItem {
                        label: "Tag",
                        icon: MdiIcon::Star,
                        route: Route::Tag {},
                    },
                    NavItem {
                        label: "Empty",
                        icon: MdiIcon::ViewDashboard,
                        route: Route::Empty {},
                    },
                    NavItem {
                        label: "Comment",
                        icon: MdiIcon::Chat,
                        route: Route::Comment {},
                    },
                    NavItem {
                        label: "DescriptionList",
                        icon: MdiIcon::FormatListBulleted,
                        route: Route::DescriptionList {},
                    },
                ],
            },
            // Layer 2 - Composite Components
            NavSubcategory {
                label_en: "Layer 2",
                label_zh: "复合组件",
                route: Some(Route::Layer2Overview {}),
                items: &[
                    NavItem {
                        label: "Navigation",
                        icon: MdiIcon::FormatListBulleted,
                        route: Route::Layer2Navigation {},
                    },
                    NavItem {
                        label: "Collapsible",
                        icon: MdiIcon::ArrowExpandHorizontal,
                        route: Route::Collapsible {},
                    },
                    NavItem {
                        label: "Data",
                        icon: MdiIcon::Graph,
                        route: Route::Layer2Data {},
                    },
                    NavItem {
                        label: "Table",
                        icon: MdiIcon::Table,
                        route: Route::Table {},
                    },
                    NavItem {
                        label: "Tree",
                        icon: MdiIcon::SourceBranch,
                        route: Route::Tree {},
                    },
                    NavItem {
                        label: "Pagination",
                        icon: MdiIcon::ChevronLeft,
                        route: Route::Pagination {},
                    },
                    NavItem {
                        label: "QRCode",
                        icon: MdiIcon::ViewDashboard,
                        route: Route::QRCode {},
                    },
                    NavItem {
                        label: "Timeline",
                        icon: MdiIcon::ChartTimeline,
                        route: Route::Timeline {},
                    },
                    NavItem {
                        label: "Form",
                        icon: MdiIcon::TextBoxEdit,
                        route: Route::Layer2Form {},
                    },
                    NavItem {
                        label: "Cascader",
                        icon: MdiIcon::ChevronDown,
                        route: Route::Cascader {},
                    },
                    NavItem {
                        label: "Transfer",
                        icon: MdiIcon::SwapHorizontal,
                        route: Route::Transfer {},
                    },
                    NavItem {
                        label: "Feedback",
                        icon: MdiIcon::Bell,
                        route: Route::Layer2Feedback {},
                    },
                ],
            },
            // Layer 3 - Production Components
            NavSubcategory {
                label_en: "Layer 3",
                label_zh: "生产级组件",
                route: Some(Route::Layer3Overview {}),
                items: &[
                    NavItem {
                        label: "Media",
                        icon: MdiIcon::Play,
                        route: Route::Layer3Media {},
                    },
                    NavItem {
                        label: "Editor",
                        icon: MdiIcon::FormatBold,
                        route: Route::Layer3Editor {},
                    },
                    NavItem {
                        label: "Visualization",
                        icon: MdiIcon::CubeOutline,
                        route: Route::Layer3Visualization {},
                    },
                    NavItem {
                        label: "UserGuide",
                        icon: MdiIcon::BookOpen,
                        route: Route::UserGuide {},
                    },
                    NavItem {
                        label: "ZoomControls",
                        icon: MdiIcon::MagnifyPlus,
                        route: Route::ZoomControls {},
                    },
                ],
            },
        ],
    },
    NavCategory {
        id: "system",
        title_en: "System",
        title_zh: "系统",
        subcategories: &[
            NavSubcategory {
                label_en: "Overview",
                label_zh: "概览",
                route: Some(Route::SystemOverview {}),
                items: &[],
            },
            NavSubcategory {
                label_en: "CSS Utilities",
                label_zh: "CSS 工具",
                route: Some(Route::SystemCSS {}),
                items: &[],
            },
            NavSubcategory {
                label_en: "Icons",
                label_zh: "图标",
                route: Some(Route::SystemIcons {}),
                items: &[],
            },
            NavSubcategory {
                label_en: "Palette",
                label_zh: "调色板",
                route: Some(Route::SystemPalette {}),
                items: &[],
            },
            NavSubcategory {
                label_en: "Animations",
                label_zh: "动画",
                route: Some(Route::SystemAnimations {}),
                items: &[],
            },
            NavSubcategory {
                label_en: "Animation Demo",
                label_zh: "动画演示",
                route: Some(Route::AnimationDemo {}),
                items: &[],
            },
        ],
    },
    NavCategory {
        id: "demos",
        title_en: "Demos",
        title_zh: "演示",
        subcategories: &[NavSubcategory {
            label_en: "All Demos",
            label_zh: "全部演示",
            route: Some(Route::DemosOverview {}),
            items: &[
                NavItem {
                    label: "Form Demo",
                    icon: MdiIcon::TextBoxEdit,
                    route: Route::FormDemo {},
                },
                NavItem {
                    label: "Dashboard Demo",
                    icon: MdiIcon::ViewColumn,
                    route: Route::DashboardDemo {},
                },
                NavItem {
                    label: "Video Demo",
                    icon: MdiIcon::Play,
                    route: Route::VideoDemo {},
                },
            ],
        }],
    },
];
