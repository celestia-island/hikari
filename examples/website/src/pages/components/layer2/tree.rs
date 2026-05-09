use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page("page-component-tree", "Tree", "Hierarchical tree view with expand/collapse, selection, and optional checkboxes.", rsx! [
        {render_demo_block("Basic Tree", rsx! {
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
        })}
        {render_demo_block("Tree with Checkboxes", rsx! {
            div { class: "hi-tree",
                div { class: "hi-tree__item",
                    label { class: "hi-tree__label--checkable",
                        input { r#type: "checkbox", checked: "true" }
                        span { class: "hi-tree__arrow hi-tree__arrow--expanded", "▼" }
                        span { class: "hi-tree__label", "Permissions" }
                    }
                }
                div { class: "hi-tree__item hi-tree__item--indent",
                    label { class: "hi-tree__label--checkable",
                        input { r#type: "checkbox", checked: "true" }
                        span { class: "hi-tree__label", "Read" }
                    }
                }
                div { class: "hi-tree__item hi-tree__item--indent",
                    label { class: "hi-tree__label--checkable",
                        input { r#type: "checkbox", checked: "true" }
                        span { class: "hi-tree__label", "Write" }
                    }
                }
                div { class: "hi-tree__item hi-tree__item--indent",
                    label { class: "hi-tree__label--checkable",
                        input { r#type: "checkbox" }
                        span { class: "hi-tree__label", "Delete" }
                    }
                }
                div { class: "hi-tree__item",
                    label { class: "hi-tree__label--checkable",
                        input { r#type: "checkbox" }
                        span { class: "hi-tree__arrow", "▶" }
                        span { class: "hi-tree__label", "Admin" }
                    }
                }
            }
        })}
        {render_demo_block("Directory Tree", rsx! {
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
        })}
        {render_demo_block("API", rsx! {
            div {
                {render_api_table(&[
                ("data", "TreeNode[]", "-", "Tree data source"),
                ("checkable", "bool", "false", "Show checkboxes on nodes"),
                ("selectable", "bool", "false", "Enable node selection"),
                ("defaultExpandAll", "bool", "false", "Expand all nodes initially"),
                ("icons", "bool", "false", "Show file/folder icons"),
            ])}
            }
        })}
    ])
}
