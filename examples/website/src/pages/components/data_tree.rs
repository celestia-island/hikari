// website/src/pages/components/data/tree.rs
// Tree component showcase page with real rendered examples

use dioxus::prelude::*;

use crate::{app::Route, components::Layout};
use _components::{Tree, TreeNodeData, layout::{Container, Section}};
use _palette::classes::{ClassesBuilder, FontSize, FontWeight, MarginBottom, Padding, TextColor};

#[allow(non_snake_case)]
pub fn ComponentsTree() -> Element {
    rsx! {
        Layout {
            current_route: Route::DataTree {},

            Container {
                // Page header
                div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                    h1 {
                        class: ClassesBuilder::new()
                            .add(FontSize::X4xl)
                            .add(FontWeight::Bold)
                            .add(MarginBottom::Mb0)
                            .add(MarginBottom::Mb2)
                            .build(),
                        "Tree"
                    }
                    p { class: ClassesBuilder::new().add(MarginBottom::Mb0).add(TextColor::Secondary).build(),
                        "Tree component for hierarchical data display with expand/collapse"
                    }
                }

                // Overview
                Section {
                    title: Some("Overview".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                        p {
                            "Tree displays hierarchical data in a tree structure. It supports:"
                        }
                        ul { class: ClassesBuilder::new().add_raw("pl-6").add(MarginBottom::Mb0).build(),
                            li {
                                strong { "Nested children" }
                                " - Unlimited nesting depth"
                            }
                            li {
                                strong { "Expand/collapse" }
                                " - Click to show/hide children"
                            }
                            li {
                                strong { "Selection" }
                                " - Click to select nodes"
                            }
                            li {
                                strong { "Connecting lines" }
                                " - Optional visual connecting lines"
                            }
                        }
                    }
                }

                // Basic Tree
                Section {
                    title: Some("Basic Trees".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Simple Tree"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Basic tree with nested children"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Tree {
                                data: vec![
                                    TreeNodeData {
                                        key: "1".to_string(),
                                        label: "Parent 1".to_string(),
                                        children: Some(vec![
                                            TreeNodeData {
                                                key: "1-1".to_string(),
                                                label: "Child 1-1".to_string(),
                                                children: None,
                                                disabled: false,
                                            },
                                            TreeNodeData {
                                                key: "1-2".to_string(),
                                                label: "Child 1-2".to_string(),
                                                children: None,
                                                disabled: false,
                                            },
                                        ]),
                                        disabled: false,
                                    },
                                    TreeNodeData {
                                        key: "2".to_string(),
                                        label: "Parent 2".to_string(),
                                        children: Some(vec![
                                            TreeNodeData {
                                                key: "2-1".to_string(),
                                                label: "Child 2-1".to_string(),
                                                children: None,
                                                disabled: false,
                                            },
                                        ]),
                                        disabled: false,
                                    },
                                ],
                                default_expanded_keys: vec!["1".to_string()],
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Connecting Lines"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Tree with visual connecting lines between nodes"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Tree {
                                data: vec![
                                    TreeNodeData {
                                        key: "1".to_string(),
                                        label: "Parent 1".to_string(),
                                        children: Some(vec![
                                            TreeNodeData {
                                                key: "1-1".to_string(),
                                                label: "Child 1-1".to_string(),
                                                children: None,
                                                disabled: false,
                                            },
                                            TreeNodeData {
                                                key: "1-2".to_string(),
                                                label: "Child 1-2".to_string(),
                                                children: None,
                                                disabled: false,
                                            },
                                        ]),
                                        disabled: false,
                                    },
                                    TreeNodeData {
                                        key: "2".to_string(),
                                        label: "Parent 2".to_string(),
                                        children: Some(vec![
                                            TreeNodeData {
                                                key: "2-1".to_string(),
                                                label: "Child 2-1".to_string(),
                                                children: None,
                                                disabled: false,
                                            },
                                        ]),
                                        disabled: false,
                                    },
                                ],
                                show_line: true,
                                default_expanded_keys: vec!["1".to_string()],
                            }
                        }
                    }
                }

                // Multi-level Tree
                Section {
                    title: Some("Multi-level Trees".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Deeply Nested"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Tree with multiple levels of nesting"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Tree {
                                data: vec![
                                    TreeNodeData {
                                        key: "1".to_string(),
                                        label: "Level 1".to_string(),
                                        children: Some(vec![
                                            TreeNodeData {
                                                key: "1-1".to_string(),
                                                label: "Level 2".to_string(),
                                                children: Some(vec![
                                                    TreeNodeData {
                                                        key: "1-1-1".to_string(),
                                                        label: "Level 3".to_string(),
                                                        children: None,
                                                        disabled: false,
                                                    },
                                                    TreeNodeData {
                                                        key: "1-1-2".to_string(),
                                                        label: "Level 3".to_string(),
                                                        children: None,
                                                        disabled: false,
                                                    },
                                                ]),
                                                disabled: false,
                                            },
                                            TreeNodeData {
                                                key: "1-2".to_string(),
                                                label: "Level 2".to_string(),
                                                children: Some(vec![
                                                    TreeNodeData {
                                                        key: "1-2-1".to_string(),
                                                        label: "Level 3".to_string(),
                                                        children: Some(vec![
                                                            TreeNodeData {
                                                                key: "1-2-1-1".to_string(),
                                                                label: "Level 4".to_string(),
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
                                ],
                                default_expanded_keys: vec!["1".to_string(), "1-1".to_string()],
                                show_line: true,
                            }
                        }
                    }
                }

                // File System Tree
                Section {
                    title: Some("Common Use Cases".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "File System"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "File and folder structure"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Tree {
                                data: vec![
                                    TreeNodeData {
                                        key: "root".to_string(),
                                        label: "📁 Project".to_string(),
                                        children: Some(vec![
                                            TreeNodeData {
                                                key: "src".to_string(),
                                                label: "📁 src".to_string(),
                                                children: Some(vec![
                                                    TreeNodeData {
                                                        key: "main.rs".to_string(),
                                                        label: "📄 main.rs".to_string(),
                                                        children: None,
                                                        disabled: false,
                                                    },
                                                    TreeNodeData {
                                                        key: "lib.rs".to_string(),
                                                        label: "📄 lib.rs".to_string(),
                                                        children: None,
                                                        disabled: false,
                                                    },
                                                ]),
                                                disabled: false,
                                            },
                                            TreeNodeData {
                                                key: "tests".to_string(),
                                                label: "📁 tests".to_string(),
                                                children: Some(vec![
                                                    TreeNodeData {
                                                        key: "test.rs".to_string(),
                                                        label: "📄 test.rs".to_string(),
                                                        children: None,
                                                        disabled: false,
                                                    },
                                                ]),
                                                disabled: false,
                                            },
                                            TreeNodeData {
                                                key: "README.md".to_string(),
                                                label: "📄 README.md".to_string(),
                                                children: None,
                                                disabled: false,
                                            },
                                            TreeNodeData {
                                                key: "Cargo.toml".to_string(),
                                                label: "📄 Cargo.toml".to_string(),
                                                children: None,
                                                disabled: false,
                                            },
                                        ]),
                                        disabled: false,
                                    },
                                ],
                                default_expanded_keys: vec!["root".to_string(), "src".to_string()],
                                show_line: true,
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Organization Structure"
                        }
                        p { class: ClassesBuilder::new().add(TextColor::Secondary).build(),
                            "Company or team hierarchy"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            Tree {
                                data: vec![
                                    TreeNodeData {
                                        key: "ceo".to_string(),
                                        label: "CEO".to_string(),
                                        children: Some(vec![
                                            TreeNodeData {
                                                key: "cto".to_string(),
                                                label: "CTO".to_string(),
                                                children: Some(vec![
                                                    TreeNodeData {
                                                        key: "dev1".to_string(),
                                                        label: "Development Lead".to_string(),
                                                        children: Some(vec![
                                                            TreeNodeData {
                                                                key: "frontend".to_string(),
                                                                label: "Frontend Team".to_string(),
                                                                children: None,
                                                                disabled: false,
                                                            },
                                                            TreeNodeData {
                                                                key: "backend".to_string(),
                                                                label: "Backend Team".to_string(),
                                                                children: None,
                                                                disabled: false,
                                                            },
                                                        ]),
                                                        disabled: false,
                                                    },
                                                ]),
                                                disabled: false,
                                            },
                                            TreeNodeData {
                                                key: "coo".to_string(),
                                                label: "COO".to_string(),
                                                children: Some(vec![
                                                    TreeNodeData {
                                                        key: "ops".to_string(),
                                                        label: "Operations Team".to_string(),
                                                        children: None,
                                                        disabled: false,
                                                    },
                                                ]),
                                                disabled: false,
                                            },
                                        ]),
                                        disabled: false,
                                    },
                                ],
                                default_expanded_keys: vec!["ceo".to_string()],
                                show_line: true,
                            }
                        }
                    }
                }

                // Usage Examples
                Section {
                    title: Some("Usage Examples".to_string()),
                    class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "Basic Tree"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Tree {{
    data: vec![
        TreeNodeData {{
            key: "1".to_string(),
            label: "Parent".to_string(),
            children: Some(vec![
                TreeNodeData {{
                    key: "1-1".to_string(),
                    label: "Child".to_string(),
                    children: None,
                    disabled: false,
                }},
            ]),
            disabled: false,
        }},
    ],
}}"#
                            }
                        }
                    }

                    div { class: ClassesBuilder::new().add(MarginBottom::Mb8).build(),
                        h3 {
                            class: ClassesBuilder::new()
                                .add(FontSize::Lg)
                                .add(FontWeight::Semibold)
                                .add(TextColor::Primary)
                                .add(MarginBottom::Mb3)
                                .build(),
                            "With Default Expanded"
                        }
                        div { class: ClassesBuilder::new().add(Padding::P6).build(),
                            code {
                                r#"Tree {{
    data: vec![...],
    default_expanded_keys: vec!["1".to_string()],
    show_line: true,
}}"#
                            }
                        }
                    }
                }
            }
        }
    }
}
