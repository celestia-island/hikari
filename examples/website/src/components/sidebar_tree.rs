// website/src/components/sidebar_tree.rs
// Sidebar navigation using Tree component for 3-level structure

use dioxus::prelude::*;

use _components::data::{Tree, TreeNodeData};
use _palette::classes::*;
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
        div {
            class: ClassesBuilder::new()
                .add(Display::Flex)
                .add(AlignItems::Center)
                .add(Gap::Gap3)
                .add(Padding::P6)
                .add(Margin::M0)
                .build(),
            img {
                class: ClassesBuilder::new().add(Width::W8).add(Height::H8).build(),
                src: "/images/logo.png",
                alt: "Hikari Logo",
            }
            div { class: ClassesBuilder::new().add(Display::Flex).add(FlexDirection::Column).build(),
                h1 {
                    class: ClassesBuilder::new()
                        .add(Margin::M0)
                        .add(FontSize::Lg)
                        .add(FontWeight::Semibold)
                        .add(TextColor::Primary)
                        .build(),
                    "Hikari UI"
                }
                span {
                    class: ClassesBuilder::new()
                        .add(FontSize::Xs)
                        .add(TextColor::Secondary)
                        .add(FontWeight::Medium)
                        .build(),
                    "Component Library"
                }
            }
        }

        // Navigation Tree
        div {
            class: ClassesBuilder::new()
                .add(Flex::Flex1)
                .add(OverflowY::Auto)
                .add(OverflowX::Hidden)
                .build(),
            Tree { data: tree_data, on_select: move |_key| {} }
        }

        // Footer
        div { class: ClassesBuilder::new().add(Padding::P4).add(Margin::M0).build(),
            div {
                class: ClassesBuilder::new()
                    .add(Display::Flex)
                    .add(FlexDirection::Column)
                    .add(Gap::Gap2)
                    .build(),
                div {
                    class: ClassesBuilder::new()
                        .add(Display::Flex)
                        .add(AlignItems::Center)
                        .add(Gap::Gap2)
                        .add(FontSize::Xs)
                        .add(TextColor::Secondary)
                        .add(FontWeight::Medium)
                        .build(),
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
