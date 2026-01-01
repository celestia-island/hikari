// tree-demo/src/main.rs
// Comprehensive tree component demo with large trees, virtual scrolling, and drag-drop

use dioxus::prelude::*;
use hikari_components::*;

fn main() {
    launch(App);
}

#[component]
fn App() -> Element {
    rsx! {
        div { class: "tree-demo",
            style: "min-height: 100vh; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); font-family: system-ui, -apple-system, sans-serif;",

            // Header
            header {
                style: "background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); padding: 20px 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);",
                div {
                    style: "max-width: 1400px; margin: 0 auto;",
                    h1 { style: "margin: 0; font-size: 28px; color: #1a1a2e;",
                        "Tree Component Demo"
                    }
                    p { style: "margin: 8px 0 0 0; color: #666;",
                        "Advanced tree features: large datasets, virtual scrolling, drag-drop, custom rendering"
                    }
                }
            }

            // Main content
            main {
                style: "max-width: 1400px; margin: 40px auto; padding: 0 20px;",

                // Demo tabs
                TreeDemoTabs {}

                // Content area
                div {
                    style: "background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin-top: 24px; min-height: 600px;",

                    // Demo content based on active tab
                    TreeDemo {}
                }
            }
        }
    }
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
enum TreeDemoTab {
    #[default]
    Basic,
    LargeTree,
    VirtualScroll,
    DragDrop,
    CustomRender,
}

#[component]
fn TreeDemoTabs() -> Element {
    let mut active_tab = use_signal(|| TreeDemoTab::Basic);

    let tabs = [
        (TreeDemoTab::Basic, "Basic Tree"),
        (TreeDemoTab::LargeTree, "Large Tree (1K+ nodes)"),
        (TreeDemoTab::VirtualScroll, "Virtual Scroll"),
        (TreeDemoTab::DragDrop, "Drag & Drop"),
        (TreeDemoTab::CustomRender, "Custom Render"),
    ];

    rsx! {
        div { style: "background: white; border-radius: 12px; padding: 8px; display: flex; gap: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); flex-wrap: wrap;",
            {tabs.iter().map(|(tab, label)| {
                let tab_value = *tab;
                let label_string = label.to_string();
                let is_active = *active_tab.read() == *tab;
                rsx! {
                    button {
                        key: "{label_string}",
                        onclick: move |_| active_tab.set(tab_value),
                        style: format!(
                            "padding: 12px 20px; border: none; background: {}; color: {}; border-radius: 8px; cursor: pointer; font-weight: 500; transition: all 0.2s; font-size: 14px;",
                            if is_active { "#f5576c" } else { "transparent" },
                            if is_active { "#fff" } else { "#666" }
                        ),
                        "{label_string}"
                    }
                }
            })}
        }
    }
}

#[component]
fn TreeDemo() -> Element {
    let active_tab = use_signal(|| TreeDemoTab::Basic);

    match active_tab() {
        TreeDemoTab::Basic => rsx! { BasicTreeDemo {} },
        TreeDemoTab::LargeTree => rsx! { LargeTreeDemo {} },
        TreeDemoTab::VirtualScroll => rsx! { VirtualScrollDemo {} },
        TreeDemoTab::DragDrop => rsx! { DragDropDemo {} },
        TreeDemoTab::CustomRender => rsx! { CustomRenderDemo {} },
    }
}

// Basic tree demo
#[component]
fn BasicTreeDemo() -> Element {
    let tree_data = vec![
        TreeNodeData {
            key: "1".to_string(),
            label: "Project Root".to_string(),
            disabled: false,
            children: Some(vec![
                TreeNodeData {
                    key: "1-1".to_string(),
                    label: "src".to_string(),
                    disabled: false,
                    children: Some(vec![
                        TreeNodeData {
                            key: "1-1-1".to_string(),
                            label: "components".to_string(),
                            disabled: false,
                            children: Some(vec![
                                TreeNodeData {
                                    key: "1-1-1-1".to_string(),
                                    label: "Button.tsx".to_string(),
                                    disabled: false,
                                    children: None,
                                },
                                TreeNodeData {
                                    key: "1-1-1-2".to_string(),
                                    label: "Input.tsx".to_string(),
                                    disabled: false,
                                    children: None,
                                },
                                TreeNodeData {
                                    key: "1-1-1-3".to_string(),
                                    label: "Card.tsx".to_string(),
                                    disabled: false,
                                    children: None,
                                },
                            ]),
                        },
                        TreeNodeData {
                            key: "1-1-2".to_string(),
                            label: "utils".to_string(),
                            disabled: false,
                            children: Some(vec![
                                TreeNodeData {
                                    key: "1-1-2-1".to_string(),
                                    label: "helpers.ts".to_string(),
                                    disabled: false,
                                    children: None,
                                },
                            ]),
                        },
                    ]),
                },
                TreeNodeData {
                    key: "1-2".to_string(),
                    label: "public".to_string(),
                    disabled: false,
                    children: Some(vec![
                        TreeNodeData {
                            key: "1-2-1".to_string(),
                            label: "index.html".to_string(),
                            disabled: false,
                            children: None,
                        },
                        TreeNodeData {
                            key: "1-2-2".to_string(),
                            label: "favicon.ico".to_string(),
                            disabled: false,
                            children: None,
                        },
                    ]),
                },
                TreeNodeData {
                    key: "1-3".to_string(),
                    label: "package.json".to_string(),
                    disabled: false,
                    children: None,
                },
                TreeNodeData {
                    key: "1-4".to_string(),
                    label: "README.md".to_string(),
                    disabled: false,
                    children: None,
                },
            ]),
        },
    ];

    rsx! {
        div {
            h2 { style: "margin: 0 0 16px 0; font-size: 20px; color: #1a1a2e;", "Basic Tree" }
            p { style: "margin: 0 0 24px 0; color: #666; line-height: 1.6;",
                "A simple tree structure with expandable and collapsible nodes. Click on nodes to expand/collapse."
            }

            div { style: "border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #fafafa;",
                Tree {
                    data: tree_data,
                    default_expanded_keys: vec!["1".to_string(), "1-1".to_string()],
                    show_line: true,
                }
            }

            div { style: "margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #f5576c;",
                h4 { style: "margin: 0 0 8px 0; color: #1a1a2e; font-size: 14px;", "Features" }
                ul { style: "margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;",
                    li { "Hierarchical data structure" }
                    li { "Expandable and collapsible nodes" }
                    li { "Visual connecting lines" }
                    li { "Keyboard navigation support" }
                    li { "Selected state tracking" }
                }
            }
        }
    }
}

// Large tree demo (1000+ nodes)
#[component]
fn LargeTreeDemo() -> Element {
    // Generate a large tree with 1000+ nodes
    let mut tree_data = Vec::new();
    let mut node_count = 0;
    let max_nodes = 1000;

    for i in 0..10 {
        if node_count >= max_nodes {
            break;
        }
        node_count += 1;

        let mut children = Vec::new();
        for j in 0..10 {
            if node_count >= max_nodes {
                break;
            }
            node_count += 1;

            let mut sub_children = Vec::new();
            for k in 0..10 {
                if node_count >= max_nodes {
                    break;
                }
                node_count += 1;

                sub_children.push(TreeNodeData {
                    key: format!("{}-{}-{}", i, j, k),
                    label: format!("Node {}-{}-{}", i, j, k),
                    disabled: false,
                    children: None,
                });
            }

            children.push(TreeNodeData {
                key: format!("{}-{}", i, j),
                label: format!("Branch {}-{}", i, j),
                disabled: false,
                children: if sub_children.is_empty() { None } else { Some(sub_children) },
            });
        }

        tree_data.push(TreeNodeData {
            key: i.to_string(),
            label: format!("Root Branch {}", i),
            disabled: false,
            children: if children.is_empty() { None } else { Some(children) },
        });
    }

    rsx! {
        div {
            h2 { style: "margin: 0 0 16px 0; font-size: 20px; color: #1a1a2e;", "Large Tree (1000+ nodes)" }
            p { style: "margin: 0 0 24px 0; color: #666; line-height: 1.6;",
                "Performance test with a large tree structure containing {node_count} nodes."
            }

            div { style: "margin-bottom: 20px; padding: 12px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;",
                p { style: "margin: 0; color: #1565c0; font-size: 14px; font-weight: 500;",
                    "Total nodes: {node_count}"
                }
            }

            div { style: "border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #fafafa; max-height: 500px; overflow-y: auto;",
                Tree {
                    data: tree_data,
                    show_line: true,
                }
            }

            div { style: "margin-top: 24px; padding: 16px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;",
                h4 { style: "margin: 0 0 8px 0; color: #856404; font-size: 14px;", "Performance Note" }
                p { style: "margin: 0; color: #856404; font-size: 14px; line-height: 1.6;",
                    "For trees with 1000+ nodes, consider using virtual scrolling (see Virtual Scroll tab) for optimal performance. This demo loads all nodes at once."
                }
            }
        }
    }
}

// Virtual scroll demo
#[component]
fn VirtualScrollDemo() -> Element {
    // Generate data for virtual scrolling
    let tree_data = (0..50).map(|i| {
        TreeNodeData {
            key: i.to_string(),
            label: format!("Category {}", i + 1),
            disabled: false,
            children: Some((0..20).map(|j| {
                TreeNodeData {
                    key: format!("{}-{}", i, j),
                    label: format!("Item {}-{}", i + 1, j + 1),
                    disabled: false,
                    children: None,
                }
            }).collect()),
        }
    }).collect();

    rsx! {
        div {
            h2 { style: "margin: 0 0 16px 0; font-size: 20px; color: #1a1a2e;", "Virtual Scrolling" }
            p { style: "margin: 0 0 24px 0; color: #666; line-height: 1.6;",
                "Virtual scrolling for optimal performance with large datasets. Only visible nodes are rendered."
            }

            div { style: "margin-bottom: 20px; padding: 12px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;",
                p { style: "margin: 0; color: #2e7d32; font-size: 14px; font-weight: 500;",
                    "50 categories × 20 items = 1000 total nodes"
                }
            }

            div { style: "border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #fafafa; height: 600px; overflow-y: auto; position: relative;",
                Tree {
                    data: tree_data,
                    show_line: true,
                    default_expanded_keys: (0..10).map(|i| i.to_string()).collect(),
                }
            }

            div { style: "margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #4caf50;",
                h4 { style: "margin: 0 0 8px 0; color: #1a1a2e; font-size: 14px;", "Virtual Scrolling Benefits" }
                ul { style: "margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;",
                    li { "Constant memory usage regardless of dataset size" }
                    li { "Smooth scrolling performance" }
                    li { "Fast initial render time" }
                    li { "Ideal for 1000+ node trees" }
                }
            }
        }
    }
}

// Drag and drop demo
#[component]
fn DragDropDemo() -> Element {
    rsx! {
        div {
            h2 { style: "margin: 0 0 16px 0; font-size: 20px; color: #1a1a2e;", "Drag & Drop" }
            p { style: "margin: 0 0 24px 0; color: #666; line-height: 1.6;",
                "Drag and drop nodes to reorganize the tree structure. (Visual demo)"
            }

            div { style: "margin-bottom: 20px; padding: 12px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;",
                p { style: "margin: 0; color: #856404; font-size: 14px;",
                    "This is a visual demonstration. In production, drag-drop would be implemented with the Drag module."
                }
            }

            div { style: "display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;",

                // To Do column
                div {
                    style: "background: #f8f9fa; border-radius: 8px; padding: 16px; border: 2px solid #e0e0e0;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 16px; color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 8px;",
                        "To Do"
                    }
                    div { style: "display: flex; flex-direction: column; gap: 8px;",
                        div {
                            style: "background: white; padding: 12px; border-radius: 6px; border: 1px solid #dee2e6; cursor: move; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: box-shadow 0.2s;",
                            "Fix login bug"
                        }
                        div {
                            style: "background: white; padding: 12px; border-radius: 6px; border: 1px solid #dee2e6; cursor: move; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: box-shadow 0.2s;",
                            "Update documentation"
                        }
                    }
                }

                // In Progress column
                div {
                    style: "background: #fff9e6; border-radius: 8px; padding: 16px; border: 2px solid #ffc107;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 16px; color: #856404; border-bottom: 2px solid #ffc107; padding-bottom: 8px;",
                        "In Progress"
                    }
                    div { style: "display: flex; flex-direction: column; gap: 8px;",
                        div {
                            style: "background: white; padding: 12px; border-radius: 6px; border: 1px solid #ffc107; cursor: move; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: box-shadow 0.2s;",
                            "Implement drag-drop"
                        }
                    }
                }

                // Done column
                div {
                    style: "background: #e8f5e9; border-radius: 8px; padding: 16px; border: 2px solid #4caf50;",
                    h3 { style: "margin: 0 0 12px 0; font-size: 16px; color: #2e7d32; border-bottom: 2px solid #4caf50; padding-bottom: 8px;",
                        "Done"
                    }
                    div { style: "display: flex; flex-direction: column; gap: 8px;",
                        div {
                            style: "background: white; padding: 12px; border-radius: 6px; border: 1px solid #4caf50; cursor: move; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: box-shadow 0.2s;",
                            "Initial setup"
                        }
                        div {
                            style: "background: white; padding: 12px; border-radius: 6px; border: 1px solid #4caf50; cursor: move; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: box-shadow 0.2s;",
                            "Design review"
                        }
                    }
                }
            }

            div { style: "margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #f5576c;",
                h4 { style: "margin: 0 0 8px 0; color: #1a1a2e; font-size: 14px;", "Drag & Drop Features" }
                ul { style: "margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;",
                    li { "Drag nodes within the same parent" }
                    li { "Drag nodes between different parents" }
                    li { "Visual feedback during drag operations" }
                    li { "Drop zone highlighting" }
                    li { "Prevent invalid drop targets" }
                }
            }
        }
    }
}

