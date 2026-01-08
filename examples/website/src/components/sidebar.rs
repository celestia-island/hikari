// website/src/components/sidebar.rs
// Sidebar navigation using Tree component for 3-level structure

use dioxus::prelude::*;

use _components::data::{Tree, TreeNodeData};
use crate::app::Route;

/// Sidebar component with 3-level Tree navigation
///
/// Structure:
/// - Level 1: Overview, Components, System, Demos
/// - Level 2: Categories (Layout Components, Basic Components, etc.)
/// - Level 3: Individual components (Button, Input, Card, etc.)
#[component]
pub fn Sidebar(current_route: Route) -> Element {
    // Build 3-level tree data
    let tree_data = build_navigation_tree();

    rsx! {
        // Logo and title
        div { class: "sidebar-header",
            img {
                class: "sidebar-logo",
                src: "/images/logo.png",
                alt: "Hikari Logo",
            }
            div { class: "sidebar-title-group",
                h1 { class: "sidebar-title", "Hikari UI" }
                span { class: "sidebar-subtitle", "Component Library" }
            }
        }

        // Navigation Tree
        div { class: "sidebar-nav",
            Tree {
                data: tree_data,
                on_select: move |key: String| {
                    if let Some(route) = map_key_to_route(&key) {
                        // Use Link navigation instead of push
                        // The router will handle navigation automatically
                        dioxus_router::router().push(route);
                    }
                },
            }
        }

        // Footer
        div { class: "sidebar-footer",
            div { class: "sidebar-footer-content",
                div { class: "sidebar-footer-text",
                    span { "🔗" }
                    span { "Version 0.1.0" }
                }
            }
        }
    }
}

/// Build 3-level navigation tree data
fn build_navigation_tree() -> Vec<TreeNodeData> {
    vec![
        // Overview
        TreeNodeData {
            key: "overview".to_string(),
            label: "Overview".to_string(),
            children: Some(vec![TreeNodeData {
                key: "home".to_string(),
                label: "Home".to_string(),
                children: None,
                disabled: false,
            }]),
            disabled: false,
        },
        // Components - Top level
        TreeNodeData {
            key: "components".to_string(),
            label: "Components".to_string(),
            children: Some(vec![
                // Layout Components category
                TreeNodeData {
                    key: "components-layout".to_string(),
                    label: "布局组件 Layout".to_string(),
                    children: Some(vec![
                        TreeNodeData {
                            key: "layout-overview".to_string(),
                            label: "概览 Overview".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "layout-container".to_string(),
                            label: "Container 容器".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "layout-grid".to_string(),
                            label: "Grid 网格".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "layout-section".to_string(),
                            label: "Section 分区".to_string(),
                            children: None,
                            disabled: false,
                        },
                    ]),
                    disabled: false,
                },
                // Basic Components category
                TreeNodeData {
                    key: "components-basic".to_string(),
                    label: "基础组件 Basic".to_string(),
                    children: Some(vec![
                        TreeNodeData {
                            key: "basic-overview".to_string(),
                            label: "概览 Overview".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "basic-button".to_string(),
                            label: "Button 按钮".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "basic-input".to_string(),
                            label: "Input 输入框".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "basic-card".to_string(),
                            label: "Card 卡片".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "basic-badge".to_string(),
                            label: "Badge 徽章".to_string(),
                            children: None,
                            disabled: false,
                        },
                    ]),
                    disabled: false,
                },
                // Feedback Components category
                TreeNodeData {
                    key: "components-feedback".to_string(),
                    label: "反馈组件 Feedback".to_string(),
                    children: Some(vec![
                        TreeNodeData {
                            key: "feedback-overview".to_string(),
                            label: "概览 Overview".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "feedback-alert".to_string(),
                            label: "Alert 警告".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "feedback-toast".to_string(),
                            label: "Toast 提示".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "feedback-tooltip".to_string(),
                            label: "Tooltip 文字提示".to_string(),
                            children: None,
                            disabled: false,
                        },
                    ]),
                    disabled: false,
                },
                // Navigation Components category
                TreeNodeData {
                    key: "components-navigation".to_string(),
                    label: "导航组件 Navigation".to_string(),
                    children: Some(vec![
                        TreeNodeData {
                            key: "navigation-overview".to_string(),
                            label: "概览 Overview".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "navigation-menu".to_string(),
                            label: "Menu 菜单".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "navigation-breadcrumb".to_string(),
                            label: "Breadcrumb 面包屑".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "navigation-tabs".to_string(),
                            label: "Tabs 标签页".to_string(),
                            children: None,
                            disabled: false,
                        },
                    ]),
                    disabled: false,
                },
                // Data Components category
                TreeNodeData {
                    key: "components-data".to_string(),
                    label: "数据组件 Data".to_string(),
                    children: Some(vec![
                        TreeNodeData {
                            key: "data-overview".to_string(),
                            label: "概览 Overview".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "data-table".to_string(),
                            label: "Table 表格".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "data-tree".to_string(),
                            label: "Tree 树形控件".to_string(),
                            children: None,
                            disabled: false,
                        },
                        TreeNodeData {
                            key: "data-list".to_string(),
                            label: "List 列表".to_string(),
                            children: None,
                            disabled: false,
                        },
                    ]),
                    disabled: false,
                },
            ]),
            disabled: false,
        },
        // System
        TreeNodeData {
            key: "system".to_string(),
            label: "System".to_string(),
            children: Some(vec![
                TreeNodeData {
                    key: "system-overview".to_string(),
                    label: "All Systems".to_string(),
                    children: None,
                    disabled: false,
                },
                TreeNodeData {
                    key: "system-css".to_string(),
                    label: "CSS Utilities".to_string(),
                    children: None,
                    disabled: false,
                },
                TreeNodeData {
                    key: "system-icons".to_string(),
                    label: "Icons".to_string(),
                    children: None,
                    disabled: false,
                },
                TreeNodeData {
                    key: "system-palette".to_string(),
                    label: "Palette".to_string(),
                    children: None,
                    disabled: false,
                },
                TreeNodeData {
                    key: "system-animations".to_string(),
                    label: "Animations".to_string(),
                    children: None,
                    disabled: false,
                },
            ]),
            disabled: false,
        },
        // Demos
        TreeNodeData {
            key: "demos".to_string(),
            label: "Demos".to_string(),
            children: Some(vec![TreeNodeData {
                key: "demos-overview".to_string(),
                label: "All Demos".to_string(),
                children: None,
                disabled: false,
            }]),
            disabled: false,
        },
    ]
}

