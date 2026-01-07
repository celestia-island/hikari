// demo-app/src/pages/components/data.rs
// Data components demonstration page with FUI styling

extern crate components as hikari_components;

use dioxus::prelude::*;
use hikari_components::{
    Table, ColumnDef, ColumnAlign, Tree, TreeNode, Pagination,
    Button, ButtonVariant, ButtonSize, Card,
    layout::{Container, Grid, Row, Section}
};

use crate::{app::Route, components::Layout};

#[component]
pub fn ComponentsData() -> Element {
    // Table data - Arknights operators
    let columns = vec![
        components::table::ColumnDef::new("name", "Operator Name").sortable(true),
        components::table::ColumnDef::new("class", "Class"),
        components::table::ColumnDef::new("rarity", "Rarity").align(components::ColumnAlign::Center),
        components::table::ColumnDef::new("level", "Level").align(components::ColumnAlign::Center),
    ];

    let data = vec![
        vec!["Amiya".to_string(), "Guard".to_string(), "6★".to_string(), "90".to_string()],
        vec!["SilverAsh".to_string(), "Guard".to_string(), "6★".to_string(), "90".to_string()],
        vec!["Exusiai".to_string(), "Sniper".to_string(), "6★".to_string(), "90".to_string()],
        vec!["Siege".to_string(), "Vanguard".to_string(), "6★".to_string(), "80".to_string()],
        vec!["Myrtle".to_string(), "Vanguard".to_string(), "4★".to_string(), "70".to_string()],
        vec!["Angelina".to_string(), "Supporter".to_string(), "6★".to_string(), "80".to_string()],
        vec!["Projekt Red".to_string(), "Specialist".to_string(), "5★".to_string(), "70".to_string()],
    ];

    // Tree data for hierarchical display
    let tree_data = vec![
        components::data::TreeNodeData {
            key: "rhodes-island".to_string(),
            label: "Rhodes Island".to_string(),
            children: Some(vec![
                components::data::TreeNodeData {
                    key: "management".to_string(),
                    label: "Management".to_string(),
                    children: Some(vec![
                        components::data::TreeNodeData {
                            key: "amiya".to_string(),
                            label: "Amiya".to_string(),
                            children: None,
                            disabled: false,
                        },
                        components::data::TreeNodeData {
                            key: "kal'tsit".to_string(),
                            label: "Kal'tsit".to_string(),
                            children: None,
                            disabled: false,
                        },
                    ]),
                    disabled: false,
                },
                components::data::TreeNodeData {
                    key: "operators".to_string(),
                    label: "Operators".to_string(),
                    children: Some(vec![
                        components::data::TreeNodeData {
                            key: "guards".to_string(),
                            label: "Guards".to_string(),
                            children: Some(vec![
                                components::data::TreeNodeData {
                                    key: "silver-ash".to_string(),
                                    label: "SilverAsh".to_string(),
                                    children: None,
                                    disabled: false,
                                },
                                components::data::TreeNodeData {
                                    key: "siege".to_string(),
                                    label: "Siege".to_string(),
                                    children: None,
                                    disabled: false,
                                },
                            ]),
                            disabled: false,
                        },
                        components::data::TreeNodeData {
                            key: "snipers".to_string(),
                            label: "Snipers".to_string(),
                            children: Some(vec![
                                components::data::TreeNodeData {
                                    key: "exusiai".to_string(),
                                    label: "Exusiai".to_string(),
                                    children: None,
                                    disabled: false,
                                },
                            ]),
                            disabled: false,
                        },
                    ]),
                    disabled: false,
                },
            ]),
            disabled: false,
        },
    ];

    // Pagination state
    let mut current_page = use_signal(|| 1);
    let total_pages = 7;
    let total_items = 67;

    rsx! {
        Layout {
            current_route: Route::ComponentsData {},

            Container {
                // Page header
                div {
                    class: "showcase-header",
                    h1 {
                        class: "showcase-title",
                        "Data Components"
                    }
                    p {
                        class: "showcase-subtitle",
                        "Data display and organization components"
                    }
                }

                // Table Section
                Section {
                    title: Some("Table".to_string()),
                    description: Some("Table component for displaying structured data with sorting and styling options.".to_string()),
                    class: "showcase-section",

                    div {
                        class: "showcase-table-container",
                        Table {
                            columns: columns.clone(),
                            data: data.clone(),
                            bordered: true,
                            striped: true,
                            hoverable: true,
                        }
                    }

                    // Table variants
                    Grid {
                        columns: 12,
                        gap: "lg".to_string(),

                        Card {
                            title: "Compact Table".to_string(),
                            Table {
                                columns: columns.clone(),
                                data: data.clone(),
                                size: components::TableSize::Small,
                                bordered: false,
                            }
                        }

                        Card {
                            title: "Bordered Table".to_string(),
                            Table {
                                columns: columns.clone(),
                                data: data.clone(),
                                size: components::TableSize::Medium,
                                bordered: true,
                            }
                        }
                    }
                }

                // Tree Section
                Section {
                    title: Some("Tree".to_string()),
                    description: Some("Tree component for displaying hierarchical data with expandable nodes.".to_string()),
                    class: "showcase-section",

                    Grid {
                        columns: 12,
                        gap: "lg".to_string(),

                        // Interactive tree
                        Card {
                            title: "Organization Tree".to_string(),
                            Tree {
                                data: tree_data.clone(),
                                default_expanded_keys: vec!["rhodes-island".to_string(), "management".to_string()],
                                show_line: true,
                            }
                        }

                        // Simple tree with icons
                        Card {
                            title: "File Tree".to_string(),
                            div {
                                class: "showcase-file-tree",
                                div { class: "file-tree-item", "📁 src" }
                                div { class: "file-tree-folder", "  📁 components" }
                                div { class: "file-tree-file", "    📄 button.rs" }
                                div { class: "file-tree-file", "    📄 input.rs" }
                                div { class: "file-tree-file", "    📄 card.rs" }
                                div { class: "file-tree-folder", "  📁 pages" }
                                div { class: "file-tree-file", "    📄 home.rs" }
                                div { class: "file-tree-file", "    📄 about.rs" }
                                div { class: "file-tree-folder", "  📄 lib.rs" }
                            }
                        }
                    }
                }

                // Pagination Section
                Section {
                    title: Some("Pagination".to_string()),
                    description: Some("Pagination component for navigating through large datasets.".to_string()),
                    class: "showcase-section",

                    Grid {
                        columns: 12,
                        gap: "lg".to_string(),

                        // Basic pagination
                        Card {
                            title: "Basic Pagination".to_string(),
                            div {
                                class: "showcase-vertical-stack",

                                // Pagination info
                                Row {
                                    justify: "between".to_string(),
                                    align: "center".to_string(),
                                    class: "showcase-pagination-info",
                                    span {
                                        {format!(
                                            "Showing {}-{} of {}",
                                            (*current_page.read() - 1) * 10 + 1,
                                            *current_page.read() * 10,
                                            total_items
                                        )}
                                    }
                                }

                                // Pagination controls
                                Row {
                                    justify: "center".to_string(),
                                    align: "center".to_string(),
                                    gap: "sm".to_string(),
                                    class: "showcase-pagination-controls",

                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Ghost,
                                        disabled: *current_page.read() == 1,
                                        onclick: move |_| {
                                            let current = *current_page.read();
                                            if current > 1 {
                                                current_page.set(current - 1);
                                            }
                                        },
                                        "←"
                                    }
                                    for page in 1..=total_pages {
                                        Button {
                                            size: ButtonSize::Small,
                                            variant: if *current_page.read() == page {
                                                ButtonVariant::Primary
                                            } else {
                                                ButtonVariant::Ghost
                                            },
                                            onclick: move |_| {
                                                current_page.set(page);
                                            },
                                            "{page}"
                                        }
                                    }
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Ghost,
                                        disabled: *current_page.read() == total_pages,
                                        onclick: move |_| {
                                            let current = *current_page.read();
                                            if current < total_pages {
                                                current_page.set(current + 1);
                                            }
                                        },
                                        "→"
                                    }
                                }
                            }
                        }

                        // Pagination with page size selector
                        Card {
                            title: "With Page Size".to_string(),
                            div {
                                class: "showcase-vertical-stack",

                                Row {
                                    gap: "sm".to_string(),
                                    align: "center".to_string(),
                                    class: "showcase-pagination-info",
                                    span { "Items per page:" }
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Primary,
                                        "10"
                                    }
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Ghost,
                                        "25"
                                    }
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Ghost,
                                        "50"
                                    }
                                }

                                Row {
                                    justify: "center".to_string(),
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Primary,
                                        "1"
                                    }
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Ghost,
                                        "2"
                                    }
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Ghost,
                                        "3"
                                    }
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Ghost,
                                        "..."
                                    }
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Ghost,
                                        "7"
                                    }
                                }
                            }
                        }

                        // Simple pagination
                        Card {
                            title: "Simple Pagination".to_string(),
                            Row {
                                justify: "between".to_string(),
                                align: "center".to_string(),
                                gap: "md".to_string(),
                                class: "file-tree-separator",
                                Button {
                                    size: ButtonSize::Small,
                                    variant: ButtonVariant::Secondary,
                                    "Previous"
                                }
                                div {
                                    class: "showcase-pagination-info",
                                    {format!("Page {} of {}", *current_page.read(), total_pages)}
                                }
                                Button {
                                    size: ButtonSize::Small,
                                    variant: ButtonVariant::Secondary,
                                    "Next"
                                }
                            }
                        }
                    }
                }

                // Interactive Demo Section
                Section {
                    title: Some("Interactive Demo".to_string()),
                    class: "showcase-section",

                    div {
                        class: "showcase-table-container",

                        Card {
                            title: "Operator Roster".to_string(),
                            div {
                                class: "mb-4",
                                Table {
                                    columns: columns.clone(),
                                    data: data.clone(),
                                    bordered: true,
                                    striped: true,
                                    hoverable: true,
                                }
                            }
                            Row {
                                justify: "between".to_string(),
                                align: "center".to_string(),
                                gap: "sm".to_string(),
                                class: "file-tree-separator-top",
                                div {
                                    class: "showcase-pagination-info",
                                    {format!("Showing {} operators", data.len())}
                                }
                                Row {
                                    gap: "sm".to_string(),
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Primary,
                                        "Export"
                                    }
                                    Button {
                                        size: ButtonSize::Small,
                                        variant: ButtonVariant::Ghost,
                                        "Filter"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