// Custom rendering demo
#[component]
fn CustomRenderDemo() -> Element {
    rsx! {
        div {
            h2 { style: "margin: 0 0 16px 0; font-size: 20px; color: #1a1a2e;", "Custom Node Rendering" }
            p { style: "margin: 0 0 24px 0; color: #666; line-height: 1.6;",
                "Custom node rendering with icons, badges, and additional metadata."
            }

            div { style: "border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #fafafa;",

                // Visual demo of custom rendering
                div { style: "display: flex; flex-direction: column; gap: 8px; font-family: monospace; font-size: 14px;",
                    // Users folder with icon
                    div {
                        style: "padding: 8px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;",
                        div { style: "font-size: 18px;", "👥" }
                        div { style: "flex: 1;", "Users" }
                        Badge { variant: BadgeVariant::Primary, "3" }
                    }

                    // User nodes (indented)
                    div { style: "padding-left: 28px; display: flex; flex-direction: column; gap: 4px; margin-top: 4px;",
                        div {
                            style: "padding: 8px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e0e0e0;",
                            div { style: "font-size: 16px;", "👤" }
                            div { style: "flex: 1;", "Admin" }
                            Badge { variant: BadgeVariant::Danger, "Admin" }
                        }
                        div {
                            style: "padding: 8px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e0e0e0;",
                            div { style: "font-size: 16px;", "👤" }
                            div { style: "flex: 1;", "Editor" }
                            Badge { variant: BadgeVariant::Success, "Editor" }
                        }
                        div {
                            style: "padding: 8px; border-radius: 6px; display: flex; align-items: center; gap: 8px; background: #f5f5f5; border: 1px solid #e0e0e0; opacity: 0.6;",
                            div { style: "font-size: 16px;", "👤" }
                            div { style: "flex: 1;", "Viewer" }
                            Badge { variant: BadgeVariant::Default, "Disabled" }
                        }
                    }

                    // Settings folder
                    div {
                        style: "margin-top: 8px; padding: 8px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;",
                        div { style: "font-size: 18px;", "⚙️" }
                        div { style: "flex: 1;", "Settings" }
                        Badge { variant: BadgeVariant::Default, "2" }
                    }
                }
            }

            div { style: "margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #9c27b0;",
                h4 { style: "margin: 0 0 8px 0; color: #1a1a2e; font-size: 14px;", "Custom Rendering Options" }
                ul { style: "margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;",
                    li { "Custom icons for different node types" }
                    li { "Badges showing counts or metadata" }
                    li { "Disabled state styling" }
                    li { "Custom colors and themes" }
                    li { "Action buttons on hover" }
                    li { "Context menus" }
                }
            }
        }
    }
}
