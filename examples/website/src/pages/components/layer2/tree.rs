use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    rsx! {
        div { id: "page-component-tree", class: "hikari-page",
            div { class: "page-header",
                h1 { class: "page-header__title", "Tree" }
                p { class: "page-header__subtitle",
                    "Hierarchical tree view with expand/collapse, selection, and optional checkboxes."
                }
            }
            div { class: "page-section",
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Basic Tree" }
                    div { class: "demo-block__body",
                        div { class: "hi-tree",
                            div { class: "hi-tree__item",
                                span { class: "hi-tree__arrow hi-tree__arrow--expanded", "▼" }
                                span { class: "hi-tree__label", "src" }
                            }
                            div { class: "hi-tree__item hi-tree__item--indent",
                                span { class: "hi-tree__arrow", "▶" }
                                span { class: "hi-tree__label", "components" }
                            }
                            div { class: "hi-tree__item hi-tree__item--indent hi-tree__item--indent",
                                span { class: "hi-tree__arrow", "▶" }
                                span { class: "hi-tree__label", "Button.tsx" }
                            }
                            div { class: "hi-tree__item hi-tree__item--indent",
                                span { class: "hi-tree__arrow", "▶" }
                                span { class: "hi-tree__label", "pages" }
                            }
                            div { class: "hi-tree__item",
                                span { class: "hi-tree__arrow", "▶" }
                                span { class: "hi-tree__label", "tests" }
                            }
                            div { class: "hi-tree__item",
                                span { class: "hi-tree__label", "Cargo.toml" }
                            }
                            div { class: "hi-tree__item",
                                span { class: "hi-tree__label", "README.md" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Tree with Checkboxes" }
                    div { class: "demo-block__body",
                        div { class: "hi-tree",
                            div { class: "hi-tree__item",
                                label { style: "display:flex;align-items:center;gap:6px;",
                                    input { r#type: "checkbox", checked: "true" }
                                    span { class: "hi-tree__arrow hi-tree__arrow--expanded", "▼" }
                                    span { class: "hi-tree__label", "Permissions" }
                                }
                            }
                            div { class: "hi-tree__item hi-tree__item--indent",
                                label { style: "display:flex;align-items:center;gap:6px;",
                                    input { r#type: "checkbox", checked: "true" }
                                    span { class: "hi-tree__label", "Read" }
                                }
                            }
                            div { class: "hi-tree__item hi-tree__item--indent",
                                label { style: "display:flex;align-items:center;gap:6px;",
                                    input { r#type: "checkbox", checked: "true" }
                                    span { class: "hi-tree__label", "Write" }
                                }
                            }
                            div { class: "hi-tree__item hi-tree__item--indent",
                                label { style: "display:flex;align-items:center;gap:6px;",
                                    input { r#type: "checkbox" }
                                    span { class: "hi-tree__label", "Delete" }
                                }
                            }
                            div { class: "hi-tree__item",
                                label { style: "display:flex;align-items:center;gap:6px;",
                                    input { r#type: "checkbox" }
                                    span { class: "hi-tree__arrow", "▶" }
                                    span { class: "hi-tree__label", "Admin" }
                                }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "Directory Tree" }
                    div { class: "demo-block__body",
                        div { class: "hi-tree",
                            div { class: "hi-tree__item",
                                span { class: "hi-tree__arrow hi-tree__arrow--expanded", "▼" }
                                span { class: "hi-tree__icon", "📁" }
                                span { class: "hi-tree__label", "hikari" }
                            }
                            div { class: "hi-tree__item hi-tree__item--indent",
                                span { class: "hi-tree__icon", "📁" }
                                span { class: "hi-tree__label", "examples" }
                            }
                            div { class: "hi-tree__item hi-tree__item--indent hi-tree__item--indent",
                                span { class: "hi-tree__icon", "📁" }
                                span { class: "hi-tree__label", "website" }
                            }
                            div { class: "hi-tree__item hi-tree__item--indent hi-tree__item--indent hi-tree__item--indent",
                                span { class: "hi-tree__icon", "📄" }
                                span { class: "hi-tree__label hi-tree__label--active", "main.rs" }
                            }
                            div { class: "hi-tree__item hi-tree__item--indent",
                                span { class: "hi-tree__icon", "📄" }
                                span { class: "hi-tree__label", "Cargo.toml" }
                            }
                        }
                    }
                }
                div { class: "demo-block",
                    h3 { class: "demo-block__title", "API" }
                    div { class: "demo-block__body",
                        table { class: "api-table",
                            thead { tr { th { "Property" } th { "Type" } th { "Default" } th { "Description" } } }
                            tbody {
                                tr { td { code { "data" } } td { code { "TreeNode[]" } } td { code { "-" } } td { "Tree data source" } }
                                tr { td { code { "checkable" } } td { code { "bool" } } td { code { "false" } } td { "Show checkboxes on nodes" } }
                                tr { td { code { "selectable" } } td { code { "bool" } } td { code { "false" } } td { "Enable node selection" } }
                                tr { td { code { "defaultExpandAll" } } td { code { "bool" } } td { code { "false" } } td { "Expand all nodes initially" } }
                                tr { td { code { "icons" } } td { code { "bool" } } td { code { "false" } } td { "Show file/folder icons" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
