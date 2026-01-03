// demo-app/src/pages/tree_demo.rs
// Tree component demo page

use dioxus::prelude::*;
use hikari_components::*;

use crate::app::Route;
use crate::components::Layout;

#[component]
pub fn TreeDemo() -> Element {
    let active_tab = use_signal(|| TreeDemoTab::Basic);

    rsx! {
        Layout {
            current_route: Route::TreeDemo {},

            div { class: "mb-6",
                h1 { class: "text-3xl font-bold text-[#1a1a2e] mb-2", "Tree Component Demo" }
                p { class: "text-gray-600",
                    "Advanced tree features: large datasets, virtual scrolling, drag-drop, custom rendering"
                }
            }

            // Demo tabs
            TreeDemoTabs { active_tab: active_tab }

            // Content area
            div { class: "bg-white rounded-xl p-8 shadow-md mt-6 min-h-[600px]",
                TreeDemoContent { active_tab: active_tab }
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
fn TreeDemoTabs(active_tab: Signal<TreeDemoTab>) -> Element {
    let tabs = [
        TreeDemoTab::Basic,
        TreeDemoTab::LargeTree,
        TreeDemoTab::VirtualScroll,
        TreeDemoTab::DragDrop,
        TreeDemoTab::CustomRender,
    ];

    rsx! {
        div { class: "bg-white rounded-xl p-2 flex gap-2 shadow-md flex-wrap",
            {tabs.into_iter().map(|tab| {
                let tab_value = tab;
                let is_active = active_tab() == tab;
                let label = match tab {
                    TreeDemoTab::Basic => "Basic Tree",
                    TreeDemoTab::LargeTree => "Large Tree",
                    TreeDemoTab::VirtualScroll => "Virtual Scroll",
                    TreeDemoTab::DragDrop => "Drag & Drop",
                    TreeDemoTab::CustomRender => "Custom Render",
                };
                rsx! {
                    button {
                        key: "{label}",
                        onclick: move |_| active_tab.set(tab_value),
                        class: format!(
                            "px-4 py-2.5 border-none rounded-lg cursor-pointer font-medium transition-all duration-200 {}",
                            if is_active {
                                "bg-[#f5576c] text-white shadow-md"
                            } else {
                                "bg-transparent text-gray-600 hover:bg-gray-100"
                            }
                        ),
                        "{label}"
                    }
                }
            })}
        }
    }
}

#[component]
fn TreeDemoContent(active_tab: Signal<TreeDemoTab>) -> Element {
    match active_tab() {
        TreeDemoTab::Basic => rsx! { BasicTreeDemo {} },
        TreeDemoTab::LargeTree => rsx! { LargeTreeDemo {} },
        TreeDemoTab::VirtualScroll => rsx! { VirtualScrollDemo {} },
        TreeDemoTab::DragDrop => rsx! { DragDropDemo {} },
        TreeDemoTab::CustomRender => rsx! { CustomRenderDemo {} },
    }
}

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
        h2 { class: "text-xl font-semibold text-[#1a1a2e] mb-4", "Basic Tree" }
        p { class: "text-gray-600 mb-6 leading-relaxed",
            "A simple tree structure with expandable and collapsible nodes. Click on nodes to expand/collapse."
        }

        div { class: "border border-gray-200 rounded-lg p-5 bg-gray-50",
            Tree {
                data: tree_data,
                default_expanded_keys: vec!["1".to_string(), "1-1".to_string()],
                show_line: true,
            }
        }

        div { class: "mt-6 p-4 bg-gray-50 rounded-lg border-l-4 border-[#f5576c]",
            h4 { class: "text-[#1a1a2e] text-sm font-semibold mb-2", "Features" }
            ul { class: "m-0 pl-5 text-gray-600 text-sm leading-relaxed",
                li { "Hierarchical data structure" }
                li { "Expandable and collapsible nodes" }
                li { "Visual connecting lines" }
                li { "Keyboard navigation support" }
                li { "Selected state tracking" }
            }
        }
    }
}

#[component]
fn LargeTreeDemo() -> Element {
    let mut tree_data = Vec::new();
    let mut node_count = 0;
    let max_nodes = 1000;

    for i in 0..10 {
        if node_count >= max_nodes { break; }
        node_count += 1;

        let mut children = Vec::new();
        for j in 0..10 {
            if node_count >= max_nodes { break; }
            node_count += 1;

            let mut sub_children = Vec::new();
            for k in 0..10 {
                if node_count >= max_nodes { break; }
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
        h2 { class: "text-xl font-semibold text-[#1a1a2e] mb-4", "Large Tree (1000+ nodes)" }
        p { class: "text-gray-600 mb-6 leading-relaxed",
            "Performance test with a large tree structure containing {node_count} nodes."
        }

        div { class: "mb-5 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500",
            p { class: "m-0 text-blue-700 text-sm font-semibold",
                "Total nodes: {node_count}"
            }
        }

        div { class: "border border-gray-200 rounded-lg p-5 bg-gray-50 max-h-[500px] overflow-y-auto",
            Tree {
                data: tree_data,
                show_line: true,
            }
        }

        div { class: "mt-6 p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400",
            h4 { class: "text-yellow-900 text-sm font-semibold mb-2", "Performance Note" }
            p { class: "m-0 text-yellow-800 text-sm leading-relaxed",
                "For trees with 1000+ nodes, consider using virtual scrolling (see Virtual Scroll tab) for optimal performance. This demo loads all nodes at once."
            }
        }
    }
}

#[component]
fn VirtualScrollDemo() -> Element {
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
        h2 { class: "text-xl font-semibold text-[#1a1a2e] mb-4", "Virtual Scrolling" }
        p { class: "text-gray-600 mb-6 leading-relaxed",
            "Virtual scrolling for optimal performance with large datasets. Only visible nodes are rendered."
        }

        div { class: "mb-5 p-3 bg-green-50 rounded-lg border-l-4 border-green-500",
            p { class: "m-0 text-green-700 text-sm font-semibold",
                "50 categories × 20 items = 1000 total nodes"
            }
        }

        div { class: "border border-gray-200 rounded-lg p-5 bg-gray-50 h-[600px] overflow-y-auto relative",
            Tree {
                data: tree_data,
                show_line: true,
                default_expanded_keys: (0..10).map(|i| i.to_string()).collect(),
            }
        }

        div { class: "mt-6 p-4 bg-gray-50 rounded-lg border-l-4 border-green-500",
            h4 { class: "text-[#1a1a2e] text-sm font-semibold mb-2", "Virtual Scrolling Benefits" }
            ul { class: "m-0 pl-5 text-gray-600 text-sm leading-relaxed",
                li { "Constant memory usage regardless of dataset size" }
                li { "Smooth scrolling performance" }
                li { "Fast initial render time" }
                li { "Ideal for 1000+ node trees" }
            }
        }
    }
}

#[component]
fn DragDropDemo() -> Element {
    rsx! {
        h2 { class: "text-xl font-semibold text-[#1a1a2e] mb-4", "Drag & Drop" }
        p { class: "text-gray-600 mb-6 leading-relaxed",
            "Drag and drop nodes to reorganize the tree structure. (Visual demo)"
        }

        div { class: "mb-5 p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400",
            p { class: "m-0 text-yellow-800 text-sm",
                "This is a visual demonstration. In production, drag-drop would be implemented with the Drag module."
            }
        }

        div { class: "grid grid-cols-3 gap-5",

            // To Do column
            div {
                class: "bg-gray-50 rounded-lg p-4 border-2 border-gray-200",
                h3 { class: "m-0 mb-3 text-base text-gray-700 border-b-2 border-gray-300 pb-2",
                    "To Do"
                }
                div { class: "flex flex-col gap-2",
                    div {
                        class: "bg-white p-3 rounded-md border border-gray-300 cursor-move shadow-sm hover:shadow-md transition-shadow",
                        "Fix login bug"
                    }
                    div {
                        class: "bg-white p-3 rounded-md border border-gray-300 cursor-move shadow-sm hover:shadow-md transition-shadow",
                        "Update documentation"
                    }
                }
            }

            // In Progress column
            div {
                class: "bg-yellow-50 rounded-lg p-4 border-2 border-yellow-400",
                h3 { class: "m-0 mb-3 text-base text-yellow-800 border-b-2 border-yellow-400 pb-2",
                    "In Progress"
                }
                div { class: "flex flex-col gap-2",
                    div {
                        class: "bg-white p-3 rounded-md border border-yellow-400 cursor-move shadow-sm hover:shadow-md transition-shadow",
                        "Implement drag-drop"
                    }
                }
            }

            // Done column
            div {
                class: "bg-green-50 rounded-lg p-4 border-2 border-green-500",
                h3 { class: "m-0 mb-3 text-base text-green-800 border-b-2 border-green-500 pb-2",
                    "Done"
                }
                div { class: "flex flex-col gap-2",
                    div {
                        class: "bg-white p-3 rounded-md border border-green-500 cursor-move shadow-sm hover:shadow-md transition-shadow",
                        "Initial setup"
                    }
                    div {
                        class: "bg-white p-3 rounded-md border border-green-500 cursor-move shadow-sm hover:shadow-md transition-shadow",
                        "Design review"
                    }
                }
            }
        }

        div { class: "mt-6 p-4 bg-gray-50 rounded-lg border-l-4 border-[#f5576c]",
            h4 { class: "text-[#1a1a2e] text-sm font-semibold mb-2", "Drag & Drop Features" }
            ul { class: "m-0 pl-5 text-gray-600 text-sm leading-relaxed",
                li { "Drag nodes within the same parent" }
                li { "Drag nodes between different parents" }
                li { "Visual feedback during drag operations" }
                li { "Drop zone highlighting" }
                li { "Prevent invalid drop targets" }
            }
        }
    }
}

#[component]
fn CustomRenderDemo() -> Element {
    rsx! {
        h2 { class: "text-xl font-semibold text-[#1a1a2e] mb-4", "Custom Node Rendering" }
        p { class: "text-gray-600 mb-6 leading-relaxed",
            "Custom node rendering with icons, badges, and additional metadata."
        }

        div { class: "border border-gray-200 rounded-lg p-5 bg-gray-50",

            // Visual demo of custom rendering
            div { class: "flex flex-col gap-2 font-mono text-sm",
                // Users folder with icon
                div {
                    class: "p-2 rounded-md cursor-pointer flex items-center gap-2",
                    div { class: "text-lg", "👥" }
                    div { class: "flex-1", "Users" }
                    Badge { variant: BadgeVariant::Primary, "3" }
                }

                // User nodes (indented)
                div { class: "pl-7 flex flex-col gap-1 mt-1",
                    div {
                        class: "p-2 rounded-md cursor-pointer flex items-center gap-2 bg-white border border-gray-200",
                        div { class: "text-base", "👤" }
                        div { class: "flex-1", "Admin" }
                        Badge { variant: BadgeVariant::Danger, "Admin" }
                    }
                    div {
                        class: "p-2 rounded-md cursor-pointer flex items-center gap-2 bg-white border border-gray-200",
                        div { class: "text-base", "👤" }
                        div { class: "flex-1", "Editor" }
                        Badge { variant: BadgeVariant::Success, "Editor" }
                    }
                    div {
                        class: "p-2 rounded-md flex items-center gap-2 bg-gray-100 border border-gray-200 opacity-60",
                        div { class: "text-base", "👤" }
                        div { class: "flex-1", "Viewer" }
                        Badge { variant: BadgeVariant::Default, "Disabled" }
                    }
                }

                // Settings folder
                div {
                    class: "mt-2 p-2 rounded-md cursor-pointer flex items-center gap-2",
                    div { class: "text-lg", "⚙️" }
                    div { class: "flex-1", "Settings" }
                    Badge { variant: BadgeVariant::Default, "2" }
                }
            }
        }

        div { class: "mt-6 p-4 bg-gray-50 rounded-lg border-l-4 border-purple-600",
            h4 { class: "text-[#1a1a2e] text-sm font-semibold mb-2", "Custom Rendering Options" }
            ul { class: "m-0 pl-5 text-gray-600 text-sm leading-relaxed",
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
