use crate::components::demo_page::{render_api_table, render_demo_block, render_demo_page};
use tairitsu_macros::rsx;
use tairitsu_vdom::VNode;

pub fn render() -> VNode {
    render_demo_page(
        "page-component-description-list",
        "Description List",
        "Key-value pair display for metadata, configurations, and detail panels.",
        VNode::Fragment(vec![
            render_demo_block("Basic Description List",
                rsx! {
                    dl { class: "hi-description-list",
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Name" }
                            dd { class: "hi-description-list__detail", "Hikari UI" }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Version" }
                            dd { class: "hi-description-list__detail", "2.4.0" }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "License" }
                            dd { class: "hi-description-list__detail", "MIT" }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Author" }
                            dd { class: "hi-description-list__detail", "Tairitsu Team" }
                        }
                    }
                }
            ),
            render_demo_block("Project Metadata",
                rsx! {
                    dl { class: "hi-description-list hi-description-list--horizontal",
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Repository" }
                            dd { class: "hi-description-list__detail", "github.com/tairitsu/hikari" }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Language" }
                            dd { class: "hi-description-list__detail", "Rust" }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Framework" }
                            dd { class: "hi-description-list__detail", "Tauri + WebAssembly" }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Stars" }
                            dd { class: "hi-description-list__detail", "1,234" }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Last Release" }
                            dd { class: "hi-description-list__detail", "2025-04-15" }
                        }
                    }
                }
            ),
            render_demo_block("With Tags",
                rsx! {
                    dl { class: "hi-description-list",
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Status" }
                            dd { class: "hi-description-list__detail",
                                span { class: "hi-tag hi-tag--success", "Active" }
                            }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Priority" }
                            dd { class: "hi-description-list__detail",
                                span { class: "hi-tag hi-tag--danger", "High" }
                            }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Tags" }
                            dd { class: "hi-description-list__detail",
                                span { class: "hi-tag hi-tag--primary", "UI" }
                                span { class: "hi-tag hi-tag--warning", "WIP" }
                                span { class: "hi-tag", "v2" }
                            }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Assignee" }
                            dd { class: "hi-description-list__detail",
                                div { style: "display:flex;align-items:center;gap:8px;",
                                    div { class: "hi-avatar hi-avatar--primary hi-avatar--xs", "A" }
                                    span { "Alice Chen" }
                                }
                            }
                        }
                    }
                }
            ),
            render_demo_block("Bordered Style",
                rsx! {
                    dl { class: "hi-description-list hi-description-list--bordered",
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "CPU Usage" }
                            dd { class: "hi-description-list__detail", "23%" }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Memory" }
                            dd { class: "hi-description-list__detail", "512 MB / 4 GB" }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Disk" }
                            dd { class: "hi-description-list__detail", "128 GB / 256 GB" }
                        }
                        div { class: "hi-description-list__item",
                            dt { class: "hi-description-list__term", "Uptime" }
                            dd { class: "hi-description-list__detail", "42 days" }
                        }
                    }
                }
            ),
            render_demo_block("API",
                render_api_table(&[
                    ("layout", "vertical | horizontal", "vertical", "Term-detail alignment"),
                    ("bordered", "bool", "false", "Show borders between items"),
                    ("colon", "bool", "true", "Show colon after term"),
                    ("size", "small | default | large", "default", "Font and spacing size"),
                ])
            ),
        ]),
    )
}