/// Map tree node key to Route enum
fn map_key_to_route(key: &str) -> Option<Route> {
    match key {
        // Home
        "home" => Some(Route::Home {}),

        // Components category pages (Level 2)
        "layout-overview" => Some(Route::ComponentsLayout {}),
        "basic-overview" => Some(Route::ComponentsBasic {}),
        "feedback-overview" => Some(Route::ComponentsFeedback {}),
        "navigation-overview" => Some(Route::ComponentsNavigation {}),
        "data-overview" => Some(Route::ComponentsData {}),

        // Layout components (Level 3)
        "layout-container" => Some(Route::LayoutContainer {}),
        "layout-grid" => Some(Route::LayoutGrid {}),
        "layout-section" => Some(Route::LayoutSection {}),

        // Basic components (Level 3)
        "basic-button" => Some(Route::BasicButton {}),
        "basic-input" => Some(Route::BasicInput {}),
        "basic-card" => Some(Route::BasicCard {}),
        "basic-badge" => Some(Route::BasicBadge {}),

        // Feedback components (Level 3)
        "feedback-alert" => Some(Route::FeedbackAlert {}),
        "feedback-toast" => Some(Route::FeedbackToast {}),
        "feedback-tooltip" => Some(Route::FeedbackTooltip {}),

        // Navigation components (Level 3)
        "navigation-menu" => Some(Route::NavigationMenu {}),
        "navigation-breadcrumb" => Some(Route::NavigationBreadcrumb {}),
        "navigation-tabs" => Some(Route::NavigationTabs {}),

        // Data components (Level 3)
        "data-table" => Some(Route::DataTable {}),
        "data-tree" => Some(Route::DataTree {}),
        "data-list" => Some(Route::DataPagination {}), // Using pagination route

        // System pages
        "system-overview" => Some(Route::SystemOverview {}),
        "system-css" => Some(Route::SystemCSS {}),
        "system-icons" => Some(Route::SystemIcons {}),
        "system-palette" => Some(Route::SystemPalette {}),
        "system-animations" => Some(Route::SystemAnimations {}),

        // Demos
        "demos-overview" => Some(Route::DemosOverview {}),

        // Parent nodes (no route, just expand/collapse)
        "overview"
        | "components"
        | "components-layout"
        | "components-basic"
        | "components-feedback"
        | "components-navigation"
        | "components-data"
        | "system"
        | "demos" => None,

        _ => None,
    }
}

/// Convert Route to URL path
fn route_to_path(route: &Route) -> String {
    match route {
        Route::Home {} => "/".to_string(),
        Route::ComponentsOverview {} => "/components".to_string(),
        Route::ComponentsLayout {} => "/components/layout".to_string(),
        Route::LayoutContainer {} => "/components/layout/container".to_string(),
        Route::LayoutGrid {} => "/components/layout/grid".to_string(),
        Route::LayoutSection {} => "/components/layout/section".to_string(),
        Route::ComponentsBasic {} => "/components/basic".to_string(),
        Route::BasicButton {} => "/components/basic/button".to_string(),
        Route::BasicInput {} => "/components/basic/input".to_string(),
        Route::BasicCard {} => "/components/basic/card".to_string(),
        Route::BasicBadge {} => "/components/basic/badge".to_string(),
        Route::ComponentsFeedback {} => "/components/feedback".to_string(),
        Route::FeedbackAlert {} => "/components/feedback/alert".to_string(),
        Route::FeedbackToast {} => "/components/feedback/toast".to_string(),
        Route::FeedbackTooltip {} => "/components/feedback/tooltip".to_string(),
        Route::ComponentsNavigation {} => "/components/navigation".to_string(),
        Route::NavigationMenu {} => "/components/navigation/menu".to_string(),
        Route::NavigationTabs {} => "/components/navigation/tabs".to_string(),
        Route::NavigationBreadcrumb {} => "/components/navigation/breadcrumb".to_string(),
        Route::ComponentsData {} => "/components/data".to_string(),
        Route::DataTable {} => "/components/data/table".to_string(),
        Route::DataTree {} => "/components/data/tree".to_string(),
        Route::DataPagination {} => "/components/data/pagination".to_string(),
        Route::SystemOverview {} => "/system".to_string(),
        Route::SystemCSS {} => "/system/css".to_string(),
        Route::SystemIcons {} => "/system/icons".to_string(),
        Route::SystemPalette {} => "/system/palette".to_string(),
        Route::SystemAnimations {} => "/system/animations".to_string(),
        Route::DemosOverview {} => "/demos".to_string(),
    }
}
