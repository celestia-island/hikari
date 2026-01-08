// website/src/components/sidebar.rs
// Website-specific sidebar using hikari-components Sidebar

use dioxus::prelude::*;
use dioxus_router::components::Link;
use _components::{Sidebar as HikariSidebar, SidebarSection, SidebarItem, SidebarLeaf};
use _icons::Icon;
use _icons::LucideIcon;
use crate::app::Route;

/// Sidebar navigation with 3-level hierarchy
///
/// Uses the generic hikari-components Sidebar component with
/// website-specific navigation data.
#[component]
pub fn Sidebar(current_route: Route) -> Element {
    // Get current route identifier for active state
    let active_id = format!("{:?}", std::mem::discriminant(&current_route));

    rsx! {
        HikariSidebar { active_id,
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

/// Render a category section with its subcategories
#[component]
fn SidebarCategorySection(
    category: &'static NavCategory,
    current_route: Route,
) -> Element {
    rsx! {
        SidebarSection {
            id: category.id.to_string(),
            title: category.title_en.to_string(),
            secondary_title: Some(category.title_zh.to_string()),
            default_expanded: category.id == "components",

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
fn SidebarSubcategoryItem(
    subcategory: &'static NavSubcategory,
    current_route: Route,
) -> Element {
    let has_children = !subcategory.items.is_empty();

    // Check if this subcategory's route matches current route
    let is_active = subcategory.route.as_ref()
        .map(|r| std::mem::discriminant(r) == std::mem::discriminant(&current_route))
        .unwrap_or(false);

    // Create the Link content
    let link_content = rsx!(
        dioxus_router::components::Link {
            to: subcategory.route.clone().unwrap_or(Route::Home {}),
            class: "hi-sidebar-item-content-inner",
            "{subcategory.label_en} "
            span { class: "hi-sidebar-item-zh", "{subcategory.label_zh}" }
        }
    );

    if has_children {
        // Has nested items - use SidebarItem with content and items
        rsx! {
            SidebarItem {
                id: subcategory.label_en.to_string(),
                label: subcategory.label_en.to_string(),
                secondary_label: Some(subcategory.label_zh.to_string()),
                default_expanded: true,
                content: Some(link_content),
                items: Some(rsx! {
                    // Render nested items
                    for item in subcategory.items {
                        SidebarNestedItem {
                            item,
                            current_route: current_route.clone(),
                        }
                    }
                }),
            }
        }
    } else {
        // No children - direct link using SidebarLeaf
        rsx! {
            SidebarLeaf {
                id: subcategory.label_en.to_string(),
                class: if is_active { "active" } else { "" },
                { link_content }
            }
        }
    }
}

/// Render a nested item (Level 3)
#[component]
fn SidebarNestedItem(
    item: &'static NavItem,
    current_route: Route,
) -> Element {
    let is_active = std::mem::discriminant(&item.route) == std::mem::discriminant(&current_route);

    rsx! {
        SidebarLeaf {
            id: format!("{:?}", std::mem::discriminant(&item.route)),
            class: if is_active { "active" } else { "" },

            dioxus_router::components::Link {
                to: item.route.clone(),
                class: "hi-sidebar-item-content-inner",
                Icon {
                    icon: item.icon,
                    size: 16
                }
                span { "{item.label}" }
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
            && self.route.as_ref().map(|r| std::mem::discriminant(r)) == other.route.as_ref().map(|r| std::mem::discriminant(r))
    }
}

#[derive(Clone, Debug)]
pub struct NavItem {
    pub label: &'static str,
    pub icon: LucideIcon,
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
        subcategories: &[
            NavSubcategory {
                label_en: "Home",
                label_zh: "首页",
                route: Some(Route::Home {}),
                items: &[],
            },
        ],
    },
    NavCategory {
        id: "components",
        title_en: "Components",
        title_zh: "组件",
        subcategories: &[
            NavSubcategory {
                label_en: "Layout",
                label_zh: "布局",
                route: Some(Route::ComponentsLayout {}),
                items: &[
                    NavItem { label: "Container", icon: LucideIcon::container, route: Route::LayoutContainer {} },
                    NavItem { label: "Grid", icon: LucideIcon::columns_2, route: Route::LayoutGrid {} },
                    NavItem { label: "Section", icon: LucideIcon::component, route: Route::LayoutSection {} },
                ],
            },
            NavSubcategory {
                label_en: "Basic",
                label_zh: "基础",
                route: Some(Route::ComponentsBasic {}),
                items: &[
                    NavItem { label: "Button", icon: LucideIcon::accessibility, route: Route::BasicButton {} },
                    NavItem { label: "Input", icon: LucideIcon::clipboard_type, route: Route::BasicInput {} },
                    NavItem { label: "Card", icon: LucideIcon::credit_card, route: Route::BasicCard {} },
                    NavItem { label: "Badge", icon: LucideIcon::badge, route: Route::BasicBadge {} },
                ],
            },
            NavSubcategory {
                label_en: "Feedback",
                label_zh: "反馈",
                route: Some(Route::ComponentsFeedback {}),
                items: &[
                    NavItem { label: "Alert", icon: LucideIcon::badge_alert, route: Route::FeedbackAlert {} },
                    NavItem { label: "Toast", icon: LucideIcon::bell, route: Route::FeedbackToast {} },
                    NavItem { label: "Tooltip", icon: LucideIcon::badge_info, route: Route::FeedbackTooltip {} },
                ],
            },
            NavSubcategory {
                label_en: "Navigation",
                label_zh: "导航",
                route: Some(Route::ComponentsNavigation {}),
                items: &[
                    NavItem { label: "Menu", icon: LucideIcon::clipboard_list, route: Route::NavigationMenu {} },
                    NavItem { label: "Breadcrumb", icon: LucideIcon::chevrons_right, route: Route::NavigationBreadcrumb {} },
                    NavItem { label: "Tabs", icon: LucideIcon::credit_card, route: Route::NavigationTabs {} },
                ],
            },
            NavSubcategory {
                label_en: "Data",
                label_zh: "数据",
                route: Some(Route::ComponentsData {}),
                items: &[
                    NavItem { label: "Table", icon: LucideIcon::clipboard_list, route: Route::DataTable {} },
                    NavItem { label: "Tree", icon: LucideIcon::chart_network, route: Route::DataTree {} },
                    NavItem { label: "Pagination", icon: LucideIcon::chevron_left, route: Route::DataPagination {} },
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
        ],
    },
    NavCategory {
        id: "demos",
        title_en: "Demos",
        title_zh: "演示",
        subcategories: &[
            NavSubcategory {
                label_en: "All Demos",
                label_zh: "全部演示",
                route: Some(Route::DemosOverview {}),
                items: &[],
            },
        ],
    },
];
